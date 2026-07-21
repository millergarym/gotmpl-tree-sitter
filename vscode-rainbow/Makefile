# Makefile for the gotmpl-rainbow VSCode extension.
#
#   make package   # build assets + produce gotmpl-rainbow-<version>.vsix
#   make publish   # build assets + push to the VSCode Marketplace
#   make verify    # headless sanity check of the rainbow logic
#
# `make publish` needs a Marketplace Personal Access Token: either run
# `npx vsce login <publisher>` once, or export VSCE_PAT. See PUBLISHING.md.

GRAMMAR_DIR := ..
WASM        := $(GRAMMAR_DIR)/tree-sitter-gotmpl.wasm
QUERY       := $(GRAMMAR_DIR)/queries/rainbow.scm
VSCE        := npx --no-install @vscode/vsce

.PHONY: all install wasm bundle verify package publish clean

all: package

# Install runtime + tooling dependencies (web-tree-sitter, @vscode/vsce).
install: node_modules

node_modules: package.json
	npm install
	@touch node_modules

# (Re)generate and build the tree-sitter WASM parser in the grammar repo.
# Only runs when the .wasm is missing; use `make wasm` to force a rebuild.
wasm: $(WASM)

$(WASM):
	cd $(GRAMMAR_DIR) && tree-sitter generate --abi 15 && tree-sitter build --wasm .

# Copy the parser + query into dist/ so they ship inside the .vsix.
bundle: $(WASM) $(QUERY) build.js
	node build.js

# Headless check that the parser + query produce the expected depth buckets.
verify: install bundle
	node verify.js

# Produce gotmpl-rainbow-<version>.vsix (vscode:prepublish re-runs the bundle).
package: install bundle
	$(VSCE) package

# Publish to the VSCode Marketplace.
publish: install bundle
	$(VSCE) publish

clean:
	rm -rf dist *.vsix
