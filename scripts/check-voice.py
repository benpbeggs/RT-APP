#!/usr/bin/env python3
"""Check the phrase-bank voice sits in the gender-neutral pitch band.

Perceived voice gender tracks fundamental frequency closely: typical male
speech centres near 110 Hz, typical female near 210 Hz, and the ambiguous band
between is roughly 155-190 Hz. This measures what the build voice actually
produces so "neutral" is a number rather than an opinion.

The voice model is multi-speaker, and the speaker in build-phrase-bank.py was
chosen with this measurement: sweeping every 14th of the 904 speakers, keeping
those inside the band, then preferring the one whose pitch stays most
consistent across tokens so the bank sounds like one person.

Measured on raw synthesiser output, before processing — the bank is highpassed
at 300 Hz, which strips the fundamental entirely (pitch still reads through the
harmonics, but it cannot be measured from the processed file).

Pass --sweep to re-run the speaker search instead of checking the current pick.

Usage: python3 scripts/check-voice.py [--sweep]
"""

import importlib.util
import io
import sys
import wave
from pathlib import Path

import numpy as np


def _load_build_script():
    """Share the build script's voice settings, despite its hyphenated name."""
    path = Path(__file__).parent / "build-phrase-bank.py"
    spec = importlib.util.spec_from_file_location("phrase_bank_build", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bank = _load_build_script()

NEUTRAL_LOW, NEUTRAL_HIGH = 155.0, 190.0

# A spread of real bank tokens: place names, phonetics, digits and phrases.
SAMPLE = [
    "bankstown", "traffic", "cessna", "victor", "downwind", "runway", "alpha",
    "niner", "cleared for takeoff", "radio check", "mayday", "holding point",
    "two", "final", "qnh",
]


def f0_track(x: np.ndarray, rate: int) -> np.ndarray:
    """Autocorrelation pitch track over voiced frames."""
    win, hop = int(0.04 * rate), int(0.01 * rate)
    lo, hi = int(rate / 350), int(rate / 70)
    found = []
    for i in range(0, len(x) - win, hop):
        frame = x[i : i + win]
        if np.sqrt(np.mean(frame**2)) < 0.03:
            continue
        frame = frame - frame.mean()
        ac = np.correlate(frame, frame, "full")[len(frame) - 1 :]
        if ac[0] <= 0:
            continue
        ac /= ac[0]
        seg = ac[lo:hi]
        if len(seg) == 0:
            continue
        lag = lo + int(np.argmax(seg))
        if ac[lag] < 0.3:
            continue
        found.append(rate / lag)
    return np.array(found)


def speak(voice, text: str, speaker: int) -> tuple[np.ndarray, int]:
    from piper import SynthesisConfig

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        voice.synthesize_wav(
            text, w,
            syn_config=SynthesisConfig(speaker_id=speaker, length_scale=bank.LENGTH_SCALE),
        )
    buffer.seek(0)
    with wave.open(buffer) as w:
        rate = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float) / 32768
    return x, rate


def token_pitches(voice, speaker: int) -> list[float]:
    values = []
    for token in SAMPLE:
        x, rate = speak(voice, token, speaker)
        track = f0_track(x, rate)
        if len(track):
            values.append(float(np.median(track)))
    return values


def sweep(voice) -> int:
    """Re-run the speaker search across the model's speakers."""
    print("Sweeping speakers (every 14th)…\n")
    best = []
    for speaker in range(0, 904, 14):
        values = token_pitches(voice, speaker)
        if len(values) < len(SAMPLE) // 2:
            continue
        median = float(np.median(values))
        spread = max(values) - min(values)
        if NEUTRAL_LOW <= median <= NEUTRAL_HIGH:
            best.append((spread, median, speaker))
            print(f"  speaker {speaker:4}  median {median:6.1f} Hz  spread {spread:5.1f}")
    best.sort()
    print("\nIn band, tightest spread first:")
    for spread, median, speaker in best[:8]:
        print(f"  speaker {speaker:4}  median {median:6.1f} Hz  spread {spread:5.1f} Hz")
    return 0


def main() -> int:
    voice = bank.load_voice()

    if "--sweep" in sys.argv:
        return sweep(voice)

    values = token_pitches(voice, bank.SPEAKER_ID)
    for token, f0 in zip(SAMPLE, values):
        print(f"  {token:22} {f0:6.1f} Hz")

    if not values:
        print("no voiced frames measured")
        return 1

    median = float(np.median(values))
    print(f"\nspeaker {bank.SPEAKER_ID}, median F0 across {len(values)} tokens: {median:.1f} Hz")
    print(f"gender-neutral band:                        {NEUTRAL_LOW:.0f}-{NEUTRAL_HIGH:.0f} Hz")
    print(f"spread across tokens:                       {min(values):.1f}-{max(values):.1f} Hz")

    if not NEUTRAL_LOW <= median <= NEUTRAL_HIGH:
        side = "male" if median < NEUTRAL_LOW else "female"
        print(f"\nFAIL — reads as {side}. Re-run with --sweep to pick another speaker.")
        return 1

    print("\nOK — voice sits in the gender-neutral band.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
