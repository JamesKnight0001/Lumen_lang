const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { startClient, stopClient } = require("./client");

const termName = "Lumen";
let statusItem;

function getTerminal() {
  let term = vscode.window.terminals.find((t) => t.name === termName);
  if (!term) term = vscode.window.createTerminal(termName);
  return term;
}

function quote(p) {
  return /\s/.test(p) ? `"${p}"` : p;
}

function installedBin() {
  if (process.platform !== "win32") return null;
  const base = process.env.LOCALAPPDATA;
  if (!base) return null;
  const p = path.join(base, "Lumen", "bin", "lumen.exe");
  return fs.existsSync(p) ? p : null;
}

function lumenBin() {
  const cfg = vscode.workspace.getConfiguration("lumen");
  const set = cfg.get("path");
  if (set && set !== "lumen") return set;
  return installedBin() || "lumen";
}

function shellKind() {
  const plat = process.platform;
  const osKey = plat === "win32" ? "windows" : plat === "darwin" ? "osx" : "linux";
  const cfg = vscode.workspace.getConfiguration("terminal.integrated");
  const legacy = cfg.get("shell." + osKey) || "";

  let prof = "";
  try {
    const name = cfg.get("defaultProfile." + osKey);
    const profs = cfg.get("profiles." + osKey) || {};
    if (name && profs[name]) {
      const p = profs[name];
      prof = (p.path || (Array.isArray(p.source) ? "" : p.source) || "") + " " + name;
    } else if (name) {
      prof = String(name);
    }
  } catch (_) {}

  const hay = (legacy + " " + prof).toLowerCase();
  if (/pwsh|powershell/.test(hay)) return "powershell";
  if (/cmd(\.exe)?\b/.test(hay)) return "cmd";
  if (/bash|zsh|sh\b|fish|git.?bash|wsl/.test(hay)) return "posix";
  return plat === "win32" ? "powershell" : "posix";
}

function chainAnd(a, b, kind) {
  if (kind === "powershell") return `${a}; if ($?) { ${b} }`;
  return `${a} && ${b}`;
}

function invoke(cmd, kind) {
  return kind === "powershell" ? `& ${cmd}` : cmd;
}

async function activeFile() {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.document.languageId !== "lumen") {
    vscode.window.showErrorMessage("Lumen: no .lm file is active.");
    return null;
  }
  await ed.document.save();
  return ed.document.fileName;
}

async function run(mode) {
  const file = await activeFile();
  if (!file) return;

  const kind = shellKind();
  const bin = quote(lumenBin());
  const f = quote(file);
  const term = getTerminal();
  term.show(true);

  if (mode === "build") {
    const exe = process.platform === "win32"
      ? file.replace(/\.lm$/i, ".exe")
      : file.replace(/\.lm$/i, "");
    const q = quote(exe);
    term.sendText(chainAnd(`${bin} build ${f} -o ${q}`, invoke(q, kind), kind));
  } else {
    term.sendText(`${bin} run ${f}`);
  }
}

function syncStatus(ed) {
  if (!statusItem) return;
  if (ed && ed.document.languageId === "lumen") statusItem.show();
  else statusItem.hide();
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("lumen.run", () => run("run")),
    vscode.commands.registerCommand("lumen.build", () => run("build"))
  );

  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = "lumen.run";
  statusItem.text = "$(play) Run Lumen";
  statusItem.tooltip = "Run the current Lumen file";
  context.subscriptions.push(statusItem);

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(syncStatus));
  syncStatus(vscode.window.activeTextEditor);

  const cfg = vscode.workspace.getConfiguration();
  let lspStarted = false;
  if (cfg.get("lumen.lsp.enabled") !== false) {
    try {
      lspStarted = !!startClient(context, cfg);
    } catch (_) {
      lspStarted = false;
    }
  }
  context.subscriptions.push({ dispose: () => stopClient() });

  if (lspStarted) {
    require("./indent").register(context);
  } else {
    require("./lang").register(context);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };

