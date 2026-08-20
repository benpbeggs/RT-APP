// Proves every call the app can play has a recording, and that the recorded
// bank on disk matches what the code expects.
//
// Run with: npm run check:audio

import { readFileSync } from "node:fs";
import { SCENARIOS } from "../src/data/phraseology.ts";
import { FLIGHTS_BY_TYPE, callId } from "../src/data/flights.ts";
import { ALL_CALLS, spokenSentence } from "../src/lib/lexicon.ts";

const defined = new Set(ALL_CALLS.map((c) => c.id));
const needed = new Set();
const unresolved = [];

for (const scenario of SCENARIOS) {
  for (const type of scenario.aerodromeTypes) {
    for (const flight of FLIGHTS_BY_TYPE[type]) {
      needed.add(callId(scenario.id, flight.id));
      // A slot the flight has no value for would be spoken as "{slot}".
      const spoken = spokenSentence(scenario.modelCall, flight);
      const gaps = spoken.match(/\{[a-zA-Z]+\}/g);
      if (gaps) unresolved.push(`${scenario.id} / ${flight.id}: ${[...new Set(gaps)].join(", ")}`);
    }
  }
}

console.log(`${SCENARIOS.length} scenarios x their flights = ${needed.size} calls to record.`);
console.log(`Lexicon defines ${defined.size}.`);

const missing = [...needed].filter((id) => !defined.has(id));
if (unresolved.length) {
  console.log(`\nUNRESOLVED SLOTS:`);
  unresolved.forEach((u) => console.log("  " + u));
}
if (missing.length) {
  console.log(`\nMISSING (${missing.length}): ${missing.slice(0, 10).join(", ")}…`);
}

// The rendered bank on disk must match. Without this a change to a model call
// or a flight silently falls back to the browser's synthesiser at runtime.
let stale = false;
try {
  const index = JSON.parse(readFileSync("src/assets/call-bank.json", "utf8"));
  const built = new Set(Object.keys(index.calls));
  const notBuilt = [...needed].filter((id) => !built.has(id));
  const leftOver = [...built].filter((id) => !needed.has(id));
  if (notBuilt.length || leftOver.length) {
    stale = true;
    console.log(`\nBANK IS STALE — run npm run build:audio`);
    if (notBuilt.length) console.log(`  not recorded (${notBuilt.length}): ${notBuilt.slice(0, 6).join(", ")}…`);
    if (leftOver.length) console.log(`  left over (${leftOver.length}): ${leftOver.slice(0, 6).join(", ")}…`);
  }
} catch {
  console.log("\n(no rendered bank on disk yet)");
}

if (missing.length || unresolved.length || stale) process.exit(1);
console.log("\nOK — every call the app can play has a recording.");
