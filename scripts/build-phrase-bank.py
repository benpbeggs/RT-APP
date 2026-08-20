#!/usr/bin/env python3
"""Render the phrase bank: one recorded clip per token, packed into a sprite.

Each token in src/lib/lexicon.ts is synthesised with espeak-ng, put through a
VHF-comms processing chain, resampled to 8 kHz and packed into a single WAV
with a JSON index of sample offsets. The app fetches one file, decodes it once
and slices clips out of it at playback.

Processing the voice offline is the whole point of the exercise: the Web Speech
API gives no audio node for synthesised speech, so a live TTS voice cannot be
filtered in the browser. A recorded clip can be.

Usage: python3 scripts/build-phrase-bank.py tokens.json out.wav out.json
"""

import json
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

SOURCE_RATE = 22050  # what espeak-ng emits
TARGET_RATE = 8000  # plenty for a 2.9 kHz-limited signal, and halves the size

# A gender-neutral voice — see scripts/espeak/rt-neutral for how it was chosen.
VARIANT_NAME = "rt-neutral"
VOICE = f"en+{VARIANT_NAME}"

# The comms passband. Real VHF aeronautical audio is roughly 300-3000 Hz.
HIGHPASS_HZ = 300.0
LOWPASS_HZ = 2900.0


def install_variant() -> None:
    """Put the neutral voice variant where espeak-ng will find it."""
    banner = subprocess.run(
        ["espeak-ng", "--version"], check=True, capture_output=True, text=True
    ).stdout
    if "Data at: " not in banner:
        raise SystemExit("could not locate espeak-ng data directory")
    data_dir = Path(banner.split("Data at: ")[1].strip())

    source = Path(__file__).parent / "espeak" / VARIANT_NAME
    target = data_dir / "voices" / "!v" / VARIANT_NAME
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source.read_text())
    except PermissionError:
        raise SystemExit(
            f"cannot write {target}\n"
            f"Install the voice variant manually, then re-run:\n"
            f"  sudo cp {source} {target}"
        ) from None


def synthesise(text: str, path: Path) -> None:
    """espeak-ng at a controller's cadence: brisk and level."""
    subprocess.run(
        [
            "espeak-ng",
            "-v", VOICE,
            "-s", "158",   # words per minute
            "-a", "170",   # amplitude
            "-g", "1",     # minimal word gap; spacing is handled at playback
            "-w", str(path),
            text,
        ],
        check=True,
        capture_output=True,
    )


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2
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


def compress(x: np.ndarray, rate: int, threshold=0.22, ratio=5.0) -> np.ndarray:
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

    # Soft saturation — the slight grit of an overdriven transmitter.
    x = np.tanh(x * 2.1) / np.tanh(2.1)

    x = resample_linear(x, SOURCE_RATE, TARGET_RATE)

    # Re-limit after the non-linearity, which generates new harmonics.
    taps2 = fir_bandpass(127, HIGHPASS_HZ, min(LOWPASS_HZ, TARGET_RATE / 2 * 0.92), TARGET_RATE)
    x = np.convolve(x, taps2, mode="same")

    x = trim_silence(x)
    peak = np.max(np.abs(x))
    if peak > 0:
        x = x / peak * 0.82
    return x


def main() -> int:
    tokens_path, wav_path, index_path = (Path(p) for p in sys.argv[1:4])
    # [[token id, text to synthesise], ...] — they differ where espeak needs
    # a respelling to pronounce the token correctly.
    jobs = json.loads(tokens_path.read_text())
    tokens = [job[0] for job in jobs]

    install_variant()

    clips: dict[str, np.ndarray] = {}
    with tempfile.TemporaryDirectory() as tmp:
        scratch = Path(tmp) / "clip.wav"
        for i, (token, spoken_as) in enumerate(jobs, 1):
            synthesise(spoken_as, scratch)
            clips[token] = process(read_wav(scratch))
            note = "" if token == spoken_as else f'  (as "{spoken_as}")'
            print(f"  [{i:3}/{len(jobs)}] {token}{note}", flush=True)

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
    return 0


if __name__ == "__main__":
    sys.exit(main())
