// How a call becomes recorded audio.
//
// Calls are generated, so whole sentences cannot be pre-recorded — but they are
// not free-form either. Each one is a template with a handful of slots, and
// everything between the slots is fixed wording. So the bank records the fixed
// wording in whole phrases ("taxiing runway", "cleared for takeoff") and one
// clip per possible slot value ("Cessna VH-ABC" spoken right through), and
// playback stitches those larger pieces together.
//
// That granularity is the point. An earlier version recorded one clip per word
// and spelled callsigns letter by letter, which sounded like a list being read
// out however good the voice was. Phrases carry their own rhythm; single words
// have none to carry.
//
// This module is the single source of truth for the bank's contents:
// scripts/build-phrase-bank.mjs reads ALL_CLIPS to decide what to render, and
// lib/radio.ts calls clipsForCall() to decide what to play.

import { SCENARIOS } from "../data/phraseology";
import { SLOT_VALUES } from "./scenario";

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

/**
 * Respellings for anything the synthesiser gets wrong. Keyed by the text that
 * would otherwise be spoken.
 */
export const PRONUNCIATIONS: Record<string, string> = {
  // Default stresses the first syllable ("LAT-robe"); it is "luh-TROBE".
  "latrobe valley": "la-trobe valley",
};

const digits = (raw: string) => raw.split("").map((d) => DIGIT_WORDS[Number(d)]).join(" ");

/**
 * How a slot's value is said. Levels group into magnitudes the way a pilot
 * reads them ("two thousand five hundred"); runways, QNH and distances go
 * digit by digit, which is the standard and also how they are read back.
 */
export function spokenValue(slot: string, value: string): string {
  switch (slot) {
    case "callsign": {
      // "Cessna VH-ABC" -> "Cessna victor hotel alpha bravo charlie"
      const [type, registration] = value.split(" VH-");
      const letters = ["v", "h", ...registration.toLowerCase().split("")]
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
    default:
      return value;
  }
}

// ---------------------------------------------------------------- segmenting

export interface CallSegment {
  /** Clip id: the literal's text, or "slot:value" for a slot. */
  clip: string;
  /** Pause after this clip, in seconds. */
  pauseAfter: number;
}

// Clips are trimmed tight, so these are the whole gap. The short one holds
// words of a phrase together; the long one lands only where the written call
// has a comma, which is where a controller actually draws breath.
const WORD_GAP = 0.008;
const COMMA_GAP = 0.13;

/** Normalised clip id for a run of fixed wording. */
export function literalClip(text: string): string {
  return text.replace(/[,.]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export const slotClip = (slot: string, value: string) => `${slot}:${value}`;

/**
 * Break a template into the clips that speak it. Splitting on commas first
 * means each comma becomes a real pause and everything inside one is a single
 * recorded phrase rather than a string of separate words.
 */
export function segmentTemplate(template: string): { clip: string; isSlot: boolean; endsPhrase: boolean }[] {
  const out: { clip: string; isSlot: boolean; endsPhrase: boolean }[] = [];

  const phrases = template.split(/[,.]/).map((p) => p.trim()).filter(Boolean);
  phrases.forEach((phrase, phraseIndex) => {
    const parts: { clip: string; isSlot: boolean }[] = [];
    const pattern = /\{(\w+)\}/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(phrase))) {
      const literal = literalClip(phrase.slice(cursor, match.index));
      if (literal) parts.push({ clip: literal, isSlot: false });
      parts.push({ clip: match[1], isSlot: true });
      cursor = match.index + match[0].length;
    }
    const tail = literalClip(phrase.slice(cursor));
    if (tail) parts.push({ clip: tail, isSlot: false });

    parts.forEach((part, i) => {
      out.push({
        ...part,
        endsPhrase: i === parts.length - 1 && phraseIndex < phrases.length - 1,
      });
    });
  });

  return out;
}

/** The clips that speak one filled-in call, in order. */
export function clipsForCall(
  template: string,
  values: Record<string, string>,
): { segments: CallSegment[]; missing: string[] } {
  const segments: CallSegment[] = [];
  const missing: string[] = [];

  for (const part of segmentTemplate(template)) {
    let clip: string;
    if (part.isSlot) {
      const value = values[part.clip];
      if (value === undefined) {
        missing.push(`{${part.clip}}`);
        continue;
      }
      clip = slotClip(part.clip, value);
    } else {
      clip = part.clip;
    }
    segments.push({ clip, pauseAfter: part.endsPhrase ? COMMA_GAP : WORD_GAP });
  }

  return { segments, missing };
}

// ------------------------------------------------------------- bank contents

/** Every clip the phrase bank must hold, with the text to synthesise for it. */
export function allClips(): { id: string; text: string }[] {
  const clips = new Map<string, string>();

  for (const scenario of SCENARIOS) {
    for (const part of segmentTemplate(scenario.modelCall)) {
      if (!part.isSlot) clips.set(part.clip, part.clip);
    }
  }

  for (const [slot, values] of Object.entries(SLOT_VALUES)) {
    for (const value of values) {
      clips.set(slotClip(slot, value), spokenValue(slot, value));
    }
  }

  return [...clips].map(([id, text]) => ({
    id,
    text: PRONUNCIATIONS[text.toLowerCase()] ?? text,
  }));
}

export const ALL_CLIPS = allClips();
