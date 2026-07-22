'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { Parser, Language, Query } = require('web-tree-sitter');
const { bucketize } = require('./rainbow-core');
const { resolveTokens, TOKEN_TYPES, TOKEN_MODIFIERS } = require('./highlight-core');
const { foldRanges } = require('./folding-core');
const { wasmPath: resolveWasm, queryPath: resolveQuery, highlightsPath: resolveHighlights } = require('./resolve-assets');

let parser;
let query;
let hlQuery;
// Whether the highlights.scm semantic-token layer is active (gotmplRainbow.semanticHighlighting).
let semanticEnabled = true;
// Whether control-block code folding is active (gotmplRainbow.folding).
let foldingEnabled = true;
/** @type {vscode.TextEditorDecorationType[]} */
let decorationTypes = [];
/** @type {vscode.ExtensionContext} */
let ctx;

// VSCode semantic-token legend for the highlights.scm layer. Fixed at module
// load; the theme decides the actual colours.
const semanticLegend = new vscode.SemanticTokensLegend(TOKEN_TYPES, TOKEN_MODIFIERS);
const semanticTokensChanged = new vscode.EventEmitter();

/** @type {vscode.DocumentSemanticTokensProvider} */
const semanticProvider = {
  onDidChangeSemanticTokens: semanticTokensChanged.event,
  provideDocumentSemanticTokens(document) {
    if (!semanticEnabled || !parser || !hlQuery) return null;
    const tree = parser.parse(document.getText());
    try {
      const builder = new vscode.SemanticTokensBuilder(semanticLegend);
      for (const t of resolveTokens(hlQuery.matches(tree.rootNode))) {
        pushToken(builder, document, t);
      }
      return builder.build();
    } finally {
      tree.delete();
    }
  },
};

const foldingChanged = new vscode.EventEmitter();

// Code folding for control blocks, using the same block markers the rainbow
// layer colours (see folding-core.js).
/** @type {vscode.FoldingRangeProvider} */
const foldingProvider = {
  onDidChangeFoldingRanges: foldingChanged.event,
  provideFoldingRanges(document) {
    if (!foldingEnabled || !parser) return [];
    const tree = parser.parse(document.getText());
    try {
      return foldRanges(tree.rootNode).map((r) => new vscode.FoldingRange(r.start, r.end));
    } finally {
      tree.delete();
    }
  },
};

// Push one resolved node as semantic tokens. VSCode tokens cannot span lines,
// so a multi-line node (e.g. a block comment) is split into one token per line.
function pushToken(builder, document, t) {
  if (t.startRow === t.endRow) {
    builder.push(new vscode.Range(t.startRow, t.startColumn, t.endRow, t.endColumn), t.type, t.modifiers);
    return;
  }
  const eol = (row) => document.lineAt(row).text.length;
  builder.push(new vscode.Range(t.startRow, t.startColumn, t.startRow, eol(t.startRow)), t.type, t.modifiers);
  for (let row = t.startRow + 1; row < t.endRow; row++) {
    builder.push(new vscode.Range(row, 0, row, eol(row)), t.type, t.modifiers);
  }
  builder.push(new vscode.Range(t.endRow, 0, t.endRow, t.endColumn), t.type, t.modifiers);
}

async function activate(context) {
  ctx = context;
  await load();

  const refreshActive = () => refresh(vscode.window.activeTextEditor);

  context.subscriptions.push(
    semanticTokensChanged,
    foldingChanged,
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'gotmpl' }, semanticProvider, semanticLegend),
    vscode.languages.registerFoldingRangeProvider({ language: 'gotmpl' }, foldingProvider),
    vscode.commands.registerCommand('gotmplRainbow.reload', async () => {
      await load();
      refreshActive();
      vscode.window.showInformationMessage('Go template rainbow: reloaded.');
    }),
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const ed = vscode.window.activeTextEditor;
      if (ed && e.document === ed.document) refresh(ed);
    }),
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('gotmplRainbow')) {
        await load();
        refreshActive();
      }
    }),
  );

  refreshActive();
}

