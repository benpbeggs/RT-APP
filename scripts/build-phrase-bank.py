#!/usr/bin/env python3
"""Render the phrase bank: one recorded clip per phrase, packed into a sprite.

Each clip in src/lib/lexicon.ts is spoken by a neural TTS voice, put through a
VHF-comms processing chain, resampled to 8 kHz and packed into a single WAV
with a JSON index of sample offsets. The app fetches one file, decodes it once
and slices clips out of it at playback.

Processing the voice offline is the whole point of the exercise: the Web Speech
API gives no audio node for synthesised speech, so a live TTS voice cannot be
filtered in the browser. A recorded clip can be.

The voice is Piper (a neural TTS) rather than a formant synthesiser, which is
what stops it sounding robotic. The model is LibriTTS, trained on 904 real
speakers; the speaker below was chosen by measurement — see check-voice.py.

Clips are whole phrases — a run of fixed wording, or one slot value spoken
right through — not single words, which is what lets assembled calls carry a
natural rhythm.

Usage: python3 scripts/build-phrase-bank.py clips.json out.wav out.json
"""

import json
import sys
import tarfile
import tempfile
import urllib.request
import wave
from pathlib import Path

import numpy as np

SOURCE_RATE = 22050  # what the Piper model emits
TARGET_RATE = 8000  # plenty for a 2.9 kHz-limited signal, and halves the size

# Multi-speaker LibriTTS. Voice models are large and are not committed; the
# generated bank is, so building or running the app never needs this download.
VOICE_URL = (
    "https://github.com/rhasspy/piper/releases/download/v0.0.2/"
    "voice-en-us-libritts-high.tar.gz"
)
VOICE_FILE = "en-us-libritts-high.onnx"
CACHE_DIR = Path(__file__).parent.parent / ".cache" / "piper"

# Speaker 224 of 904, picked by measuring every 14th speaker: its pitch sits at
# the centre of the gender-neutral band on real bank tokens (median 171 Hz) and
# holds the tightest spread across them, so clips sound like one person.
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


def speech_span(x: np.ndarray, floor=0.02) -> tuple[int, int] | None:
    loud = np.where(np.abs(x) > floor)[0]
    return (int(loud[0]), int(loud[-1])) if len(loud) else None


def quiet_runs(x: np.ndarray, floor: float, smooth: float) -> list[tuple[int, int]]:
    """Stretches quiet enough, for long enough, to be a pause."""
    window = max(1, int(smooth * SOURCE_RATE))
    quietness = np.convolve(
        (np.abs(x) < floor).astype(float), np.ones(window) / window, mode="same"
    ) > 0.85

    runs, start = [], None
    for i, is_quiet in enumerate(quietness):
        if is_quiet and start is None:
            start = i
        elif not is_quiet and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(quietness)))
    return runs


def split_carrier(x: np.ndarray, solo_length: int) -> np.ndarray | None:
    """
    Cut "phrase, phrase." at the comma and return the first half.

    The comma pause is short and varies with the phrase, so this tries
    progressively higher silence floors. Two checks reject a bad cut: the
    halves must be about equal, and each must be about as long as the phrase
    rendered on its own — without the second check, a multi-word phrase can be
    split inside itself, leaving one "half" holding a repetition and a bit.
    """
    span = speech_span(x)
    if span is None:
        return None
    lo, hi = span
    margin = int(0.06 * SOURCE_RATE)

    for floor, smooth in ((0.02, 0.015), (0.035, 0.010), (0.05, 0.008)):
        runs = [(a, b) for a, b in quiet_runs(x, floor, smooth) if a > lo + margin and b < hi - margin]
        if not runs:
            continue
        a, b = max(runs, key=lambda r: r[1] - r[0])
        middle = (a + b) // 2
        first, second = x[lo:middle], x[middle:hi]
        if min(len(first), len(second)) / max(len(first), len(second)) < 0.6:
            continue
        if not 0.65 <= len(first) / solo_length <= 1.55:
            continue
        return first
    return None


def synthesise_clip(voice, text: str) -> tuple[np.ndarray, bool]:
    """
    Render a clip with mid-sentence prosody where possible.

    Spoken alone, every clip ends on a falling contour, and stringing those
    together is what makes assembled speech sound like a list being read out
    rather than a person talking. Saying the phrase twice and keeping the first
    gives a version whose fall lands on the discarded copy instead.

    Returns the clip and whether the carrier worked; when the repetitions
    cannot be separated cleanly the clip keeps its standalone rendering,
    which is merely less natural, not wrong.
    """
    solo = synthesise(voice, text)
    span = speech_span(solo)
    if span is None:
        return solo, False

    carrier = split_carrier(synthesise(voice, f"{text}, {text}."), span[1] - span[0])
    return (carrier, True) if carrier is not None else (solo, False)


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


def main() -> int:
    tokens_path, wav_path, index_path = (Path(p) for p in sys.argv[1:4])
    # [[clip id, text to synthesise], ...] — they differ for slot clips, whose id
    # encodes the slot and value while the text is how it is actually said.
    jobs = json.loads(tokens_path.read_text())
    tokens = [job[0] for job in jobs]

    voice = load_voice()

    clips: dict[str, np.ndarray] = {}
    standalone: list[str] = []
    for i, (token, spoken_as) in enumerate(jobs, 1):
        raw, carried = synthesise_clip(voice, spoken_as)
        clips[token] = process(raw)
        if not carried:
            standalone.append(token)
        note = "" if token == spoken_as else f'  (as "{spoken_as}")'
        flag = "" if carried else "   [rendered alone — has a terminal fall]"
        print(f"  [{i:3}/{len(jobs)}] {token}{note}{flag}", flush=True)

    index: dict[str, list[int]] = {}
    pieces: list[np.ndarray] = []
    cursor = 0
    # A few silent samples between clips stop one bleeding into the next.
    spacer = np.zeros(int(TARGET_RATE * 0.01))

    for token in tokens:
        clip = clips[token]
        index[token] = [cursor, len(clip)]
        pieces.append(clip)
        pieces.append(spacer)
        cursor += len(clip) + len(spacer)

    sprite = np.concatenate(pieces)
    pcm = np.clip(sprite, -1.0, 1.0)
    pcm = (pcm * 32767).astype("<i2")

    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TARGET_RATE)
        w.writeframes(pcm.tobytes())

    index_path.write_text(
        json.dumps({"sampleRate": TARGET_RATE, "clips": index}, separators=(",", ":"))
    )

    seconds = len(sprite) / TARGET_RATE
    print(
        f"\n{len(tokens)} clips, {seconds:.1f}s total, "
        f"{wav_path.stat().st_size / 1024:.0f} KB wav, "
        f"{index_path.stat().st_size / 1024:.1f} KB index"
    )
    carried = len(tokens) - len(standalone)
    print(f"{carried}/{len(tokens)} clips took mid-sentence prosody from the carrier")
    if standalone:
        print(f"rendered alone: {', '.join(standalone)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
