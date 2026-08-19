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
