'use strict';

// Pure, editor-agnostic mapping from queries/highlights.scm capture names to
// VSCode's standard semantic token types. No `vscode` dependency, so the
// resolution logic can be unit-tested headlessly (see verify.js). extension.js
// turns the resolved nodes into VSCode SemanticTokens.

// Maps a highlights.scm capture name to a [tokenType, modifiers] pair.
//
// Capture names follow the nvim-treesitter convention; VSCode only understands
// its own fixed set of standard semantic token types, so several captures fold
// onto the nearest standard type (e.g. `character`/`string.special` -> string,
// `boolean`/`constant.builtin` -> keyword). Captures with no entry here (e.g.
// punctuation.*, @spell) are left unstyled and fall through to the editor
// default — the rainbow layer colours the control keywords separately.
const CAPTURE_TOKENS = {
  'comment': ['comment', []],
  'keyword': ['keyword', []],
  'keyword.conditional': ['keyword', []],
  'keyword.repeat': ['keyword', []],
  'operator': ['operator', []],
  'string': ['string', []],
  'string.special': ['string', []],
  'character': ['string', []],
  'number': ['number', []],
  'boolean': ['keyword', []],
  'constant.builtin': ['keyword', []],
  'variable': ['variable', []],
  'variable.builtin': ['variable', ['defaultLibrary']],
  'property': ['property', []],
  'function.call': ['function', []],
  'function.builtin': ['function', ['defaultLibrary']],
};

// The legend VSCode needs: the distinct token types and modifiers we emit.
const TOKEN_TYPES = ['comment', 'keyword', 'operator', 'string', 'number', 'variable', 'property', 'function'];
const TOKEN_MODIFIERS = ['defaultLibrary'];

/**
 * Resolve the matches of queries/highlights.scm into one semantic token per
 * node, in document order.
 *
 * highlights.scm is written in the tree-sitter convention where the first
 * matching pattern wins (catch-alls such as `(identifier) @variable` sit at the
 * bottom). `query.matches()` exposes each match's pattern index, so when
 * several patterns capture the same node we keep the one with the lowest index
 * — e.g. a builtin identifier stays `@function.builtin`, not the fallback
 * `@variable`. Captures with no entry in CAPTURE_TOKENS are ignored entirely,
 * so an unmapped early pattern never masks a mapped later one.
 *
 * @param {Array<{pattern: number, captures: Array<{name: string, node: any}>}>} matches
 *   result of query.matches()
 * @returns {Array<{startRow, startColumn, endRow, endColumn, type, modifiers, text}>}
 *   sorted by (startRow, startColumn); each node appears at most once.
 */
function resolveTokens(matches) {
  // nodeId -> { pattern, type, modifiers, node }
  const best = new Map();
  for (const match of matches) {
    for (const cap of match.captures) {
      const mapping = CAPTURE_TOKENS[cap.name];
      if (!mapping) continue;
      const node = cap.node;
      const prev = best.get(node.id);
      if (prev && prev.pattern <= match.pattern) continue;
      best.set(node.id, { pattern: match.pattern, type: mapping[0], modifiers: mapping[1], node });
    }
  }

  const tokens = [];
  for (const { type, modifiers, node } of best.values()) {
    tokens.push({
      startRow: node.startPosition.row,
      startColumn: node.startPosition.column,
      endRow: node.endPosition.row,
      endColumn: node.endPosition.column,
      type,
      modifiers,
      text: node.text,
    });
  }
  tokens.sort((a, b) => a.startRow - b.startRow || a.startColumn - b.startColumn);
  return tokens;
}

module.exports = { CAPTURE_TOKENS, TOKEN_TYPES, TOKEN_MODIFIERS, resolveTokens };
