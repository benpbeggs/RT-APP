# RT Trainer

A web app for practicing Australian radiotelephony (RT) — the standard radio calls VFR pilots
make to ATC and on CTAF frequencies.

## Modes

- **Trainer** — presents a randomized scenario (aerodrome, aircraft, position, etc.) and asks you
  to type the radio call you'd make. Your answer is checked against the key elements the call
  should contain, and the model call is revealed with an optional text-to-speech playback.
- **Reference** — a searchable, filterable library of standard calls by category (taxi, departure,
  circuit, position reports, emergency phraseology, etc.).
- **Sources & Accuracy** — states what the phrase library is based on and its limitations.

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
