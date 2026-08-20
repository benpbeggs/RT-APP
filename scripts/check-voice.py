#!/usr/bin/env python3
"""Check the phrase-bank voice sits in the gender-neutral pitch band.

Perceived voice gender tracks fundamental frequency closely: typical male
speech centres near 110 Hz, typical female near 210 Hz, and the ambiguous band
between is roughly 155-190 Hz. This measures what the build voice actually
produces so "neutral" is a number rather than an opinion.

Measured on raw espeak-ng output, before processing — the bank is highpassed at
300 Hz, which strips the fundamental entirely (pitch still reads through the
harmonics, but it cannot be measured from the processed file).

Usage: python3 scripts/check-voice.py
"""

import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

VOICE = "en+rt-neutral"
NEUTRAL_LOW, NEUTRAL_HIGH = 155.0, 190.0

# A spread of real bank tokens: place names, phonetics, digits and phrases.
SAMPLE = [
    "bankstown", "traffic", "cessna", "victor", "downwind", "runway", "alpha",
    "niner", "cleared for takeoff", "radio check", "mayday", "holding point",
    "two", "final", "qnh",
]


def f0_median(x: np.ndarray, rate: int) -> float | None:
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
    return float(np.median(found)) if found else None


def main() -> int:
    values = []
    with tempfile.TemporaryDirectory() as tmp:
        scratch = Path(tmp) / "clip.wav"
        for token in SAMPLE:
            subprocess.run(
                ["espeak-ng", "-v", VOICE, "-s", "158", "-a", "170", "-g", "1",
                 "-w", str(scratch), token],
                check=True, capture_output=True,
            )
            with wave.open(str(scratch)) as w:
                rate = w.getframerate()
                x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float) / 32768
            f0 = f0_median(x, rate)
            if f0 is not None:
                values.append(f0)
                print(f"  {token:22} {f0:6.1f} Hz")

    if not values:
        print("no voiced frames measured — is the rt-neutral variant installed?")
        return 1

    median = float(np.median(values))
    print(f"\nmedian F0 across {len(values)} tokens: {median:.1f} Hz")
    print(f"gender-neutral band:              {NEUTRAL_LOW:.0f}-{NEUTRAL_HIGH:.0f} Hz")

    if not NEUTRAL_LOW <= median <= NEUTRAL_HIGH:
        side = "male" if median < NEUTRAL_LOW else "female"
        print(f"\nFAIL — reads as {side}. Adjust `pitch` in scripts/espeak/rt-neutral.")
        return 1

    print("\nOK — voice sits in the gender-neutral band.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
