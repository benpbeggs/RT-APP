#!/usr/bin/env python3
"""Render the call bank: every call, recorded whole.

Each call in src/lib/lexicon.ts is spoken by a neural TTS voice as one
continuous utterance, put through a VHF-comms processing chain, resampled to
8 kHz and encoded as MP3. The recordings are written end to end into one binary
with a JSON index of byte offsets; the app fetches it once and decodes a call
the first time it is played.

Recording whole calls is the point. Assembling them from smaller pieces — words,
or even whole phrases — leaves seams at every join and flattens the intonation
that runs across a sentence, which is what makes assembled speech sound like a
machine reading a list. A real flight simulator synthesises each transmission in
full at runtime; a browser cannot host a neural voice that large, but rendering
the same complete utterances ahead of time gets the same result.

Processing the voice offline is the whole point of the exercise: the Web Speech
API gives no audio node for synthesised speech, so a live TTS voice cannot be
filtered in the browser. A recorded clip can be.

The voice is Piper (a neural TTS) rather than a formant synthesiser, which is
what stops it sounding robotic. The model is LibriTTS, trained on 904 real
speakers; the speaker below was chosen by measurement — see check-voice.py.

Usage: python3 scripts/build-call-bank.py calls.json out.bin out.json
"""

import json
import sys
import tarfile
import tempfile
import urllib.request
import wave
from pathlib import Path

import lameenc
import numpy as np

SOURCE_RATE = 22050  # what the Piper model emits
TARGET_RATE = 8000  # plenty for a 2.9 kHz-limited signal, and halves the size

MP3_BITRATE = 24  # kbps mono; the signal is band-limited to 2.9 kHz

# Multi-speaker LibriTTS. Voice models are large and are not committed; the
# generated bank is, so building or running the app never needs this download.
VOICE_URL = (
    "https://github.com/rhasspy/piper/releases/download/v0.0.2/"
    "voice-en-us-libritts-high.tar.gz"
)
VOICE_FILE = "en-us-libritts-high.onnx"
CACHE_DIR = Path(__file__).parent.parent / ".cache" / "piper"

# Speaker 224 of 904, picked by measuring every 14th speaker: its pitch sits at
# the centre of the gender-neutral band (median 174 Hz) and holds the tightest
# spread across utterances. See check-voice.py.
SPEAKER_ID = 224

# Slightly quicker than conversational, the way controllers actually speak.
LENGTH_SCALE = 0.95

# The comms passband. Real VHF aeronautical audio is roughly 300-3000 Hz.
HIGHPASS_HZ = 300.0
LOWPASS_HZ = 2900.0


def ensure_voice() -> Path:
    """Fetch and unpack the Piper voice model, cached between builds."""
    model = CACHE_DIR / VOICE_FILE
    if model.exists():
        return model

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading voice model to {CACHE_DIR} (about 120 MB, once)…", flush=True)
    with tempfile.NamedTemporaryFile(suffix=".tar.gz") as tmp:
        try:
            with urllib.request.urlopen(VOICE_URL, timeout=300) as response:
                tmp.write(response.read())
        except Exception as exc:
            raise SystemExit(
                f"could not download the voice model: {exc}\n"
                f"Fetch {VOICE_URL} manually and unpack it into {CACHE_DIR}"
            ) from None
        tmp.flush()
        with tarfile.open(tmp.name) as archive:
            archive.extractall(CACHE_DIR)

    if not model.exists():
        raise SystemExit(f"{VOICE_FILE} missing after unpacking into {CACHE_DIR}")
    return model


def load_voice():
    try:
        from piper import PiperVoice
    except ImportError:
        raise SystemExit("piper-tts is not installed — run: pip install piper-tts") from None
    return PiperVoice.load(str(ensure_voice()))


def synthesise(voice, text: str) -> np.ndarray:
    """One clip of speech, as floats in [-1, 1]."""
    from piper import SynthesisConfig
    import io

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        voice.synthesize_wav(
            text,
            w,
            syn_config=SynthesisConfig(speaker_id=SPEAKER_ID, length_scale=LENGTH_SCALE),
        )
    buffer.seek(0)
    with wave.open(buffer) as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2
        assert w.getframerate() == SOURCE_RATE, f"expected {SOURCE_RATE} Hz"
        raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0


def fir_bandpass(num_taps: int, low_hz: float, high_hz: float, rate: float) -> np.ndarray:
    """Windowed-sinc bandpass, built as (lowpass at high) - (lowpass at low)."""
    if num_taps % 2 == 0:
        num_taps += 1
    n = np.arange(num_taps) - (num_taps - 1) / 2

    def lowpass(cut: float) -> np.ndarray:
        f = cut / rate
        h = np.sinc(2 * f * n) * 2 * f
        return h

    h = lowpass(high_hz) - lowpass(low_hz)
    h *= np.blackman(num_taps)
    return h / np.sum(np.abs(h))


