# Lumen for VS Code

VS Code support for the [Lumen](https://github.com/JamesKnight0001/Lumen) language (`.lm`), powered by the bundled **Lumenlance** language server.
**LumenLance** is Closed sourced, I will be the one providing it.

## Features

- Syntax highlighting and indentation support
- Autocomplete for keywords, types, builtins, modules, methods, and snippets
- Hover, signature help, and inlay type hints
- Go-to-definition, references, and rename
- Semantic highlighting, outline view, and breadcrumbs
- Compiler-backed diagnostics via `lumen check`
- Optional smart dedent after `return`, `break`, `continue`, and `raise`
- **F5**: Run current file
- **Ctrl+F5**: Build and run native executable

## Language Server

Code intelligence is provided by **Lumenlance**, a Rust LSP built on the Lumen compiler and bundled with the extension.

Because it shares the compiler's parser and declaration data, navigation, completions, and diagnostics closely match compiler behavior. If the server is unavailable or disabled, the extension falls back to built-in providers while retaining compiler-backed diagnostics.

## Settings

| Setting | Description |
|----------|-------------|
| `lumen.path` | Path to the `lumen` executable |
| `lumen.diagnostics` | Enable live compiler diagnostics |
| `lumen.smartDedent` | Enable smart dedent |
| `lumen.lsp.enabled` | Enable the Lumenlance server |
| `lumen.lsp.serverPath` | Override bundled server path |

## Build

```sh
npm install
npm run package
```

To package with the bundled server:

```sh
(cd ../Lumenlance/server && cargo build --release)
```

## Install & Development

- Install VSIX: `code --install-extension lumen-lang-<version>.vsix`
- Launch extension host: `F5`
- Run tests: `npm test`

If `lumen` is not on your PATH, set `lumen.path`.

## Notes

The Build command compiles and then runs the produced executable, automatically using the correct command sequencing for cmd, PowerShell, and Unix shells.

## Warning
This is still very basic, not complete intelligence,