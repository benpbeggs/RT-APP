// Fold the built app into one self-contained HTML file.
//
// Published Artifacts run under a CSP that blocks requests to other hosts and
// are served as a single page, so the CSS, JS and the phrase-bank audio all
// have to be embedded rather than fetched as sibling files.
//
// Usage: node scripts/inline-artifact.mjs [outfile]

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "dist/assets");
const outFile = process.argv[2] ?? resolve(root, "dist/rt-trainer.html");

const files = readdirSync(assets);
const pick = (ext) => {
  const found = files.find((f) => f.endsWith(ext));
  if (!found) throw new Error(`no ${ext} in dist/assets — run npm run build first`);
  return found;
};

const css = readFileSync(resolve(assets, pick(".css")), "utf8");
let js = readFileSync(resolve(assets, pick(".js")), "utf8");

// Swap every emitted asset URL for an inline data URI.
const MIME = { ".wav": "audio/wav", ".json": "application/json" };
let embedded = 0;
for (const file of files) {
  const ext = file.slice(file.lastIndexOf("."));
  const mime = MIME[ext];
  if (!mime) continue;

  const data = readFileSync(resolve(assets, file)).toString("base64");
  const uri = `data:${mime};base64,${data}`;
  // The bundle refers to assets as "/assets/<name>" or "./assets/<name>".
  const pattern = new RegExp(`["'\`][^"'\`]*${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`, "g");
  const before = js;
  js = js.replace(pattern, JSON.stringify(uri));
  if (js !== before) embedded++;
}

// The publisher supplies the document wrapper, but declaring the encoding here
// too costs nothing and keeps the em dashes and ▶ glyphs intact if it doesn't.
const html = `<meta charset="utf-8">
<title>RT Trainer</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

writeFileSync(outFile, html);
console.log(
  `${outFile}\n  ${embedded} asset(s) embedded, ${(html.length / 1024 / 1024).toFixed(2)} MB total`,
);
