# RT Trainer

A web app for practicing Australian radiotelephony (RT) — the standard radio calls VFR pilots
make to ATC and on CTAF frequencies.

## Aerodrome type

A dropdown in both Trainer and Reference switches the whole app between **CTAF (non-towered)** and
**Controlled (towered)**, because the two are different disciplines: on a CTAF you *broadcast* your
intentions to other traffic ("Traffic, …, taxiing runway 18"), while in controlled airspace you
*request* and *read back* clearances. Each call in `src/data/phraseology.ts` is tagged with the
aerodrome types it belongs at, and calls that read the same at both (position reports, PAN
PAN/MAYDAY, general phrases) use a `{station}` placeholder that resolves to "Traffic" or "Tower".
Switching type also switches flight, so a CTAF flight uses a non-towered field and a controlled
flight a towered one. Both give a complete sequence — 18 calls on a CTAF, 19 controlled.

## Modes

- **Trainer** — walks the calls of a flight in chronological order of operations: startup →
  taxi → departure → en route → inbound → circuit → landing, with emergency and general phrases
  as separate non-sequential groups. Each scenario shows a plan-view diagram of where the aircraft
  is when the call is made, and you answer either by typing or by pressing **Transmit** and
  speaking. The answer is checked element by element, and the model call is revealed with a
  recording of it. One flight is used throughout, so the sequence hangs together; **New flight**
  moves to another.
- **Reference** — every call grouped by phase of flight, in the same order, each with its diagram.
- **Sources & Accuracy** — what the phrase library is based on and its limitations.

## Radio audio

Playback sounds like a VHF transmission rather than a phone assistant: the PTT click, a burst of
squelch as the carrier opens, a faint hiss under the voice, a squelch tail and a release click.

**Every call is recorded whole** — one continuous utterance, rendered ahead of time by a neural TTS
and put through the comms chain offline. That is the single decision that makes it sound spoken.
Earlier versions assembled calls from recorded pieces, first one per word and then one per phrase,
and both sounded like a machine reading a list: every join is a seam, and intonation that should
run across a whole sentence gets chopped into fragments that each rise and fall on their own.

A real flight simulator ([MSFS synthesises ATC at runtime with a neural TTS
engine](https://www.flightsimulator.com/)) sidesteps this by generating each transmission in full
as it is needed. A browser cannot do that: the Web Speech API exposes no audio node for
synthesised speech, so a live TTS voice cannot be filtered, and a neural voice model small enough
to ship to the browser does not exist (Piper's smallest is 60 MB before the ONNX runtime).
Rendering the same complete utterances ahead of time gets the same result within those limits.

The cost is that the calls have to be a finite set. `src/data/flights.ts` holds **twelve fixed
flights**, one per aerodrome — each with its own callsign, runway, QNH and the rest — and every
scenario is recorded for each flight it suits. That is 222 recordings. Randomised values would
mean recording combinations without end; twelve distinct flights is ample for drilling call
structure, and "New flight" moves between them.

Processing (`scripts/build-call-bank.py`) is a 300–2900 Hz windowed-sinc bandpass, an
envelope-following compressor, gentle `tanh` saturation for transmitter grit, and a resample to
8 kHz — authentic for a signal band-limited to 2.9 kHz. Recordings are encoded as 24 kbps mono MP3
and written end to end into `src/assets/call-bank.bin` with a JSON index of byte offsets, so the
app makes one fetch and decodes a call the first time it is played.

- `npm run build:audio` renders the bank. Needs `pip install piper-tts lameenc` and `numpy`; the
  voice model downloads once into `.cache/piper`. Building or running the app needs none of it —
  the bank is committed.
- `npm run check:audio` fails if any call lacks a recording, if a template references something a
  flight has no value for, or if the bank on disk has drifted from the code. **Run it after
  touching any model call or flight**, or the app will quietly fall back to the browser's
  synthesiser.

### The voice

The bank is spoken by [Piper](https://github.com/rhasspy/piper), a neural TTS, using the
multi-speaker LibriTTS model. A formant synthesiser (espeak and friends) sounds unmistakably
robotic no matter how it is filtered afterwards; a model trained on real speech does not.

Being multi-speaker also makes the voice choosable, so it is picked by measurement rather than by
ear. `npm run check:voice -- --sweep` walks the model's 904 speakers, keeps those whose median
fundamental falls in the target range, and prefers the one holding the tightest spread across
utterances, so the calls sound like one controller rather than several.

The voice is male: the target is **95–145 Hz**, where typical male speech centres near 120 Hz
(typical female is near 210 Hz, with an ambiguous band around 155–190 Hz between). That selected
**speaker 392**, median **120 Hz** and a spread of only 118–125 Hz across whole calls. Plain
`npm run check:voice` re-checks the current pick and fails if it drifts out of range. Change
`TARGET_LOW`/`TARGET_HIGH` in `scripts/check-voice.py` and re-sweep to move it.

Measure on whole calls, not isolated words, and **before** processing: the bank is highpassed at
300 Hz, which removes the fundamental outright. The pitch still reads through the harmonics — the missing-fundamental
effect, exactly as real radio and telephone audio behave — but it cannot be recovered from the
processed file.

The **Radio FX** toggle in the header drops the click, squelch and hiss. It plays the same
recording either way — it does not fall back to a different voice.

## Voice answers

Answering out loud uses the browser's SpeechRecognition API (Chrome, Edge, and Safari; Firefox
does not implement it). Because speech comes back as it is *spoken* rather than as it is
*written*, answers are normalised before scoring — `src/lib/scenario.ts` folds phonetic-alphabet
runs into letters ("alpha bravo charlie" → `ABC`), aviation digit words into numbers ("one eight"
→ `18`), and spoken altitudes into figures ("two thousand five hundred" → `2500`), so a spoken
answer scores the same as a typed one.

It also drops the **VH-** nationality prefix, which is written but not spoken: on the air a
callsign is the type and the last three letters — "Jabiru Juliett Tango Romeo", not "Jabiru Victor
Hotel Juliett Tango Romeo". The written form, the spoken form and the prefix said anyway all match
the same answer.

The microphone needs a secure context (`https://` or `localhost`) and, in an embedded page, a
`microphone` permission policy — if it is blocked the app says so and you can type instead.

## Content basis and accuracy

The phrase library follows the structure and conventions of:

- CASA Visual Flight Rules Guide (VFRG), Chapter 5 — Radio Procedures
- Airservices Australia AIP, ENR 1.1 — Communication services / position reporting
- ICAO Doc 4444 (PANS-ATM) standard phraseology

It was **not** built by fetching the live official documents — see `src/data/sources.ts` for the
full accuracy notice, also shown in-app under "Sources & Accuracy". Before relying on this for
real-world radio discipline, cross-check against the current CASA VFRG and Airservices AIP.

All phrase content lives in `src/data/phraseology.ts` — update wording there if it drifts from a
newer official revision.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run lint      # oxlint
```
