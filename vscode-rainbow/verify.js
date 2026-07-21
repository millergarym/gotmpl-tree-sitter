'use strict';

// Headless verification of the rainbow logic — everything the extension does
// except the VSCode decoration calls. Run:  node verify.js [file.tmpl]
//
// Prints each control keyword with its computed nesting depth and the palette
// index (colour bucket) it would receive, so you can eyeball that nested blocks
// step through the rainbow.

const path = require('path');
const fs = require('fs');
const { Parser, Language, Query } = require('web-tree-sitter');
const { bucketize } = require('./rainbow-core');
const { wasmPath: resolveWasm, queryPath: resolveQuery } = require('./resolve-assets');

const PALETTE = ['#e6194B', '#f58231', '#ffe119', '#3cb44b', '#4363d8', '#911eb4', '#f032e6'];

async function main() {
  const grammarDir = path.resolve(__dirname, '..');
  const wasmPath = resolveWasm(__dirname, '');
  const scmPath = resolveQuery(__dirname, '');
  const file = process.argv[2] || path.join(grammarDir, 'examples', 'sample.tmpl');

  await Parser.init({
    locateFile: (name) => path.join(__dirname, 'node_modules', 'web-tree-sitter', name),
  });
  const lang = await Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(lang);
  const query = new Query(lang, fs.readFileSync(scmPath, 'utf8'));

  const src = fs.readFileSync(file, 'utf8');
  const tree = parser.parse(src);
  const { ranges } = bucketize(query.captures(tree.rootNode), PALETTE.length);

  // Flatten back into document order for a readable report.
  const rows = [];
  ranges.forEach((bucket, colorIdx) => {
    for (const r of bucket) rows.push({ ...r, colorIdx });
  });
  rows.sort((a, b) => a.startRow - b.startRow || a.startColumn - b.startColumn);

  console.log(`file: ${path.relative(process.cwd(), file)}`);
  console.log(`rainbow keywords: ${rows.length}\n`);
  console.log('line:col   depth  bucket  color     keyword');
  console.log('-------------------------------------------------');
  for (const r of rows) {
    const loc = `${r.startRow + 1}:${r.startColumn}`.padEnd(9);
    console.log(
      `${loc}  ${String(r.depth).padStart(5)}  ${String(r.colorIdx).padStart(6)}  ` +
      `${PALETTE[r.colorIdx].padEnd(8)}  ${r.text}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
