# gotmpl-rainbow

A VSCode extension for Go templates, driven by the tree-sitter grammar. It does
two things every time a `gotmpl` document changes:

1. **Syntax highlighting** — runs [`../queries/highlights.scm`](../queries/highlights.scm)
   and exposes the captures as VSCode **semantic tokens** (comments, strings,
   keywords, functions, fields, numbers, …). The active colour theme paints
   them; there is no hard-coded palette.
2. **Rainbow keywords** — runs [`../queries/rainbow.scm`](../queries/rainbow.scm)
   and paints each control keyword (`define`/`range`/`if`/`with`/`block`/`else`/
   `end`) with a colour chosen by its **block nesting depth**, reproducing the
   Neovim `rainbow-delimiters.nvim` behaviour.

VSCode has no built-in consumer for these `.scm` queries; this extension is the
bridge. See [../docs/vscode.md](../docs/vscode.md) for the full write-up.

## Files

| File | Role |
| --- | --- |
| `extension.js` | VSCode glue: activation, parsing, semantic tokens, decorations, config/reload. |
| `rainbow-core.js` | Pure depth/bucketing logic for the rainbow layer — no `vscode` dependency. |
| `highlight-core.js` | Pure `highlights.scm` capture → semantic-token mapping — no `vscode` dependency. |
| `resolve-assets.js` | Locates the parser/queries: config override → bundled `dist/` → sibling grammar repo. |
| `verify.js` | Headless check of both core layers (no VSCode needed). |
| `build.js` | Copies the parser + `rainbow.scm` + `highlights.scm` into `dist/` for packaging. |
| `Makefile` | `make package` / `make publish` — see [PUBLISHING.md](PUBLISHING.md). |

## Run in development mode

```sh
# 1. Build the WASM parser in the grammar directory (one level up):
cd .. && tree-sitter generate --abi 15 && tree-sitter build --wasm . && cd -

# 2. Install web-tree-sitter:
npm install

# 3. Sanity-check the logic without launching VSCode:
node verify.js            # prints each keyword's depth + colour bucket

# 4. Launch the Extension Development Host:
#    open this folder in VSCode and press F5 (uses .vscode/launch.json,
#    which also opens ../examples/sample.tmpl for you).
```

When run from source the parser and query resolve to `../tree-sitter-gotmpl.wasm`
and `../queries/rainbow.scm`; a packaged build uses the copies bundled into
`dist/`. Override either with the `gotmplRainbow.parserPath` /
`gotmplRainbow.rainbowQueryPath` settings.

## Build & publish

```sh
make package   # bundle assets into dist/ and produce gotmpl-rainbow-<version>.vsix
make publish   # bundle + publish to the VSCode Marketplace
make verify    # headless depth/colour check
```

Both `package` and `publish` re-bundle the parser and query first. Full
marketplace setup (publisher, PAT, `vsce login`) is in [PUBLISHING.md](PUBLISHING.md);
installing a built `.vsix` without the Marketplace is covered in
[SIDELOADING.md](SIDELOADING.md).

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `gotmplRainbow.parserPath` | *(bundled)* | Absolute path to override the WASM parser. |
| `gotmplRainbow.rainbowQueryPath` | *(bundled)* | Absolute path to override the rainbow query. |
| `gotmplRainbow.highlightsQueryPath` | *(bundled)* | Absolute path to override the highlights query. |
| `gotmplRainbow.semanticHighlighting` | `true` | Provide `highlights.scm` syntax highlighting (semantic tokens). Off = rainbow keywords only. |
| `gotmplRainbow.colors` | 7-colour palette | Rainbow palette for **dark** themes (and the light fallback); depth wraps around. |
| `gotmplRainbow.colorsLight` | 7-colour palette | Rainbow palette for **light** themes (darker, so e.g. yellow stays readable). Empty = reuse `colors`. |
| `gotmplRainbow.bold` | `true` | Render coloured keywords in bold. |

Each rainbow decoration carries both a light and a dark colour, so VSCode picks
the readable one for the active theme automatically — switching themes needs no
reload.

Syntax-highlighting colours come from your active theme's **semantic token**
rules, not from a setting here. The extension also turns on
`editor.semanticHighlighting.enabled` for `gotmpl` files by default (via
`configurationDefaults`), so the tokens render even under a theme that otherwise
leaves semantic highlighting off; if a file still looks flat, the theme simply
doesn't style these semantic token types.

