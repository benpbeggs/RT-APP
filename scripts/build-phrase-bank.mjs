// Drives the phrase-bank build: exports the clip list from the lexicon (the
// single source of truth) and hands it to the Python renderer.
//
// Run with: npm run build:audio
// Requires python3 with numpy and piper-tts; the voice model is downloaded
// once into .cache/piper.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_CLIPS } from "../src/lib/lexicon.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src/assets");
mkdirSync(outDir, { recursive: true });

// [clip id, text to synthesise] — they differ for slots, whose id encodes the
// slot and value while the text is how it is actually said.
const jobs = ALL_CLIPS.map((c) => [c.id, c.text]);

const clipsFile = resolve(outDir, ".clips.json");
writeFileSync(clipsFile, JSON.stringify(jobs));

const words = jobs.reduce((n, [, text]) => n + text.split(/\s+/).length, 0);
console.log(`Rendering ${jobs.length} clips (${words} words) with Piper…`);

execFileSync(
  "python3",
  [
    resolve(root, "scripts/build-phrase-bank.py"),
    clipsFile,
    resolve(outDir, "phrase-bank.wav"),
    resolve(outDir, "phrase-bank.json"),
  ],
  { stdio: "inherit" },
);
