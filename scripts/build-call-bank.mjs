// Drives the call-bank build: exports the call list from the lexicon (the
// single source of truth) and hands it to the Python renderer.
//
// Run with: npm run build:audio
// Requires python3 with numpy, piper-tts and lameenc; the voice model is
// downloaded once into .cache/piper.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_CALLS } from "../src/lib/lexicon.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src/assets");
mkdirSync(outDir, { recursive: true });

const jobs = ALL_CALLS.map((c) => [c.id, c.text]);
const callsFile = resolve(outDir, ".calls.json");
writeFileSync(callsFile, JSON.stringify(jobs));

const words = jobs.reduce((n, [, text]) => n + text.split(/\s+/).length, 0);
console.log(`Rendering ${jobs.length} whole calls (${words} words) with Piper…`);

execFileSync(
  "python3",
  [
    resolve(root, "scripts/build-call-bank.py"),
    callsFile,
    resolve(outDir, "call-bank.bin"),
    resolve(outDir, "call-bank.json"),
  ],
  { stdio: "inherit" },
);