Command **`Go template rainbow: Reload parser and query`** re-reads the WASM and
`.scm` files without restarting the host — handy while editing `rainbow.scm`.

## What's verified

`node verify.js` exercises everything except the VSCode rendering APIs: it loads
the real WASM parser, runs `rainbow.scm` (printing the depth/colour each keyword
receives) **and** `highlights.scm` (printing the semantic token each node
resolves to). The `vscode`-specific glue in `extension.js` — decorations and the
semantic-tokens provider — is exercised by launching the Extension Development
Host (step 4).

## Launch from the command line

The `code` CLI equivalent of the `.vscode/launch.json` config is
`--extensionDevelopmentPath`:

```sh
code --extensionDevelopmentPath=/Users/garymiller/devel/golang/gotmpl-tree-sitter/vscode-rainbow \
     --disable-extensions \
     /Users/garymiller/devel/golang/gotmpl-tree-sitter/examples/sample.tmpl
```

- `--extensionDevelopmentPath=…` loads the extension from source (same as the
  launch config).
- `--disable-extensions` disables *other* installed extensions (this one still
  loads), so nothing else touches `.tmpl` files during testing.
- The trailing path opens the sample file.

After editing `extension.js` / `highlight-core.js`, run **Developer: Reload
Window** in the host to pick up the changes. Changes to `package.json` (e.g. the
`configurationDefaults`) need the host **relaunched**, not just reloaded.

## Highlighting

The syntax-highlighting layer maps each `highlights.scm` capture to a VSCode
**semantic token type**, which the active colour theme paints:

| Capture | Semantic token |
| --- | --- |
| `@comment` | `comment` |
| `@keyword`, `@keyword.conditional`, `@keyword.repeat`, `@boolean`, `@constant.builtin` | `keyword` |
| `@string`, `@string.special`, `@character` | `string` |
| `@number` | `number` |
| `@operator` | `operator` |
| `@property` | `property` |
| `@variable` | `variable` |
| `@variable.builtin` | `variable` + `defaultLibrary` |
| `@function.call`, `@function.builtin` | `function` (`defaultLibrary` on builtins) |

Captures with no entry (e.g. `@punctuation.*`, `@spell`) are left to the editor
default. When several patterns capture the same node, the first pattern in
`highlights.scm` wins — the tree-sitter convention, which is why catch-alls such
as `(identifier) @variable` sit at the bottom of the file.

### Highlights aren't showing?

The resolution logic is verified independently (`node verify.js` prints the
tokens), so missing colour is a *rendering* problem, not a parsing one. Two
usual causes:

1. **Semantic highlighting is off.** VSCode only requests semantic tokens when
   `editor.semanticHighlighting.enabled` is truthy; its global default is
   `"configuredByTheme"`, and some themes disable it. This extension sets a
   per-language default of `true` for `gotmpl`, but that only takes effect once
   the host is **relaunched** (not merely reloaded).
2. **The theme doesn't colour these token types.** Some themes have no semantic
   rules for `variable`/`property`, so those stay default-coloured — but
   `comment`, `string`, `keyword`, `function`, and `number` visibly change under
   a default theme (Dark+ / Default Dark Modern).

**Diagnostic:** open a template, place the cursor on a string or comment, and run
**Developer: Inspect Editor Tokens and Scopes** from the Command Palette.

- A **`semantic token type`** line appears → the provider is firing; the issue is
  theme colours. Switch to Default Dark Modern to confirm, or force colours:

  ```json
  "editor.semanticTokenColorCustomizations": {
    "enabled": true,
    "rules": { "comment": "#6a9955", "string": "#ce9178", "keyword": "#c586c0", "function": "#dcdcaa", "number": "#b5cea8" }
  }
  ```

- **No** semantic token line → the provider isn't being asked. Confirm the panel
  header doesn't say "semantic highlighting: disabled", set
  `"editor.semanticHighlighting.enabled": true`, and relaunch the host so the
  `configurationDefaults` load. Check **Help → Toggle Developer Tools → Console**
  for any error thrown from `provideDocumentSemanticTokens`.

