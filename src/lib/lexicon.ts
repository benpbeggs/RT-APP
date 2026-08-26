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

/**
 * How a value is said. Levels group into magnitudes the way a pilot reads them
 * ("two thousand five hundred"); runways, QNH and distances go digit by digit,
 * which is the standard and also how they are read back.
 */
export function spokenValue(slot: string, value: string): string {
  switch (slot) {
    case "callsign": {
      // "Cessna VH-ABC" -> "Cessna alpha bravo charlie".
      //
      // VH- is the Australian nationality prefix. It is written but not
      // spoken: on the air the callsign is the type and the last three
      // letters, so saying "victor hotel" as well is wrong.
      const [type, registration] = value.split(" VH-");
      const letters = registration
        .toLowerCase()
        .split("")
        .map((c) => PHONETIC_ALPHABET[c])
        .join(" ");
      return `${type} ${letters}`;
    }
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
