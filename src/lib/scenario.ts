import type { AerodromeType, PhaseId, PositionKind, ScenarioTemplate } from "../data/phraseology";
import { SCENARIOS } from "../data/phraseology";
import type { SpokenCall } from "./radio";

import { FLIGHTS_BY_TYPE, callId, type Flight } from "../data/flights";

/**
 * The values a call is about. One flight, fixed — every call is recorded whole
 * for a specific flight, so these come from a set rather than being rolled at
 * random. See src/data/flights.ts.
 */
export type GeneratedValues = Flight;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** One flight, reused across a whole sequence so it hangs together. */
export function generateValues(aerodromeType: AerodromeType = "ctaf"): GeneratedValues {
  return pick(FLIGHTS_BY_TYPE[aerodromeType]);
}

export function fill(template: string, values: GeneratedValues): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (values as unknown as Record<string, string>)[key];
    return v ?? `{${key}}`;
  });
}

// ---------------------------------------------------------------------------
// Answer normalisation
//
// Speech recognition returns what was *said*, not what would be *written*: a
// callsign comes back as "victor hotel alpha bravo charlie", a runway as
// "one eight", an altitude as "two thousand five hundred". Both the trainee's
// answer and the expected element are reduced to the same canonical form so a
// spoken answer scores the same as a typed one.
// ---------------------------------------------------------------------------

const PHONETIC: Record<string, string> = {
  alpha: "a", alfa: "a", bravo: "b", charlie: "c", delta: "d", echo: "e",
  foxtrot: "f", golf: "g", hotel: "h", india: "i", juliet: "j", juliett: "j",
  kilo: "k", lima: "l", mike: "m", november: "n", oscar: "o", papa: "p",
  quebec: "q", romeo: "r", sierra: "s", tango: "t", uniform: "u", victor: "v",
  whiskey: "w", whisky: "w", xray: "x", yankee: "y", zulu: "z",
};

const DIGIT_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", tree: "3", four: "4", fower: "4",
  five: "5", fife: "5", six: "6", seven: "7", eight: "8", nine: "9", niner: "9",
};

function isNumeric(token: string): boolean {
  return /^\d+$/.test(token);
}

/** Fold "two thousand five hundred" into "2500", "three hundred" into "300". */
function foldNumberWords(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const asDigit = DIGIT_WORDS[tokens[i]] ?? (isNumeric(tokens[i]) ? tokens[i] : null);
    if (asDigit === null) {
      out.push(tokens[i]);
      i += 1;
      continue;
    }

    let value = Number(asDigit);
    let consumed = 1;

    if (tokens[i + consumed] === "thousand") {
      value *= 1000;
      consumed += 1;
      const nextDigit = DIGIT_WORDS[tokens[i + consumed]] ?? null;
      if (nextDigit !== null && tokens[i + consumed + 1] === "hundred") {
        value += Number(nextDigit) * 100;
        consumed += 2;
      }
    } else if (tokens[i + consumed] === "hundred") {
      value *= 100;
      consumed += 1;
    }

    out.push(consumed > 1 ? String(value) : asDigit);
    i += consumed;
  }
  return out;
}

/**
 * Collapse a run of 3+ consecutive phonetic words into the letters they spell,
 * so "victor hotel alpha bravo charlie" becomes "vhabc". A run of 1-2 is left
 * alone — "information alpha" and "via taxiway alpha" mean the word, not "a".
 */
function foldPhonetics(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let run = 0;
    while (i + run < tokens.length && PHONETIC[tokens[i + run]] !== undefined) run += 1;

    if (run >= 3) {
      let letters = "";
      for (let k = 0; k < run; k++) letters += PHONETIC[tokens[i + k]];
      out.push(letters);
      i += run;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out;
}

/** Join adjacent single digits: "one eight" -> "18". */
function foldDigitRuns(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    if (isNumeric(token) && prev !== undefined && isNumeric(prev)) {
      out[out.length - 1] = prev + token;
    } else {
      out.push(token);
    }
  }
  return out;
}

/**
 * Reduce text to a comparable form. Whitespace is dropped entirely at the end
 * so "VH-ABC" and "victor hotel alpha bravo charlie" converge on "vhabc".
 */
export function canonicalize(text: string): string {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return foldDigitRuns(foldPhonetics(foldNumberWords(tokens))).join("");
}

export interface ElementResult {
  element: string;
  matched: boolean;
}

export interface ScoreResult {
  elements: ElementResult[];
  matchedCount: number;
  score: number; // 0..1
}

export function scoreAnswer(answer: string, requiredElements: string[]): ScoreResult {
  const plain = answer.toLowerCase();
  const canonical = canonicalize(answer);

  const elements = requiredElements.map((element) => ({
    element,
    matched:
      plain.includes(element.toLowerCase()) || canonical.includes(canonicalize(element)),
  }));

  const matchedCount = elements.filter((e) => e.matched).length;
  return {
    elements,
    matchedCount,
    score: requiredElements.length === 0 ? 1 : matchedCount / requiredElements.length,
  };
}

// ---------------------------------------------------------------------------
// Scenario rendering
// ---------------------------------------------------------------------------

export interface RenderedScenario {
  template: ScenarioTemplate;
  values: GeneratedValues;
  situation: string;
  modelCall: string;
  requiredElements: string[];
  /** Position with "circuit-leg" resolved to the generated leg. */
  position: PositionKind;
  /** Everything the audio player needs to speak this call. */
  call: SpokenCall;
}

function resolvePosition(template: ScenarioTemplate, values: GeneratedValues): PositionKind {
  if (template.position !== "circuit-leg") return template.position;
  const leg = values.circuitLeg;
  if (leg === "crosswind" || leg === "downwind" || leg === "base") return leg;
  return "downwind";
}

export function renderScenario(
  template: ScenarioTemplate,
  values: GeneratedValues = generateValues(),
): RenderedScenario {
  const modelCall = fill(template.modelCall, values);
  return {
    template,
    values,
    situation: fill(template.situation, values),
    modelCall,
    requiredElements: template.requiredElements.map((e) => fill(e, values)),
    position: resolvePosition(template, values),
    call: { text: modelCall, id: callId(template.id, values.id) },
  };
}

/** The scenarios in scope for an aerodrome type, in chronological order. */
export function scenariosInScope(
  scope: PhaseId | "all",
  aerodromeType: AerodromeType,
): ScenarioTemplate[] {
  return SCENARIOS.filter(
    (s) =>
      (scope === "all" || s.phase === scope) && s.aerodromeTypes.includes(aerodromeType),
  );
}
