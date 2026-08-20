// Proves every call the app can generate is fully speakable from the phrase
// bank. Exhaustive: for each scenario, every slot is swept through every value
// it can take, and every resulting clip must exist in the bank.
//
// Run with: npm run check:audio

import { readFileSync } from "node:fs";
import { SCENARIOS } from "../src/data/phraseology.ts";
import { ALL_CLIPS, clipsForCall, segmentTemplate } from "../src/lib/lexicon.ts";
import { SLOT_VALUES } from "../src/lib/scenario.ts";

const defined = new Set(ALL_CLIPS.map((c) => c.id));
const used = new Set();
const missing = new Set();
const unresolved = new Set();
let calls = 0;

const base = Object.fromEntries(Object.entries(SLOT_VALUES).map(([k, v]) => [k, v[0]]));

for (const scenario of SCENARIOS) {
  // Reject a template referencing a slot with no value space at all.
  for (const part of segmentTemplate(scenario.modelCall)) {
    if (part.isSlot && !(part.clip in SLOT_VALUES)) {
      unresolved.add(`${scenario.id}: {${part.clip}} has no values`);
    }
  }

  for (const [slot, options] of Object.entries(SLOT_VALUES)) {
    for (const option of options) {
      const values = { ...base, [slot]: option };
      const { segments, missing: gaps } = clipsForCall(scenario.modelCall, values);
      calls++;
      gaps.forEach((g) => unresolved.add(`${scenario.id}: ${g}`));
      for (const { clip } of segments) {
        used.add(clip);
        if (!defined.has(clip)) missing.add(clip);
      }
    }
  }
}

console.log(`Checked ${calls} generated calls across ${SCENARIOS.length} scenarios.`);
console.log(`Bank defines ${defined.size} clips; calls use ${used.size}.`);

const unused = [...defined].filter((c) => !used.has(c));
if (unused.length) console.log(`\nDefined but never spoken (${unused.length}): ${unused.join(", ")}`);

if (unresolved.size) {
  console.log(`\nUNRESOLVED SLOTS:`);
  [...unresolved].forEach((u) => console.log("  " + u));
}
if (missing.size) {
  console.log(`\nMISSING FROM BANK (${missing.size}):`);
  [...missing].sort().forEach((m) => console.log("  " + m));
}

// The rendered bank on disk must match what the lexicon expects.
try {
  const index = JSON.parse(readFileSync("src/assets/phrase-bank.json", "utf8"));
  const built = new Set(Object.keys(index.clips));
  const notBuilt = [...defined].filter((c) => !built.has(c));
  const stale = [...built].filter((c) => !defined.has(c));
  if (notBuilt.length || stale.length) {
    console.log(`\nBANK IS STALE — run npm run build:audio`);
    if (notBuilt.length) console.log(`  not yet rendered (${notBuilt.length}): ${notBuilt.slice(0, 8).join(", ")}…`);
    if (stale.length) console.log(`  left over (${stale.length}): ${stale.slice(0, 8).join(", ")}…`);
    process.exit(1);
  }
} catch {
  console.log("\n(no rendered bank on disk yet)");
}

if (missing.size || unresolved.size) process.exit(1);
console.log("\nOK — every generated call is fully speakable.");
