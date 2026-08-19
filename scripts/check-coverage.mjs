// Proves every call the app can generate is fully speakable from the phrase
// bank. Exhaustive over the value vocabulary: for each scenario, each
// placeholder is swept through every value it can take.
//
// Run with: npx vite-node scripts/check-coverage.mjs

import { SCENARIOS } from "../src/data/phraseology.ts";
import { tokenize, TOKENS } from "../src/lib/lexicon.ts";

// Mirrors the vocabulary in src/lib/scenario.ts.
const VOCAB = {
  aerodrome: [
    "Cessnock", "Goulburn", "Temora", "Mangalore", "Warwick", "Latrobe Valley",
    "Bankstown", "Moorabbin", "Archerfield", "Jandakot", "Parafield", "Camden",
  ],
  aircraftType: ["Cessna 172", "Piper Warrior", "Diamond DA40", "Jabiru"],
  runway: ["18", "25", "07", "36", "22", "04"],
  wind: ["180 at 10", "250 at 8", "070 at 12", "360 at 6"],
  compass: [
    "north", "north-east", "east", "south-east",
    "south", "south-west", "west", "north-west",
  ],
  circuitLeg: ["crosswind", "downwind", "base"],
  station: ["Traffic", "Tower"],
  qnh: Array.from({ length: 21 }, (_, i) => String(1005 + i)),
  distanceNm: Array.from({ length: 13 }, (_, i) => String(2 + i)),
  altitude: ["1500", "2500", "3500", "4500"],
  etaMin: Array.from({ length: 12 }, (_, i) => String(3 + i)),
  pob: ["1", "2", "3"],
  callsign: [],
};

// Every callsign the generator can produce is <type> VH-<3 letters>; the
// letters are covered by sweeping the alphabet through each position.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
for (const type of VOCAB.aircraftType) {
  const make = type.split(" ")[0];
  for (const l of LETTERS) {
    VOCAB.callsign.push(`${make} VH-${l}${l}${l}`);
    VOCAB.callsign.push(`${make} VH-A${l}Z`);
  }
}

const KEYS = Object.keys(VOCAB);

function baseValues() {
  return Object.fromEntries(KEYS.map((k) => [k, VOCAB[k][0]]));
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`);
}

const missingTokens = new Set();
const unresolved = new Set();
const usedTokens = new Set();
let calls = 0;

for (const scenario of SCENARIOS) {
  // Sweep each placeholder independently — every token appears in some call.
  for (const key of KEYS) {
    for (const value of VOCAB[key]) {
      const values = { ...baseValues(), [key]: value };
      const text = fill(scenario.modelCall, values);
      calls++;

      const leftover = text.match(/\{[a-zA-Z]+\}/g);
      if (leftover) leftover.forEach((p) => unresolved.add(`${scenario.id}: ${p}`));

      const { spoken, missing } = tokenize(text);
      missing.forEach((m) => missingTokens.add(m));
      spoken.forEach((s) => usedTokens.add(s.token));
    }
  }
}

console.log(`Checked ${calls} generated calls across ${SCENARIOS.length} scenarios.`);
console.log(`Bank defines ${TOKENS.length} tokens; calls use ${usedTokens.size}.`);

const unused = TOKENS.filter((t) => !usedTokens.has(t));
if (unused.length) console.log(`\nDefined but never spoken (${unused.length}):`, unused.join(", "));

if (unresolved.size) {
  console.log(`\nUNRESOLVED PLACEHOLDERS:`);
  [...unresolved].forEach((u) => console.log("  " + u));
}

if (missingTokens.size) {
  console.log(`\nMISSING FROM LEXICON (${missingTokens.size}):`);
  [...missingTokens].sort().forEach((m) => console.log("  " + m));
  process.exit(1);
}

if (unresolved.size) process.exit(1);
console.log("\nOK — every generated call is fully speakable.");
