// Turning a written call into the words that are actually said.
//
// The bank records each call as one continuous utterance, so nothing here
// splits anything up — this only exists because a call is written the way it
// appears on a page ("runway 18", "QNH 1013") and spoken quite differently
// ("runway one eight", "QNH one zero one three"). The build renders the spoken
// form; the app still shows the written one.

import { SCENARIOS } from "../data/phraseology";
import { FLIGHTS, FLIGHTS_BY_TYPE, callId, type Flight } from "../data/flights";

/** Spoken forms of the phonetic alphabet, keyed by letter. */
export const PHONETIC_ALPHABET: Record<string, string> = {
  a: "alpha", b: "bravo", c: "charlie", d: "delta", e: "echo", f: "foxtrot",
  g: "golf", h: "hotel", i: "india", j: "juliett", k: "kilo", l: "lima",
  m: "mike", n: "november", o: "oscar", p: "papa", q: "quebec", r: "romeo",
  s: "sierra", t: "tango", u: "uniform", v: "victor", w: "whiskey",
  x: "xray", y: "yankee", z: "zulu",
};

/** Aviation digit names. Nine is "niner" on the air. */
const DIGIT_WORDS = [
  "zero", "one", "two", "three", "four",
  "five", "six", "seven", "eight", "niner",
];

/** Respellings for anything the synthesiser gets wrong, by written form. */
export const PRONUNCIATIONS: Record<string, string> = {
  // Default stresses the first syllable ("LAT-robe"); it is "luh-TROBE".
  "Latrobe Valley": "La-trobe Valley",
};

const digits = (raw: string) => raw.split("").map((d) => DIGIT_WORDS[Number(d)]).join(" ");

const capitalise = (word: string) => word[0].toUpperCase() + word.slice(1);

/**
 * A callsign as it goes over the air: "Piper VH-SYV" -> "Piper Sierra Yankee
 * Victor".
 *
 * Two things happen here. The VH- nationality prefix is dropped: it belongs to
 * the registration — which is why the scenario briefing still names the
 * aircraft in full — but not to the callsign on the air. And the registration
 * is spelled out phonetically, because that is what is said, and a written
 * radio call should read as it is spoken.
 */
export function radioCallsign(callsign: string): string {
  const [type, registration] = callsign.split(" VH-");
  if (registration === undefined) return callsign;

  const letters = registration
    .toLowerCase()
    .split("")
    .map((c) => PHONETIC_ALPHABET[c])
    .filter(Boolean)
    .map(capitalise)
    .join(" ");

  return `${type} ${letters}`;
}

/**
 * How a value is said. Levels group into magnitudes the way a pilot reads them
 * ("two thousand five hundred"); runways, QNH and distances go digit by digit,
 * which is the standard and also how they are read back.
 */
export function spokenValue(slot: string, value: string): string {
  switch (slot) {
    // A callsign reads the same way it is said, so both come from one place.
    case "callsign":
      return radioCallsign(value);
    case "altitude": {
      const n = Number(value);
      const thousands = Math.floor(n / 1000);
      const hundreds = (n % 1000) / 100;
      const parts = [DIGIT_WORDS[thousands], "thousand"];
      if (hundreds > 0) parts.push(DIGIT_WORDS[hundreds], "hundred");
      return parts.join(" ");
    }
    case "runway":
    case "qnh":
    case "distanceNm":
    case "etaMin":
      return digits(value);
    case "pob":
      return DIGIT_WORDS[Number(value)];
    case "aerodrome":
      return PRONUNCIATIONS[value] ?? value;
    default:
      return value;
  }
}

/** The whole call, written the way it should be spoken. */
export function spokenSentence(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, slot: string) => {
    const value = values[slot];
    return value === undefined ? whole : spokenValue(slot, value);
  });
}

/** Every call the bank must record: each scenario, for each flight it suits. */
export function allCalls(): { id: string; text: string }[] {
  const calls: { id: string; text: string }[] = [];
  for (const scenario of SCENARIOS) {
    for (const type of scenario.aerodromeTypes) {
      for (const flight of FLIGHTS_BY_TYPE[type]) {
        calls.push({
          id: callId(scenario.id, flight.id),
          text: spokenSentence(scenario.modelCall, flight as unknown as Record<string, string>),
        });
      }
    }
  }
  return calls;
}

export const ALL_CALLS = allCalls();

export type { Flight };
export { FLIGHTS, callId };
