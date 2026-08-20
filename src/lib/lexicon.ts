// The spoken lexicon: how a written model call becomes a sequence of recorded
// phrase-bank clips.
//
// Calls are generated, not fixed — the callsign, aerodrome, runway, altitude
// and distance all vary — so whole sentences cannot be pre-recorded. Instead
// every *token* is recorded once and the sentence is assembled at playback,
// which is how automated aeronautical audio (ATIS and the like) is built.
//
// This module is the single source of truth for that vocabulary. The build
// script (scripts/build-phrase-bank.mjs) reads TOKENS from here to decide what
// to render, and the player (lib/radio.ts) uses tokenize() to decide what to
// play. Keeping both on one list is what stops the bank and the calls drifting
// apart.

/** Spoken forms of the phonetic alphabet, keyed by letter. */
export const PHONETIC_ALPHABET: Record<string, string> = {
  a: "alpha", b: "bravo", c: "charlie", d: "delta", e: "echo", f: "foxtrot",
  g: "golf", h: "hotel", i: "india", j: "juliett", k: "kilo", l: "lima",
  m: "mike", n: "november", o: "oscar", p: "papa", q: "quebec", r: "romeo",
  s: "sierra", t: "tango", u: "uniform", v: "victor", w: "whiskey",
  x: "xray", y: "yankee", z: "zulu",
};

/** Aviation digit names. Nine is "niner" on the air; three and five are plain. */
export const DIGIT_WORDS = [
  "zero", "one", "two", "three", "four",
  "five", "six", "seven", "eight", "niner",
];

/**
 * Multi-word phrases, longest first so "clear of runway" wins over "runway"
 * and "cleared for takeoff" is never split. Order matters here.
 */
export const PHRASES: string[] = [
  "request traffic information",
  "departing the circuit to the",
  "general aviation apron",
  "estimating next position",
  "frequency change approved",
  "tracking training area",
  "rough running engine",
  "training area",
  "persons on board",
  "cleared for takeoff",
  "information alpha",
  "information bravo",
  "clear of runway",
  "entering runway",
  "cleared to land",
  "forced landing",
  "engine failure",
  "request taxi",
  "holding point",
  "touch and go",
  "radio check",
  "north-east",
  "north-west",
  "south-east",
  "south-west",
  "full stop",
  "say again",
  "pan pan",
  "line up",
  "mayday",
];

/** Single words used across the calls. */
export const WORDS: string[] = [
  "traffic", "tower", "ground", "runway", "taxiing", "taxi", "airborne",
  "inbound", "joining", "join", "crosswind", "downwind", "base", "final",
  "climbing", "diverting", "ready", "standby", "miles", "minutes",
  "north", "south", "east", "west", "qnh", "thousand", "hundred",
  "for", "landing", "to", "of", "via", "the",
];

/** Aerodrome names, matching the two lists in lib/scenario.ts. */
export const AERODROME_WORDS: string[] = [
  "cessnock", "goulburn", "temora", "mangalore", "warwick", "latrobe", "valley",
  "bankstown", "moorabbin", "archerfield", "jandakot", "parafield", "camden",
];

/** Aircraft manufacturers, which lead every callsign. */
export const AIRCRAFT_WORDS: string[] = ["cessna", "piper", "diamond", "jabiru"];

/** Every clip the phrase bank must contain. */
export const TOKENS: string[] = [
  ...new Set([
    ...Object.values(PHONETIC_ALPHABET),
    ...DIGIT_WORDS,
    ...PHRASES,
    ...WORDS,
    ...AERODROME_WORDS,
    ...AIRCRAFT_WORDS,
  ]),
];

/**
 * Respellings for tokens the synthesiser gets wrong. The key is the token id;
 * the value is what gets fed to espeak-ng when rendering that clip. Checked
 * with `espeak-ng -x -q <text>` to see the phonemes it produces.
 */
export const PRONUNCIATIONS: Record<string, string> = {
  // Default stresses the first syllable ("LAT-robe"); it is "luh-TROBE".
  latrobe: "la-trobe",
};

/** A clip id plus how long to pause after it. */
export interface SpokenToken {
  token: string;
  /** Extra pause in seconds after this clip — commas and full stops breathe. */
  pauseAfter: number;
}

// Clips are trimmed tight, so these are the whole gap between words. Kept
// small: a uniform pause after every word is what makes assembled speech sound
// like a list being read out. The longer one lands only at commas, where a
// controller would actually draw breath.
const WORD_GAP = 0.008;
const COMMA_GAP = 0.13;

/** "2500" -> ["two","thousand","five","hundred"]; "18" -> ["one","eight"]. */
function speakNumber(raw: string): string[] {
  const digits = raw.split("");

  // Altitudes and QNH-style figures read as grouped magnitudes, not digits.
  const value = Number(raw);
  if (raw.length === 4 && value % 100 === 0 && value >= 1000) {
    const thousands = Math.floor(value / 1000);
    const hundreds = (value % 1000) / 100;
    const out = [DIGIT_WORDS[thousands], "thousand"];
    if (hundreds > 0) out.push(DIGIT_WORDS[hundreds], "hundred");
    return out;
  }

  return digits.map((d) => DIGIT_WORDS[Number(d)]).filter(Boolean);
}

/** "VH-ABC" -> ["victor","hotel","alpha","bravo","charlie"]. */
function speakRegistration(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .split("")
    .map((c) => PHONETIC_ALPHABET[c])
    .filter(Boolean);
}

const SORTED_PHRASES = [...PHRASES].sort((a, b) => b.length - a.length);

/**
 * Turn a rendered model call into the clips that speak it. Anything the
 * lexicon does not cover is returned in `missing`, so the player can fall back
 * to the speech synthesiser rather than transmit a call with holes in it.
 */
export function tokenize(text: string): { spoken: SpokenToken[]; missing: string[] } {
  const spoken: SpokenToken[] = [];
  const missing: string[] = [];

  // Split into comma/full-stop delimited groups so pauses land where a
  // controller would actually pause.
  const groups = text.split(/([,.])/).filter((s) => s.trim() !== "");

  let pendingGap = WORD_GAP;
  for (const group of groups) {
    if (group === "," || group === ".") {
      if (spoken.length > 0) spoken[spoken.length - 1].pauseAfter = COMMA_GAP;
      continue;
    }

    let rest = group.trim().toLowerCase();
    while (rest.length > 0) {
      // Longest-match phrases first.
      const phrase = SORTED_PHRASES.find(
        (p) => rest === p || rest.startsWith(p + " ") || rest.startsWith(p + ","),
      );
      if (phrase) {
        spoken.push({ token: phrase, pauseAfter: pendingGap });
        rest = rest.slice(phrase.length).trim();
        continue;
      }

      const wordMatch = /^[^\s]+/.exec(rest);
      if (!wordMatch) break;
      const word = wordMatch[0];
      rest = rest.slice(word.length).trim();

      const clean = word.replace(/[^a-z0-9-]/g, "");
      if (clean === "") continue;

      // Registrations, then bare numbers, then plain vocabulary.
      let parts: string[];
      if (/^vh-?[a-z]{3}$/.test(clean)) {
        parts = speakRegistration(clean);
      } else if (/^\d+$/.test(clean)) {
        parts = speakNumber(clean);
      } else {
        parts = [clean];
      }

      for (const part of parts) {
        if (!TOKENS.includes(part)) missing.push(part);
        spoken.push({ token: part, pauseAfter: WORD_GAP });
      }
    }
  }

  return { spoken, missing };
}
