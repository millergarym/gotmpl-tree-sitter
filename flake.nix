{
  description = "Development environment for the tree-sitter-gotmpl grammar";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          # Toolchain for building and testing the parser.
          packages = with pkgs; [
            tree-sitter   # the `tree-sitter` CLI (generate/parse/test/highlight)
            nodejs        # runs grammar.js during `tree-sitter generate` + npm
            graphviz      # `dot` for `tree-sitter parse --dot` graph output
            emscripten    # `tree-sitter build --wasm` (produces the .wasm binary)
          ];

          # Provide a C compiler for the generated parser. On Darwin nix wires up
          # clang with a valid deployment target, which sidesteps the
          # `-mmacosx-version-min=` (empty value) error from the host clang.
          nativeBuildInputs = [ pkgs.clang ];

          shellHook = ''
            # Guard against an empty MACOSX_DEPLOYMENT_TARGET leaking in from the
            # host environment, which makes clang reject `-mmacosx-version-min=`.
            if [ -z "''${MACOSX_DEPLOYMENT_TARGET:-}" ]; then
              unset MACOSX_DEPLOYMENT_TARGET
            fi
            echo "tree-sitter $(tree-sitter --version | cut -d' ' -f2) | node $(node --version)"
          '';
        };
      });
}
