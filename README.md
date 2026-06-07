# Lumen Syntax Highlighter for VS Code

Syntax highlighting, indentation, autocomplete, hover, signature help, and
Run/Build commands for the
[Lumen](https://github.com/JamesKnight0001/Lumen) language (`.lm`).

## Features

- Syntax highlighting (TextMate grammar) and off-side indentation.
- Autocomplete: keywords, types, the 19 global builtins, block snippets
  (`fn`, `if`, `for`, `while`, `struct`, `match`, `try`, ...), built-in
  modules (`math`, `os`, `rand`, `time`, `json`, `cffi`) and their members
  after a dot, and the 29 string/list/map methods after a dot.
- Hover docs and signature help for builtins and module functions.
- Go-to-definition (Ctrl+Click / F12) and hover for your own `fn`, `let`/`mut`,
  `struct`/`enum`/`trait`, fields, and params. Hover shows the declaration, its
  parent (e.g. "method of Point"), and any `#` comment above it as a summary.
- Outline view and breadcrumbs from your declarations.
- Diagnostics: **powered by the real Lumen compiler** (`lumen check`), so they
  are exactly what the compiler reports and never false-positive. Catches syntax
  errors, undefined names, unresolved methods/keys, arity mismatches, and more.
  Runs ~400ms after you stop typing and on save; works on unsaved buffers and
  multi-file projects (imports resolve). Falls back to a conservative built-in
  checker if `lumen` isn't found. Toggle with `lumen.diagnostics`.
- Experimental smart dedent: after `return`/`break`/`continue`/`raise`, Enter
  drops the new line one indent level (toggle `lumen.smartDedent`).
- `F5` runs the current file, `Ctrl+F5` builds and runs the native exe.

All completion/highlight tables are taken verbatim from the Lumen compiler
(`lexer.rs` keywords, `builtins.rs` `MODULE_FUNCS`, `interp.rs` method
dispatch), so the editor never suggests something the compiler rejects.

## Build

```sh
npm install
npm run package    # -> lumen-lang-<version>.vsix
```

## Install / dev

- Install the `.vsix`: `code --install-extension lumen-lang-<version>.vsix`
- Or press `F5` in VS Code to launch an Extension Development Host.
- Run the tests: `npm test`

Set `lumen.path` if `lumen` isn't on your PATH. `F5` runs, `Ctrl+F5` builds.

## Notes

The Build command sequences "compile, then run the produced exe". It detects
the integrated terminal shell and emits shell-correct sequencing: `A && B`
for cmd/bash, and `A; if ($?) { & B }` for PowerShell - Windows PowerShell 5.1
rejects `&&` as a statement separator, so the old hard-coded `&&` is gone.
