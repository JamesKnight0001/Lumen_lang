# Changelog

All notable changes to the Lumen VS Code extension.

## [0.15.0] - compiler v0.77 sync

- Bundles **Lumenlance v1.2.0**, verified against Lumen compiler **v0.77.0**.
- The language surface added since the last release - relative imports
  (`.mod` / `..mod`), default function arguments (`fn f(x=2)`), and numeric map
  keys - is fully recognized by completions, hover, go-to-definition, references,
  rename, and outline. No new keywords were introduced, so syntax highlighting
  was already complete.
- README refreshed to describe the current (type-aware) intelligence level.

## [0.14.1]

- Default to the bundled Lumenlance server when `lumen.lsp.serverPath` is unset.

## [0.14.0]

- Better Lumenlance integration.

## [0.13.2]

- Base extension: syntax highlighting, indentation, completions, hover,
  go-to-definition, references, rename, semantic highlighting, inlay type hints,
  compiler-backed diagnostics, and Run/Build commands.
