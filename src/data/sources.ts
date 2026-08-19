export interface SourceRef {
  name: string;
  detail: string;
}

export const SOURCES: SourceRef[] = [
  {
    name: "CASA Visual Flight Rules Guide (VFRG)",
    detail:
      "Chapter 5, 'Radio Procedures' — the primary plain-English guide to standard radio phraseology for VFR pilots in Australia.",
  },
  {
    name: "Airservices Australia AIP, ENR 1.1",
    detail: "Communication services and position reporting requirements.",
  },
  {
    name: "ICAO Doc 4444 (PANS-ATM)",
    detail:
      "The international standard phraseology that Australian procedures are built on, with well-known local variations (e.g. CTAF broadcast procedures).",
  },
];

export const ACCURACY_DISCLAIMER = `This trainer's phrase library was written to match the structure and
conventions of the CASA VFRG, the Airservices Australia AIP, and ICAO Doc 4444 — it was not generated
by fetching the live official documents (this build environment's network policy blocks access to
casa.gov.au, airservicesaustralia.com and similar sites), so it has not been verified word-for-word
against the current published revision. VFRG and AIP wording is amended periodically (VFRG versions,
AIRAC cycles). Treat this app as a practice aid for call structure and radio discipline, not as an
authoritative reference — always confirm current phraseology against the latest CASA VFRG and
Airservices AIP before relying on it operationally.

Aerodrome names in the scenarios are illustrative scenery for the practice call, not a statement
about any real field. Airspace classification and tower hours change — check ERSA and current
charts for whether a given aerodrome is towered or a CTAF before you fly there.`;
