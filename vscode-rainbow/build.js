'use strict';

// Copy the tree-sitter WASM parser and the rainbow query out of the sibling
// grammar repo (../) into dist/ so they ship inside the .vsix. This runs from
// the `vscode:prepublish` npm hook (and from `make bundle`), so packaging always
// picks up the current parser/query rather than the run-from-source paths.

const path = require('path');
const fs = require('fs');

const extDir = __dirname;
const grammarDir = path.resolve(extDir, '..');
const dist = path.join(extDir, 'dist');

const assets = [
  [path.join(grammarDir, 'tree-sitter-gotmpl.wasm'), path.join(dist, 'tree-sitter-gotmpl.wasm')],
  [path.join(grammarDir, 'queries', 'rainbow.scm'), path.join(dist, 'rainbow.scm')],
  [path.join(grammarDir, 'queries', 'highlights.scm'), path.join(dist, 'highlights.scm')],
];

fs.mkdirSync(dist, { recursive: true });

for (const [src, dst] of assets) {
  if (!fs.existsSync(src)) {
    console.error(
      `build: missing source asset ${src}\n` +
      `Build the parser first:\n` +
      `  cd ${grammarDir} && tree-sitter generate --abi 15 && tree-sitter build --wasm .\n` +
      `(or run "make wasm" from ${extDir}).`);
    process.exit(1);
  }
  fs.copyFileSync(src, dst);
  console.log(`bundled ${path.relative(extDir, dst)}  (${fs.statSync(dst).size} bytes)`);
}
