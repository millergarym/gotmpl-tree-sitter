'use strict';

// Pure, editor-agnostic folding logic for Go template control blocks. No
// `vscode` dependency, so it can be unit-tested headlessly (see verify.js).
// extension.js turns the ranges into VSCode FoldingRanges.
//
// A fold is created for each segment between two consecutive control keywords
// ("markers") of the same block — the very keywords the rainbow layer colours
// (queries/rainbow.scm). So `{{if}}…{{else}}…{{end}}` yields two folds: the
// `if` body (down to the line above `{{else}}`) and the `else` body (down to
// the line above `{{end}}`). The closing `{{end}}` therefore stays visible, as
// does every `{{else}}` / `{{else if}}`.

const { CONTAINER_TYPES } = require('./rainbow-core');

// The control keywords that open / continue / close a block — the fold
// boundaries. These are exactly the @delimiter captures of queries/rainbow.scm.
const MARKER_TYPES = new Set(['if', 'else', 'end', 'range', 'with', 'block', 'define']);

/**
 * Compute folding ranges (0-based, inclusive start/end rows) for every control
 * block in the tree.
 *
 * @param {object} root a tree-sitter root node
 * @returns {Array<{start: number, end: number}>}
 */
function foldRanges(root) {
  const ranges = [];
  walk(root, ranges);
  return ranges;
}

function walk(node, ranges) {
  if (CONTAINER_TYPES.has(node.type)) addContainerFolds(node, ranges);
  for (let i = 0; i < node.childCount; i++) walk(node.child(i), ranges);
}

// Fold each gap between consecutive own-markers of a container. Only this
// block's own keywords are direct children; an inner block's keywords belong to
// that inner node (handled when `walk` recurses into it), so we never fold
// across nesting boundaries.
function addContainerFolds(node, ranges) {
  const rows = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!MARKER_TYPES.has(child.type)) continue;
    const row = child.startPosition.row;
    // `{{else if}}` contributes both `else` and `if` on the same row — the
    // segment has one boundary, so collapse the duplicate.
    if (rows.length === 0 || rows[rows.length - 1] !== row) rows.push(row);
  }
  for (let i = 0; i + 1 < rows.length; i++) {
    const start = rows[i];
    const end = rows[i + 1] - 1;
    if (end > start) ranges.push({ start, end });
  }
}

module.exports = { MARKER_TYPES, foldRanges };