// (Re)load the parser, the rainbow query, and the decoration palette from the
// current configuration.
async function load() {
  const cfg = vscode.workspace.getConfiguration('gotmplRainbow');

  // Prefer the assets bundled into the .vsix (dist/); fall back to the sibling
  // grammar repo when run from source; a config override always wins. See
  // resolve-assets.js.
  const wasmPath = resolveWasm(ctx.extensionPath, cfg.get('parserPath'));
  const scmPath = resolveQuery(ctx.extensionPath, cfg.get('rainbowQueryPath'));
  const hlPath = resolveHighlights(ctx.extensionPath, cfg.get('highlightsQueryPath'));
  semanticEnabled = cfg.get('semanticHighlighting') !== false;
  foldingEnabled = cfg.get('folding') !== false;

  for (const [label, p] of [['parser', wasmPath], ['rainbow query', scmPath], ['highlights query', hlPath]]) {
    if (!fs.existsSync(p)) {
      vscode.window.showErrorMessage(
        `Go template rainbow: ${label} not found at ${p}. ` +
        `Run "make bundle" to package the assets, or set gotmplRainbow.parserPath / ` +
        `gotmplRainbow.rainbowQueryPath / gotmplRainbow.highlightsQueryPath.`);
      return;
    }
  }

  // web-tree-sitter needs its own core wasm; point it at our node_modules copy.
  await Parser.init({
    locateFile: (name) => path.join(ctx.extensionPath, 'node_modules', 'web-tree-sitter', name),
  });
  const lang = await Language.load(wasmPath);
  parser = new Parser();
  parser.setLanguage(lang);
  query = new Query(lang, fs.readFileSync(scmPath, 'utf8'));
  hlQuery = new Query(lang, fs.readFileSync(hlPath, 'utf8'));

  // Tell VSCode the semantic tokens and folding ranges are stale so open gotmpl
  // files re-highlight / re-fold after a reload / config change.
  semanticTokensChanged.fire();
  foldingChanged.fire();

  // Rebuild the decoration palette. Each decoration carries both a light- and a
  // dark-theme colour so VSCode picks the readable one for the active theme (no
  // theme detection needed). The dark palette (`colors`) drives the count and is
  // the fallback for light when `colorsLight` is unset. Optional per-depth
  // border and background tint reuse the same depth colour.
  for (const dt of decorationTypes) dt.dispose();
  const dark = cfg.get('colors') || [];
  const lightCfg = cfg.get('colorsLight') || [];
  const light = lightCfg.length ? lightCfg : dark;
  const bold = cfg.get('bold');
  const border = cfg.get('border');
  const background = cfg.get('background');
  decorationTypes = dark.map((darkColor, i) => {
    const lightColor = light[i % light.length];
    /** @type {vscode.DecorationRenderOptions} */
    const opts = {
      light: { color: lightColor },
      dark: { color: darkColor },
      fontWeight: bold ? 'bold' : undefined,
    };
    if (border) {
      opts.borderWidth = '1px';
      opts.borderStyle = 'solid';
      opts.borderRadius = '3px';
      opts.light.borderColor = lightColor;
      opts.dark.borderColor = darkColor;
    }
    if (background) {
      opts.light.backgroundColor = withAlpha(lightColor, '22');
      opts.dark.backgroundColor = withAlpha(darkColor, '22');
    }
    return vscode.window.createTextEditorDecorationType(opts);
  });
}

// Append an 8-digit-hex alpha to a `#rrggbb` colour for a translucent tint.
// Non-hex colours (named/rgb()) are returned unchanged.
function withAlpha(color, alphaHex) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color + alphaHex : color;
}

/** @param {vscode.TextEditor | undefined} editor */
function refresh(editor) {
  if (!editor || !parser || !query || decorationTypes.length === 0) return;
  if (editor.document.languageId !== 'gotmpl') return;

  const tree = parser.parse(editor.document.getText());
  try {
    const { ranges } = bucketize(query.captures(tree.rootNode), decorationTypes.length);
    decorationTypes.forEach((dt, i) => {
      editor.setDecorations(
        dt,
        ranges[i].map((r) => new vscode.Range(r.startRow, r.startColumn, r.endRow, r.endColumn)),
      );
    });
  } finally {
    tree.delete();
  }
}

function deactivate() {
  for (const dt of decorationTypes) dt.dispose();
  decorationTypes = [];
}

module.exports = { activate, deactivate };
