'use strict';

// Pure, editor-agnostic rainbow logic. No `vscode` dependency, so it can be
// unit-tested headlessly (see verify.js). Both extension.js and verify.js use
// this module.

// Node types that open a rainbow "container". Must match the container nodes
// captured in ../queries/rainbow.scm.
const CONTAINER_TYPES = new Set([
  'if_statement',
  'range_statement',
  'with_statement',
  'block_statement',
  'define_statement',
]);

/**
 * 0-based nesting depth of a node among rainbow containers.
 *
 * A captured `@delimiter` keyword lives inside its own control block, so the
 * count of container-type ancestors is 1 for a top-level block. Subtracting 1
 * makes the outermost block map to palette index 0.
 *
 * @param {{parent: any, type: string}} node a tree-sitter node
 * @returns {number}
 */
function containerDepth(node) {
  let depth = 0;
  for (let n = node.parent; n; n = n.parent) {
    if (CONTAINER_TYPES.has(n.type)) depth++;
  }
  return Math.max(0, depth - 1);
}

/**
 * Group the `@delimiter` captures of queries/rainbow.scm into palette buckets
 * by nesting depth.
 *
 * @param {Array<{name: string, node: any}>} captures result of query.captures()
 * @param {number} paletteSize number of colours available (depth wraps around)
 * @returns {{ranges: Array<Array<object>>}} `ranges[i]` holds the nodes that
 *   should be painted with palette colour `i`. Each entry is a plain object
 *   `{ startRow, startColumn, endRow, endColumn, depth, text }`.
 */
function bucketize(captures, paletteSize) {
  const ranges = Array.from({ length: paletteSize }, () => []);
  for (const cap of captures) {
    if (cap.name !== 'delimiter') continue; // ignore @container captures
    const node = cap.node;
    const depth = containerDepth(node);
    ranges[depth % paletteSize].push({
      startRow: node.startPosition.row,
      startColumn: node.startPosition.column,
      endRow: node.endPosition.row,
      endColumn: node.endPosition.column,
      depth,
      text: node.text,
    });
  }
  return { ranges };
}

module.exports = { CONTAINER_TYPES, containerDepth, bucketize };
