# Publishing `gotmpl-rainbow` to the VSCode Marketplace

This extension bundles the tree-sitter parser (`tree-sitter-gotmpl.wasm`) and the
rainbow query (`rainbow.scm`) into `dist/` at package time, so the published
`.vsix` is self-contained — it no longer reads the sibling grammar repo.

## Build & package pipeline

| Step | What runs | Output |
| --- | --- | --- |
| `make wasm` | `tree-sitter generate --abi 15 && tree-sitter build --wasm .` in `../` | `../tree-sitter-gotmpl.wasm` |
| `make bundle` (or `npm run build`) | `node build.js` — copies the wasm + `rainbow.scm` into `dist/` | `dist/*` |
| `make package` (or `npm run package`) | `vsce package` (which re-runs the bundle via `vscode:prepublish`) | `gotmpl-rainbow-<version>.vsix` |
| `make publish` (or `npm run publish`) | `vsce publish` | uploaded to Marketplace |

You normally only need **`make package`** or **`make publish`** — both re-bundle
first. Run `make wasm` yourself only after changing the grammar.

## One-time setup

1. **Create a publisher.** The Marketplace requires a publisher ID that matches
   `publisher` in [package.json](package.json) (currently `millergarym`). Create
   or manage it at <https://marketplace.visualstudio.com/manage>. If you use a
   different ID, update `publisher` in `package.json`.

2. **Create an Azure DevOps Personal Access Token (PAT).** Marketplace auth goes
   through Azure DevOps:
   - Sign in at <https://dev.azure.com> with the same account as the publisher.
   - User settings → **Personal Access Tokens** → **New Token**.
   - Organization: **All accessible organizations**.
   - Scopes: **Custom defined** → **Marketplace** → **Manage**.
   - Copy the token (shown once).

3. **Authenticate `vsce`** (pick one):
   - `npx @vscode/vsce login millergarym` and paste the PAT, or
   - export it for non-interactive use: `export VSCE_PAT=<token>`.

## Publish

```sh
# from tree-sitter/vscode-rainbow/
make publish                 # builds assets, then `vsce publish`

# or bump + publish in one go:
npx @vscode/vsce publish patch   # 0.0.1 -> 0.0.2 (also commits/tags if in git)
npx @vscode/vsce publish minor
```

`vsce publish` reads `VSCE_PAT` (or your `vsce login` session). It refuses to
publish if the working tree is dirty unless you pass `--allow-dirty` — commit
first.

## Verify locally before publishing

```sh
make package                 # produces the .vsix without uploading
code --install-extension gotmpl-rainbow-0.0.1.vsix   # install into VSCode
```

Open a `.tmpl`/`.gohtml` file and confirm control keywords are rainbow-coloured
by nesting depth. `make verify` also runs the headless logic check. Full install
options (CLI, GUI, remote hosts, other editors) are in
[SIDELOADING.md](SIDELOADING.md).

## Recommended (optional) polish

- **Icon.** Add a 128×128 `icon.png` to this folder and re-add
  `"icon": "icon.png"` to `package.json` — Marketplace listings look bare
  without one. (It was removed so the package builds with no icon present.)
- **`--pre-release`.** Ship a preview channel with
  `npx @vscode/vsce publish --pre-release`.
- **Open VSX.** To also list on <https://open-vsx.org> (used by VSCodium,
  Cursor, Gitpod): `npx ovsx publish gotmpl-rainbow-<version>.vsix -p <ovsx-token>`.

## What ships in the `.vsix`

Included: `extension.js`, `rainbow-core.js`, `resolve-assets.js`, `dist/`
(parser + query), `LICENSE`, `README.md`, and the `web-tree-sitter` runtime under
`node_modules/`. Excluded via [.vscodeignore](.vscodeignore): `build.js`,
`verify.js`, `Makefile`, `.vscode/`, and dev dependencies.
