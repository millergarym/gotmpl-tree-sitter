'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { Parser, Language, Query } = require('web-tree-sitter');
const { bucketize } = require('./rainbow-core');
const { wasmPath: resolveWasm, queryPath: resolveQuery } = require('./resolve-assets');

let parser;
let query;
/** @type {vscode.TextEditorDecorationType[]} */
let decorationTypes = [];
/** @type {vscode.ExtensionContext} */
let ctx;

async function activate(context) {
  ctx = context;
  await load();

  const refreshActive = () => refresh(vscode.window.activeTextEditor);

  context.subscriptions.push(
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

  for (const [label, p] of [['parser', wasmPath], ['rainbow query', scmPath]]) {
    if (!fs.existsSync(p)) {
      vscode.window.showErrorMessage(
        `Go template rainbow: ${label} not found at ${p}. ` +
        `Run "make bundle" to package the assets, or set gotmplRainbow.parserPath / gotmplRainbow.rainbowQueryPath.`);
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

  // Rebuild the decoration palette.
  for (const dt of decorationTypes) dt.dispose();
  const colors = cfg.get('colors') || [];
  const bold = cfg.get('bold');
  decorationTypes = colors.map((color) =>
    vscode.window.createTextEditorDecorationType({
      color,
      fontWeight: bold ? 'bold' : undefined,
    }));
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
