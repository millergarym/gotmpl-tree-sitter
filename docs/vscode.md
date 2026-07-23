# Using the grammar (and rainbow.scm) in VSCode

> **Read this first.** VSCode does not use tree-sitter for highlighting the way
> Neovim does, and **nothing in VSCode consumes `queries/rainbow.scm` directly** —
> that `@container` / `@delimiter` format is specific to
> [`rainbow-delimiters.nvim`](https://github.com/HiPhish/rainbow-delimiters.nvim).
> The tree-sitter extensions for VSCode map a capture name to *one* fixed colour
> (a semantic token type); they cannot express *depth-based* rainbow, because
> nesting depth is only known at runtime, not from a static query.
>
> So there are two realistic paths:
>
> - **Option A** — tree-sitter *highlighting* from `queries/highlights.scm` via
>   the `tree-sitter-vscode` extension. Keywords get a single flat colour (no
>   rainbow), but it's zero-code.
> - **Option B** — a ~60-line dev extension that actually loads
>   `queries/rainbow.scm`, computes each block's nesting depth, and paints the
>   `define`/`range`/`if`/… keywords with a rainbow palette. This is the only way
>   to reproduce the Neovim rainbow behaviour in VSCode.

Both options need a WebAssembly build of the parser.

## Build the WASM parser

From `gotmpl/tree-sitter`:

```sh
tree-sitter generate --abi 15      # tree-sitter-vscode needs ABI 14 or 15
tree-sitter build --wasm .         # -> tree-sitter-gotmpl.wasm  (needs Docker)
```

This writes `tree-sitter-gotmpl.wasm` into this directory. Note its absolute
path — both options below reference it.

---

## Option A — flat tree-sitter highlighting

Uses [`tree-sitter-vscode`](https://marketplace.visualstudio.com/items?itemName=AlecGhost.tree-sitter-vscode)
(publisher `AlecGhost`) to drive VSCode's semantic-token colours from
`queries/highlights.scm`.

1. Install the **tree-sitter-vscode** extension from the Marketplace.

2. Register `.tmpl`/`.gohtml`/… as a language and point the extension at the
   parser and highlight query. Add to your `settings.json` (use **absolute**
   paths):

   ```jsonc
   {
     // Associate the template extensions with a language id.
     "files.associations": {
       "*.tmpl": "gotmpl",
       "*.gotmpl": "gotmpl",
       "*.gohtml": "gotmpl",
       "*.tpl": "gotmpl"
     },

     "tree-sitter-vscode.languageConfigs": [
       {
         "lang": "gotmpl",
         "parser": "/Users/garymiller/devel/golang/gotmpl/tree-sitter/tree-sitter-gotmpl.wasm",
         "highlights": "/Users/garymiller/devel/golang/gotmpl/tree-sitter/queries/highlights.scm",
         "semanticTokenTypeMappings": [
           { "captureName": "keyword",           "targetTokenType": "keyword" },
           { "captureName": "keyword.conditional","targetTokenType": "keyword" },
           { "captureName": "keyword.repeat",    "targetTokenType": "keyword" },
           { "captureName": "function.call",     "targetTokenType": "function" },
           { "captureName": "function.builtin",  "targetTokenType": "function", "targetTokenModifiers": ["defaultLibrary"] },
           { "captureName": "variable",          "targetTokenType": "variable" },
           { "captureName": "variable.builtin",  "targetTokenType": "variable", "targetTokenModifiers": ["defaultLibrary"] },
           { "captureName": "property",          "targetTokenType": "property" },
           { "captureName": "string",            "targetTokenType": "string" },
           { "captureName": "string.special",    "targetTokenType": "string" },
           { "captureName": "character",         "targetTokenType": "string" },
           { "captureName": "number",            "targetTokenType": "number" },
           { "captureName": "boolean",           "targetTokenType": "keyword" },
           { "captureName": "constant.builtin",  "targetTokenType": "keyword" },
           { "captureName": "comment",           "targetTokenType": "comment" },
           { "captureName": "operator",          "targetTokenType": "operator" },
           { "captureName": "punctuation.bracket","targetTokenType": "operator" }
         ]
       }
     ]
   }
   ```

   > The exact `semanticTokenTypeMappings` field shape is defined by the
   > extension — check its Marketplace page if a newer version renames keys.
   > `targetTokenType` values are VSCode's standard
   > [semantic token types](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers).

3. Run **`tree-sitter-vscode: Reload`** from the Command Palette and open a
   `.tmpl` file. Ensure semantic highlighting is on
   (`"editor.semanticHighlighting.enabled": true`).

This gives correct, grammar-driven colours — but every `if`/`range`/`end`
keyword is the same colour. For rainbow, use Option B.

---

## Option B — a dev extension that loads `rainbow.scm`

This one is **implemented in this repo** at [`../vscode-rainbow/`](../vscode-rainbow).
It's a minimal, run-from-source VSCode extension that parses the document with
the WASM grammar, runs `queries/rainbow.scm`, and colours each captured
`@delimiter` keyword by the nesting depth of its `@container` block — exactly
what `rainbow-delimiters.nvim` does.

Layout:

| File | Role |
| --- | --- |
| `extension.js` | VSCode glue: activation, parsing, decorations, config + reload command. |
| `rainbow-core.js` | Pure depth/bucketing logic (no `vscode` dependency). |
| `verify.js` | Headless check of the core logic. |
| `package.json` | Manifest + `gotmplRainbow.*` settings. |
| `.vscode/launch.json` | F5 launch config for the Extension Development Host. |

By default the parser and query resolve to `../tree-sitter-gotmpl.wasm` and
`../queries/rainbow.scm` (relative to the extension), so no settings are
required when the extension sits inside the grammar repo. Override with the
`gotmplRainbow.parserPath` / `gotmplRainbow.rainbowQueryPath` settings otherwise.

### Run it in development mode

```sh
# 1. Build the WASM parser in the grammar directory (see top of this doc):
cd .. && tree-sitter generate --abi 15 && tree-sitter build --wasm . && cd -

# 2. Install web-tree-sitter:
cd vscode-rainbow && npm install

# 3. (Optional) verify the rainbow logic headlessly — no VSCode needed:
node verify.js
#    -> prints each keyword's nesting depth and the palette colour it gets.

# 4. Open the vscode-rainbow folder in VSCode and press F5. The launch config
#    starts the Extension Development Host and opens ../examples/sample.tmpl,
#    where the block keywords are rainbow-coloured by depth and update live.
```

Because the extension reads `queries/rainbow.scm` at load time, editing the
query (e.g. capturing the `{{`/`}}` braces instead of, or in addition to, the
keywords) and running **Go template rainbow: Reload** from the Command Palette
is enough to change what gets rainbow-coloured — no code change needed.

### Multi-root workspaces: semantic highlighting shows nothing

The rainbow keyword colouring is painted with editor decorations, so it works
everywhere. The `highlights.scm` **semantic-token** layer is different: VSCode
only renders semantic tokens when `editor.semanticHighlighting.enabled` resolves
to `true` for the file. The extension turns that on with a *language-scoped*
default (`configurationDefaults` → `"[gotmpl]": { "editor.semanticHighlighting.enabled": true }`).

In a multi-root workspace (a `.code-workspace` file with several folders), that
`.code-workspace` — or a folder's / your user settings — usually carries a
*non*-language-scoped `editor.semanticHighlighting.enabled` value (the built-in
default is `"configuredByTheme"`), and a non-language setting **outranks** a
language-scoped default (see VSCode
[#101498](https://github.com/microsoft/vscode/issues/101498)). So the extension's
default gets shadowed and the tokens stop rendering — even though the rainbow
layer keeps working.

Fix: enable it explicitly at the workspace level, keeping it **language-scoped**
so it doesn't change other languages. In the `.code-workspace` file:

```jsonc
{
  "folders": [ /* … */ ],
  "settings": {
    "[gotmpl]": { "editor.semanticHighlighting.enabled": true }
  }
}
```

(A bare `"editor.semanticHighlighting.enabled": true` there would force it on for
every language — use the `"[gotmpl]"` form.) The per-folder
`gotmplRainbow.*` settings (palette, `semanticHighlighting`, `folding`, …) are
`resource`-scoped, so you can also override them per folder in each folder's
`.vscode/settings.json`.

### How the depth colouring works

`rainbow-core.js` computes a keyword's colour bucket from how deeply its block
is nested. For a captured keyword node it counts the control-flow statement
ancestors (`if_statement`, `range_statement`, …); a top-level block's keyword
has one such ancestor (its own block), which maps to palette index 0, and each
extra level of nesting advances one colour (wrapping around the palette). The
verified result for `examples/sample.tmpl`:

```
depth 0 (colour 0): the two top-level {{define}} … {{end}} blocks
depth 1 (colour 1): {{range}}/{{with}}/{{block}} nested inside a define
depth 2 (colour 2): {{if}}/{{else if}}/{{else}}/{{end}} nested inside the range
```

---

## What about built-in bracket pair colourisation?

VSCode's built-in rainbow (`editor.bracketPairColorization.enabled`) only
colours literal `()`, `[]`, `{}` pairs. It has no notion of Go-template
`{{ … }}` actions or `if`/`end` block pairing, so it does not help here.

## Sources

- [tree-sitter-vscode (AlecGhost)](https://github.com/AlecGhost/tree-sitter-vscode)
- [rainbow-delimiters.nvim](https://github.com/HiPhish/rainbow-delimiters.nvim)
- [web-tree-sitter README](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web)
- [VSCode semantic highlight guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)
