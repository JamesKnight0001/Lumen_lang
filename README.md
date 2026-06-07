# Lumen Syntax Highlighter for VS Code

Syntax highlighting, indentation, and Run/Build commands for the
[Lumen](https://github.com/JamesKnight0001/Lumen) language (`.lm`).

## Build

```sh
npm install
npm run package    # -> lumen-lang-<version>.vsix
```

## Install / dev

- Install the `.vsix`: `code --install-extension lumen-lang-<version>.vsix`
- Or press `F5` in VS Code to launch an Extension Development Host.
- Test the grammar: `npm test`

Set `lumen.path` if `lumen` isn't on your PATH. `F5` runs, `Ctrl+F5` builds.
