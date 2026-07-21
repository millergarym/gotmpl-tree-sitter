# Sideloading the `gotmpl-rainbow` `.vsix`

Sideloading = installing the extension from a local `.vsix` file instead of the
Marketplace. Use it to test a build before publishing, to distribute internally,
or to run on an editor that isn't connected to the Marketplace.

## Build the `.vsix`

```sh
# from tree-sitter/vscode-rainbow/
make package
# -> gotmpl-rainbow-<version>.vsix
```

`make package` bundles the parser + query into `dist/` first, so the `.vsix` is
self-contained. See [PUBLISHING.md](PUBLISHING.md) for the full pipeline.

## Install

### Option A — command line (fastest)

```sh
code --install-extension gotmpl-rainbow-0.0.1.vsix
```

- Use the editor's own CLI: `codium` for VSCodium, `cursor` for Cursor.
- If `code` isn't on your `PATH`, add it from VSCode:
  **Command Palette → “Shell Command: Install 'code' command in PATH”**
  (macOS), or use the absolute path to the binary.
- Force a downgrade / reinstall of the same version:
  `code --install-extension gotmpl-rainbow-0.0.1.vsix --force`.

### Option B — Extensions view (GUI)

1. Open the **Extensions** view (`Cmd`/`Ctrl`+`Shift`+`X`).
2. Click the **`⋯`** (More Actions) menu at the top of the panel.
3. Choose **Install from VSIX…**.
4. Select `gotmpl-rainbow-0.0.1.vsix`.

### Option C — Command Palette

`Cmd`/`Ctrl`+`Shift`+`P` → **Extensions: Install from VSIX…** → pick the file.

### Reload

VSCode usually activates the extension immediately. If highlighting doesn't
appear, run **Developer: Reload Window** (`Cmd`/`Ctrl`+`Shift`+`P`).

## Verify it's working

1. Open a Go template file (`.tmpl`, `.gotmpl`, `.gohtml`, or `.tpl`).
2. Control keywords (`define`/`range`/`if`/`with`/`block`/`else`/`end`) should be
   coloured by nesting depth.
3. Confirm it's installed:

   ```sh
   code --list-extensions --show-versions | grep gotmpl-rainbow
   # millergarym.gotmpl-rainbow@0.0.1
   ```

4. If nothing highlights, run the bundled command
   **“Go template rainbow: Reload parser and query”**, and check
   **Help → Toggle Developer Tools → Console** for load errors.

## Remote / SSH / Dev Containers / WSL

The extension runs where the workspace lives, so install it in that host:

```sh
# with a remote window open:
code --install-extension gotmpl-rainbow-0.0.1.vsix
```

Or copy the `.vsix` to the remote machine and use **Install from VSIX…** from an
Extensions view that is already attached to the remote (the view header shows the
remote name). Installing only into the local host won't highlight files opened
over Remote-SSH/WSL/Containers.

## Other editors (VSCodium, Cursor, Gitpod, Eclipse Theia)

Sideloading a `.vsix` works the same way (CLI or **Install from VSIX…**). These
editors don't use the Microsoft Marketplace, so sideloading — or an
[Open VSX](https://open-vsx.org) publish — is the primary distribution path for
them. The `web-tree-sitter` runtime and `dist/` assets are bundled, so no extra
setup is needed.

## Update to a newer build

Rebuild, then reinstall over the top:

```sh
make package
code --install-extension gotmpl-rainbow-0.0.1.vsix --force
```

If the version number in [package.json](package.json) is unchanged, `--force` is
required to replace the existing install. Bumping the `version` avoids needing
`--force` and makes the swap obvious in the Extensions list.

## Uninstall

```sh
code --uninstall-extension millergarym.gotmpl-rainbow
```

or right-click the extension in the Extensions view → **Uninstall**. The id is
`<publisher>.<name>` from [package.json](package.json).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `code: command not found` | Install the shell command (Option A note) or call the binary by full path. |
| Installs but no colours | File language must be `gotmpl` — check the language indicator in the status bar; the `.vsix` maps `.tmpl/.gotmpl/.gohtml/.tpl`. Run **Reload Window**. |
| “parser not found” error toast | The `.vsix` was built without `dist/`. Rebuild with `make package` (not a bare `vsce package` on a stale tree). |
| Works locally, not over SSH/WSL | Install into the **remote** host (see above), not just the local one. |
| Old version keeps loading | Reinstall with `--force`, or uninstall then reinstall; then **Reload Window**. |
