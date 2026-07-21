# gotmpl-rainbow

A VSCode extension that reproduces the Neovim
`rainbow-delimiters.nvim` behaviour for Go templates: it parses the document
with the tree-sitter grammar, runs [`../queries/rainbow.scm`](../queries/rainbow.scm),
and paints each control keyword (`define`/`range`/`if`/`with`/`block`/`else`/
`end`) with a colour chosen by its **block nesting depth**.

VSCode has no built-in consumer for `rainbow.scm`; this extension is the bridge.
See [../docs/vscode.md](../docs/vscode.md) for the full write-up (and Option A,
flat highlighting via the `tree-sitter-vscode` extension).

## Files

| File | Role |
| --- | --- |
| `extension.js` | VSCode glue: activation, parsing, decorations, config/reload. |
| `rainbow-core.js` | Pure depth/bucketing logic — no `vscode` dependency. |
| `resolve-assets.js` | Locates the parser/query: config override → bundled `dist/` → sibling grammar repo. |
| `verify.js` | Headless check of the core logic (no VSCode needed). |
| `build.js` | Copies the parser + `rainbow.scm` into `dist/` for packaging. |
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
| `gotmplRainbow.colors` | 7-colour palette | Rainbow palette; depth wraps around. |
| `gotmplRainbow.bold` | `true` | Render coloured keywords in bold. |

Command **`Go template rainbow: Reload parser and query`** re-reads the WASM and
`.scm` files without restarting the host — handy while editing `rainbow.scm`.

## What's verified

`node verify.js` exercises everything except the VSCode decoration API: it loads
the real WASM parser, runs `rainbow.scm`, and prints the depth/colour each
keyword receives. The `vscode`-specific glue in `extension.js` is exercised by
launching the Extension Development Host (step 4).
