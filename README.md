# Lumen for VS Code

Full language support for the
[Lumen](https://github.com/JamesKnight0001/Lumen) language (`.lm`) - syntax
highlighting, code intelligence, compiler-backed diagnostics, and Run/Build -
powered by the **Lumenlance** language server (bundled).

## Features

- **Syntax highlighting** (TextMate grammar) and off-side indentation.
- **Autocomplete**: keywords, types, the global builtins, block snippets
  (`fn`, `if`, `for`, `while`, `struct`, `match`, `try`, ...), built-in modules
  (`math`, `os`, `rand`, `time`, `json`, `cffi`) and their members after a dot,
  and the string/list/map methods after a dot.
- **Hover** with inferred types, **signature help** (active-parameter aware),
  and **inlay type hints**.
- **Go-to-definition** (Ctrl+Click / F12), **find references**, and **rename** -
  scope-aware and cross-file, for your own `fn`, `let`/`mut`, `struct`, fields,
  params, and imports.
- **Semantic highlighting** and an **outline view** / breadcrumbs from your
  declarations.
- **Diagnostics powered by the real Lumen compiler** (`lumen check`): exactly
  what the compiler reports, never a false positive. Catches syntax errors,
  undefined names, unresolved methods/keys, arity mismatches, and more. Runs
  ~400ms after you stop typing and on save; works on unsaved buffers and
  multi-file projects (imports resolve).
- **Experimental smart dedent**: after `return`/`break`/`continue`/`raise`,
  Enter drops the new line one indent level (toggle `lumen.smartDedent`).
- **`F5`** runs the current file, **`Ctrl+F5`** builds and runs the native exe.

## Architecture

Code intelligence is served by the **Lumenlance** language server, a Rust LSP
built directly on the Lumen compiler (`lumenc`) and bundled with this extension
at `server/lumenlance.exe`. Because it shares the compiler's own lexer and
parser, navigation and diagnostics agree with how the compiler actually reads
your code.

As of compiler **v0.72.0**, the server uses compiler-authoritative declaration
spans (`lumen decls` / `parse_program_spanned`, decision **D2b**) to verify its
in-server span recognizer never drifts from the compiler - checked over the
whole example corpus with zero disagreement. If the server binary is missing or
`lumen.lsp.enabled` is off, the extension falls back to its in-process providers
and the compiler-backed diagnostics still work.

All completion/highlight tables are taken verbatim from the Lumen compiler
(`lexer.rs` keywords, `builtins.rs` `MODULE_FUNCS`, `interp.rs` method
dispatch), so the editor never suggests something the compiler rejects.

## Settings

- `lumen.path` - path to the `lumen` executable (default `lumen`; auto-detects
  the per-user install at `%LOCALAPPDATA%\Lumen\bin\lumen.exe`).
- `lumen.diagnostics` - show live compiler errors (default `true`).
- `lumen.smartDedent` - experimental on-Enter dedent (default `true`).
- `lumen.lsp.enabled` - use the Lumenlance server for richer intelligence
  (default `true`).
- `lumen.lsp.serverPath` - override the bundled server binary (default empty =
  use bundled, or a local Lumenlance build during development).

## Build

```sh
npm install
npm run package    # -> lumen-lang-<version>.vsix
```

`npm run package` first runs `scripts/bundle-server.js`, which copies the
release server from `../Lumenlance/server/target/release/` into `./server/` so
`vsce` packs it. Build that binary first:

```sh
(cd ../Lumenlance/server && cargo build --release)
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