def resample_linear(x: np.ndarray, src: int, dst: int) -> np.ndarray:
    """Linear resample. Safe here because the signal is already band-limited."""
    duration = len(x) / src
    target_len = int(duration * dst)
    src_idx = np.linspace(0, len(x) - 1, target_len)
    return np.interp(src_idx, np.arange(len(x)), x)


def compress(x: np.ndarray, rate: int, threshold=0.30, ratio=3.0) -> np.ndarray:
    """Envelope-following compressor — radio audio is heavily levelled."""
    attack = np.exp(-1.0 / (0.003 * rate))
    release = np.exp(-1.0 / (0.09 * rate))

    envelope = np.zeros_like(x)
    level = 0.0
    magnitude = np.abs(x)
    for i, m in enumerate(magnitude):
        coeff = attack if m > level else release
        level = coeff * level + (1 - coeff) * m
        envelope[i] = level

    gain = np.ones_like(envelope)
    hot = envelope > threshold
    gain[hot] = (threshold + (envelope[hot] - threshold) / ratio) / envelope[hot]
    return x * gain


def trim_silence(x: np.ndarray, floor=0.006, pad=48) -> np.ndarray:
    loud = np.where(np.abs(x) > floor)[0]
    if len(loud) == 0:
        return x[:1]
    start = max(0, loud[0] - pad)
    end = min(len(x), loud[-1] + pad)
    return x[start:end]


def process(x: np.ndarray) -> np.ndarray:
    """Voice -> radio: bandpass, level, saturate, band-limit again."""
    taps = fir_bandpass(255, HIGHPASS_HZ, LOWPASS_HZ, SOURCE_RATE)
    x = np.convolve(x, taps, mode="same")

    peak = np.max(np.abs(x))
    if peak > 0:
        x = x / peak * 0.85

    x = compress(x, SOURCE_RATE)

    # A touch of saturation for transmitter grit. Kept gentle: pushed harder it
    # buys "radio" character at the cost of sounding synthetic, and the voice
    # reading as human matters more than the grit does.
    x = np.tanh(x * 1.35) / np.tanh(1.35)

    x = resample_linear(x, SOURCE_RATE, TARGET_RATE)

    # Re-limit after the non-linearity, which generates new harmonics.
    taps2 = fir_bandpass(127, HIGHPASS_HZ, min(LOWPASS_HZ, TARGET_RATE / 2 * 0.92), TARGET_RATE)
    x = np.convolve(x, taps2, mode="same")

    x = trim_silence(x)

    # Short fades at the edges: clips are butted together at playback, and a
    # waveform cut mid-cycle clicks audibly at the join.
    fade = min(int(0.006 * TARGET_RATE), len(x) // 4)
    if fade > 1:
        ramp = np.linspace(0.0, 1.0, fade)
        x[:fade] *= ramp
        x[-fade:] *= ramp[::-1]

    peak = np.max(np.abs(x))
    if peak > 0:
        x = x / peak * 0.82
    return x


def encode_mp3(x: np.ndarray) -> bytes:
    pcm = (np.clip(x, -1.0, 1.0) * 32767).astype("<i2")
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(MP3_BITRATE)
    encoder.set_in_sample_rate(TARGET_RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    return encoder.encode(pcm.tobytes()) + encoder.flush()


def main() -> int:
    calls_path, bin_path, index_path = (Path(p) for p in sys.argv[1:4])
    calls = json.loads(calls_path.read_text())

    voice = load_voice()

    index: dict[str, list[int]] = {}
    blobs: list[bytes] = []
    cursor = 0
    seconds = 0.0

    for i, (call_id, text) in enumerate(calls, 1):
        audio = process(synthesise(voice, text))
        mp3 = encode_mp3(audio)
        index[call_id] = [cursor, len(mp3)]
        blobs.append(mp3)
        cursor += len(mp3)
        seconds += len(audio) / TARGET_RATE
        print(f"  [{i:3}/{len(calls)}] {call_id}  {len(audio) / TARGET_RATE:.1f}s", flush=True)

    bin_path.write_bytes(b"".join(blobs))
    index_path.write_text(json.dumps({"calls": index}, separators=(",", ":")))

    print(
        f"\n{len(calls)} calls, {seconds / 60:.1f} min of speech, "
        f"{bin_path.stat().st_size / 1048576:.2f} MB audio, "
        f"{index_path.stat().st_size / 1024:.1f} KB index"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
