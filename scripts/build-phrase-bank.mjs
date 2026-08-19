// Drives the phrase-bank build: exports the token list from the lexicon (the
// single source of truth) and hands it to the Python renderer.
//
// Run with: npm run build:audio
// Requires espeak-ng and python3 with numpy on PATH.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PRONUNCIATIONS, TOKENS } from "../src/lib/lexicon.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src/assets");
mkdirSync(outDir, { recursive: true });

// [token id, text to synthesise] — they differ where espeak needs respelling.
const jobs = TOKENS.map((t) => [t, PRONUNCIATIONS[t] ?? t]);

const tokensFile = resolve(outDir, ".tokens.json");
writeFileSync(tokensFile, JSON.stringify(jobs));

console.log(`Rendering ${TOKENS.length} clips with espeak-ng…`);
execFileSync(
  "python3",
  [
    resolve(root, "scripts/build-phrase-bank.py"),
    tokensFile,
    resolve(outDir, "phrase-bank.wav"),
    resolve(outDir, "phrase-bank.json"),
  ],
  { stdio: "inherit" },
);
