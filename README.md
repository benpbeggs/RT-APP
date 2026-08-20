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
Switching type also re-rolls the aerodrome, so a CTAF flight uses a non-towered field and a
controlled flight a towered one. Both give a complete sequence — 18 calls on a CTAF, 19 controlled.

## Modes

- **Trainer** — walks the calls of a flight in chronological order of operations: startup →
  taxi → departure → en route → inbound → circuit → landing, with emergency and general phrases
  as separate non-sequential groups. Each scenario shows a plan-view diagram of where the aircraft
  is when the call is made, and you answer either by typing or by pressing **Transmit** and
  speaking. The answer is checked element by element and the model call revealed with
  text-to-speech playback. One aircraft and aerodrome is used for the whole flight, so the
  sequence hangs together; **New flight** rolls a fresh one.
- **Reference** — every call grouped by phase of flight, in the same order, each with its diagram.
- **Sources & Accuracy** — what the phrase library is based on and its limitations.

## Radio audio

Playback sounds like a VHF transmission rather than a phone assistant: the PTT click, a burst of
squelch as the carrier opens, a faint hiss under the voice, a squelch tail and a release click.

The voice is **recorded, not synthesised at playback**. The Web Speech API exposes no audio node
for synthesised speech, so a live TTS voice cannot be filtered in the browser — which is why the
voice is rendered ahead of time instead, put through the comms chain offline, and played back as
audio. Processing (`scripts/build-phrase-bank.py`) is a 300–2900 Hz windowed-sinc bandpass, an
envelope-following compressor, `tanh` saturation for transmitter grit, and a resample to 8 kHz —
authentic for a signal band-limited to 2.9 kHz, and it halves the file. Measured result: 99.8% of
the bank's energy sits inside the passband.

Because calls are generated — the callsign, aerodrome, runway, altitude and distance all vary —
whole sentences cannot be pre-recorded. Instead each **token** is recorded once and sentences are
assembled at playback, the way automated aeronautical audio (ATIS and the like) is built:

- `src/lib/lexicon.ts` is the single source of truth: the token list, and the `tokenize()` that
  turns a call into clips. Registrations become phonetics (`VH-ABC` → victor hotel alpha bravo
  charlie) and numbers take aviation forms — `13` reads digit-by-digit ("one three") while `2500`
  groups ("two thousand five hundred").
- `npm run build:audio` renders every token with Piper and packs them into one WAV sprite
  (`src/assets/phrase-bank.wav`, 116 clips, 86 s, 1.3 MB) plus a JSON index of offsets. The app
  fetches it once, decodes it once, and slices clips out at playback.
- `npm run check:audio` proves every call the app can generate is fully speakable — it sweeps all
  9,300 combinations of scenario and vocabulary and fails on any token the bank lacks. **Run it
  after touching any model call**, then rebuild the bank if it reports a gap.

### The voice

The bank is spoken by [Piper](https://github.com/rhasspy/piper), a neural TTS, using the
multi-speaker LibriTTS model. A formant synthesiser (espeak and friends) sounds unmistakably
robotic no matter how it is filtered afterwards, and radio processing does not hide it; a neural
model trained on real speech does not have that problem.

Being multi-speaker also makes the voice choosable, so it is picked by measurement rather than by
ear. `npm run check:voice --sweep` walks the model's 904 speakers, keeps those whose median
fundamental falls in the **155–190 Hz** androgynous band — between typical male (~110 Hz) and
typical female (~210 Hz) — and prefers the one holding the tightest spread across tokens, so the
assembled call sounds like one person rather than a chorus. That selected **speaker 224**, median
**174 Hz**. Plain `npm run check:voice` re-checks the current pick and fails if it drifts out of
band.

Two things to know if you re-pick: measure against **single tokens, not sentences**, because each
clip is rendered alone and picks up utterance-final falling intonation, which reads lower than
running prose does. And measure **before** processing: the bank is highpassed at 300 Hz, which
removes the fundamental outright. The pitch still reads correctly through the harmonics — the
missing-fundamental effect, exactly as real radio and telephone audio behave — but it cannot be
recovered from the processed file.

Regenerating the bank needs `pip install piper-tts` and `python3` with `numpy`. The voice model is
about 120 MB, so it is not committed — the build downloads it once into `.cache/piper/`. Building
or running the app needs none of that: the generated sprite is committed.

If the bank cannot be loaded, or a call somehow needs a token it lacks, playback falls back to the
speech synthesiser so a call is never silently dropped. The **Radio FX** toggle in the header
switches to plain unprocessed speech, which is easier to learn the wording from; the choice
persists in `localStorage`.

## Voice answers

Answering out loud uses the browser's SpeechRecognition API (Chrome, Edge, and Safari; Firefox
does not implement it). Because speech comes back as it is *spoken* rather than as it is
*written*, answers are normalised before scoring — `src/lib/scenario.ts` folds phonetic-alphabet
runs into letters ("victor hotel alpha bravo charlie" → `VH-ABC`), aviation digit words into
numbers ("one eight" → `18`), and spoken altitudes into figures ("two thousand five hundred" →
`2500`), so a spoken answer scores the same as a typed one.

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
