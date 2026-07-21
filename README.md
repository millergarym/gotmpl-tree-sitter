# tree-sitter-gotmpl

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the **Go
template language** — the syntax parsed by the standard library's
[`text/template`](https://pkg.go.dev/text/template) and
[`html/template`](https://pkg.go.dev/html/template) packages (and by this
repository's `gotmpl` fork).

It ships:

- `grammar.js` — the grammar.
- `queries/highlights.scm` — a syntax-highlighting spec.
- `queries/rainbow.scm` — a **rainbow-delimiter** spec that colours the control
  keywords (`define`, `range`, `if`, `with`, `block`, `else`, `end`, …) by their
  **nesting depth**, so matching blocks are easy to pair up by eye.

## What it parses

| Construct | Example |
| --- | --- |
| Text | `Hello world` |
| Comments (with trim markers) | `{{- /* note */ -}}` |
| Actions / pipelines | `{{ .Name \| printf "%q" \| html }}` |
| Variables & declarations | `{{ $x := add 1 2 }}`, `{{ range $i, $v := .Items }}` |
| `if` / `else if` / `else` / `end` | `{{if .A}}…{{else if .B}}…{{else}}…{{end}}` |
| `range` / `else` / `end` | `{{range .Items}}…{{else}}…{{end}}` |
| `with` / `else` / `end` | `{{with .Opt}}…{{end}}` |
| `define` / `end` | `{{define "name"}}…{{end}}` |
| `block` / `end` | `{{block "name" .}}…{{end}}` |
| `template` | `{{template "name" .}}` |
| `break` / `continue` | `{{break}}`, `{{continue}}` |
| Fields, dot, `$`, literals | `.A.B`, `.`, `$`, `"s"`, `` `raw` ``, `'r'`, `0x1F`, `3.14`, `true`, `nil` |

Both the default (`{{`/`}}`) delimiters and their whitespace-trim variants
(`{{-`/`-}}`) are supported.

## Prerequisites

- The [`tree-sitter` CLI](https://github.com/tree-sitter/tree-sitter) (`0.25+`):
  `cargo install tree-sitter-cli` or `npm install -g tree-sitter-cli`.
- **Node.js** — the CLI runs `grammar.js` through Node when generating.
- **Docker** (optional) — only needed for `tree-sitter build --wasm` / the
  interactive playground. The CLI drives an `emscripten/emsdk` container for you.

---

## Development mode

Everything below is run from this directory (`gotmpl/tree-sitter`).

### 1. Generate the parser

After every change to `grammar.js`, regenerate the C parser in `src/`:

```sh
tree-sitter generate
```

### 2. Parse a file

Print the concrete syntax tree for a template — the fastest feedback loop while
shaping the grammar:

```sh
tree-sitter parse examples/sample.tmpl
```

A non-zero exit status (and red `ERROR`/`MISSING` nodes) means the grammar
failed to parse the input.

### 3. Run the test corpus

The corpus in `test/corpus/` pins expected parse trees:

```sh
tree-sitter test                # run all tests
tree-sitter test -f 'range'     # run tests whose name matches a regex
tree-sitter test --update       # rewrite expectations from current output
```

> Use `--update` only after eyeballing a `tree-sitter parse` result — it blindly
> trusts whatever the grammar currently produces.

### 4. Interactive playground (recommended)

The playground is the nicest way to iterate on the grammar **and** the queries:
it shows the live parse tree next to your input and lets you run queries
interactively. It needs a WASM build (Docker does the compile):

```sh
tree-sitter build --wasm .
tree-sitter playground          # opens http://localhost:8000 in your browser
```

Edit `grammar.js`, re-run `tree-sitter generate && tree-sitter build --wasm .`,
and refresh the page.

### 5. Terminal highlighting

`tree-sitter highlight` renders `queries/highlights.scm` straight in your
terminal. It discovers grammars by file extension via a global config, and it
expects the grammar directory to be named `tree-sitter-<lang>`. Because this
project lives in a directory called `tree-sitter`, expose it under the expected
name once:

```sh
# One-time global config (creates ~/.config/tree-sitter/config.json):
tree-sitter init-config

# Make this grammar discoverable as "tree-sitter-gotmpl":
mkdir -p ~/.tree-sitter-parsers
ln -s "$PWD" ~/.tree-sitter-parsers/tree-sitter-gotmpl
```

Then add `~/.tree-sitter-parsers` to the `parser-directories` array in
`~/.config/tree-sitter/config.json` and run:

```sh
tree-sitter highlight examples/sample.tmpl          # ANSI colours
tree-sitter highlight --html examples/sample.tmpl   # standalone HTML
```

> The terminal highlighter applies a **flat** theme — every keyword gets the
> same colour. Depth-based *rainbow* colouring is an editor feature; see below.

---

## Rainbow delimiters (Neovim)

`queries/rainbow.scm` targets
[**rainbow-delimiters.nvim**](https://github.com/HiPhish/rainbow-delimiters.nvim).
Each control block is a `@container` and its keywords are `@delimiter`s, so
every keyword inside a block is coloured according to that block's nesting
depth. A `{{range}}` nested inside an `{{if}}` gets the next colour in the
palette, and its `{{end}}` matches its opener.

To try it live against the local grammar:

1. Install [`nvim-treesitter`](https://github.com/nvim-treesitter/nvim-treesitter)
   and `rainbow-delimiters.nvim`.

2. Register this grammar as a local parser in your Neovim config:

   ```lua
   local parser_config = require('nvim-treesitter.parsers').get_parser_configs()
   parser_config.gotmpl = {
     install_info = {
       url = '/Users/garymiller/devel/golang/gotmpl/tree-sitter', -- this dir
       files = { 'src/parser.c' },
       generate_requires_npm = false,
       requires_generate_from_grammar = false,
     },
     filetype = 'gotmpl',
   }

   -- Map file extensions to the gotmpl filetype.
   vim.filetype.add({ extension = { tmpl = 'gotmpl', gotmpl = 'gotmpl', gohtml = 'gotmpl', tpl = 'gotmpl' } })
   ```

3. Install the parser and copy the queries into the runtime path:

   ```sh
   nvim -c 'TSInstall gotmpl' -c 'q'

   # queries must live under queries/gotmpl/ on Neovim's runtimepath:
   mkdir -p ~/.config/nvim/queries/gotmpl
   cp queries/highlights.scm queries/rainbow.scm ~/.config/nvim/queries/gotmpl/
   ```

4. Enable both plugins for the `gotmpl` filetype and open
   `examples/sample.tmpl` — control keywords will now be rainbow-coloured by
   depth.

### VSCode

VSCode does not consume `rainbow.scm` directly (that format is
`rainbow-delimiters.nvim`-specific). See [docs/vscode.md](docs/vscode.md) for
two working paths: flat tree-sitter highlighting via the `tree-sitter-vscode`
extension, and a small dev extension that reads `rainbow.scm` and reproduces the
depth-based rainbow.

### Customising the rainbow colours

The palette comes from `rainbow-delimiters.nvim`, not from this repo. Define the
`RainbowDelimiterRed`, `RainbowDelimiterYellow`, … highlight groups (or point
`vim.g.rainbow_delimiters.highlight` at your own groups) to change the colours.
To rainbow a *different* set of tokens (e.g. the `{{`/`}}` braces instead of the
keywords), edit `queries/rainbow.scm` and swap the `@delimiter` captures — for
example `(if_statement (ldelim) @delimiter (rdelim) @delimiter) @container`.

---

## Layout

```
tree-sitter/
├── grammar.js              # the grammar
├── tree-sitter.json        # grammar metadata + highlight query paths
├── package.json            # npm scripts (generate/parse/test/highlight)
├── queries/
│   ├── highlights.scm      # syntax highlighting
│   └── rainbow.scm         # rainbow-delimiters.nvim spec
├── examples/
│   └── sample.tmpl         # a template exercising every construct
├── test/corpus/            # tree-sitter test fixtures
└── src/                    # generated parser (checked in)
```

## Grammar notes & known simplifications

- **`else`/`end`/etc. are reserved.** Like Go's template lexer, the control
  words can never be identifiers, so `{{else}}` is always a clause delimiter,
  never a bare action.
- `.A.B` lexes as two adjacent `field` tokens rather than a single selector
  chain; `$x.A` is a `variable` followed by a `field`. This is intentional — it
  keeps the grammar simple and is sufficient for highlighting.
- The grammar is deliberately lenient in a few spots (e.g. it accepts a `block`
  with no pipeline). It aims to highlight real-world templates, not to reject
  every input the Go parser would.

## Licence

MIT
