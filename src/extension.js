const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

const termName = "Lumen";
let statusItem;

function getTerminal() {
  let term = vscode.window.terminals.find((t) => t.name === termName);
  if (!term) term = vscode.window.createTerminal(termName);
  return term;
}

/** Quote a path if it contains spaces. */
function quote(p) {
  return /\s/.test(p) ? `"${p}"` : p;
}

/** Auto-detected install path: %LOCALAPPDATA%\Lumen\bin\lumen.exe (Windows). */
function installedBin() {
  if (process.platform !== "win32") return null;
  const base = process.env.LOCALAPPDATA;
  if (!base) return null;
  const p = path.join(base, "Lumen", "bin", "lumen.exe");
  return fs.existsSync(p) ? p : null;
}

/** Resolve the lumen binary: explicit setting > installed dir > "lumen" on PATH. */
function lumenBin() {
  const cfg = vscode.workspace.getConfiguration("lumen");
  const set = cfg.get("path");
  // treat the default "lumen" as "not explicitly set" so auto-detect can win
  if (set && set !== "lumen") return set;
  return installedBin() || "lumen";
}

/** Save and return the active .lm file path, or null. */
async function activeLumenFile() {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.document.languageId !== "lumen") {
    vscode.window.showErrorMessage("Lumen: no .lm file is active.");
    return null;
  }
  await ed.document.save();
  return ed.document.fileName;
}

async function run(mode) {
  const file = await activeLumenFile();
  if (!file) return;

  const bin = quote(lumenBin());
  const f = quote(file);
  const term = getTerminal();
  term.show(true);

  if (mode === "build") {
    const exe = process.platform === "win32"
      ? file.replace(/\.lm$/i, ".exe")
      : file.replace(/\.lm$/i, "");
    const q = quote(exe);
    term.sendText(`${bin} build ${f} -o ${q} && ${q}`);
  } else {
    term.sendText(`${bin} run ${f}`);
  }
}

/** Show the status-bar Run item only for .lm files. */
function syncStatus(ed) {
  if (!statusItem) return;
  if (ed && ed.document.languageId === "lumen") {
    statusItem.show();
  } else {
    statusItem.hide();
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("lumen.run", () => run("run")),
    vscode.commands.registerCommand("lumen.build", () => run("build"))
  );

  statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusItem.command = "lumen.run";
  statusItem.text = "$(play) Run Lumen";
  statusItem.tooltip = "Run the current Lumen file";
  context.subscriptions.push(statusItem);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(syncStatus)
  );
  syncStatus(vscode.window.activeTextEditor);
}

function deactivate() {}

module.exports = { activate, deactivate };
