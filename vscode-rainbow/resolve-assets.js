'use strict';

// Shared asset resolution for extension.js and verify.js.
//
// A published .vsix carries the parser and query inside dist/; a run-from-source
// checkout reads them from the sibling grammar repo (../). Resolution order for
// each asset: an explicit config override wins, then the bundled dist/ copy,
// then the dev-mode sibling path.

const path = require('path');
const fs = require('fs');

/**
 * @param {string} extensionDir absolute path of the extension root
 * @param {string} override explicit path from configuration (may be empty)
 * @param {string} bundledRel dist/ location relative to the extension root
 * @param {string} devRel grammar-repo location relative to the extension root
 * @returns {string}
 */
function resolveAsset(extensionDir, override, bundledRel, devRel) {
  if (override) return override;
  const bundled = path.join(extensionDir, bundledRel);
  if (fs.existsSync(bundled)) return bundled;
  return path.join(extensionDir, devRel);
}

function wasmPath(extensionDir, override) {
  return resolveAsset(extensionDir, override || '', 'dist/tree-sitter-gotmpl.wasm', '../tree-sitter-gotmpl.wasm');
}

function queryPath(extensionDir, override) {
  return resolveAsset(extensionDir, override || '', 'dist/rainbow.scm', '../queries/rainbow.scm');
}

module.exports = { resolveAsset, wasmPath, queryPath };
