const vscode = require("vscode");

const TERMINAL = /^(\s*)(return|break|continue|raise)\b/;

function indentUnit(options) {
  if (options && options.insertSpaces) return " ".repeat(options.tabSize || 4);
  return "\t";
}

function prevCode(doc, lineNo) {
  for (let i = lineNo - 1; i >= 0; i--) {
    const t = doc.lineAt(i).text;
    if (t.trim()) return t;
  }
  return null;
}

const provider = {
  provideOnTypeFormattingEdits(doc, pos, ch, options) {
    if (ch !== "\n") return [];
    const cfg = vscode.workspace.getConfiguration("lumen");
    if (cfg.get("smartDedent") === false) return [];

    const cur = doc.lineAt(pos.line);
    if (cur.text.trim() !== "") return [];

    const prev = prevCode(doc, pos.line);
    if (!prev) return [];
    const m = TERMINAL.exec(prev);
    if (!m) return [];

    const unit = indentUnit(options);
    const prevIndent = m[1];

    let next = prevIndent.endsWith(unit)
      ? prevIndent.slice(0, prevIndent.length - unit.length)
      : prevIndent.replace(/[ \t]$/, "");
    if (next === cur.text) return [];

    return [vscode.TextEdit.replace(
      new vscode.Range(pos.line, 0, pos.line, cur.text.length), next)];
  },
};

function register(context) {
  context.subscriptions.push(
    vscode.languages.registerOnTypeFormattingEditProvider(
      { language: "lumen" }, provider, "\n")
  );
}

module.exports = { register, provider };

