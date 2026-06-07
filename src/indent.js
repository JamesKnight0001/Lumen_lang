// Experimental smart on-Enter dedent for Lumen's off-side syntax.
//
// VSCode copies the previous line's indent to the new line. After a terminal
// statement (return/break/continue/raise) that's usually NOT what you want: the
// block is finished, so the new line should sit one level shallower. This
// provider nudges the new (blank) line left by one indent step in that case.
// Conservative: only fires when the new line is blank and the previous code
// line is a terminal statement, so it can't eat real indentation.

const vscode = require("vscode");

const TERMINAL = /^(\s*)(return|break|continue|raise)\b/;

function indentUnit(options) {
  if (options && options.insertSpaces) return " ".repeat(options.tabSize || 4);
  return "\t";
}

// previous non-blank line above `lineNo`
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
    if (cur.text.trim() !== "") return [];           // only act on a blank new line

    const prev = prevCode(doc, pos.line);
    if (!prev) return [];
    const m = TERMINAL.exec(prev);
    if (!m) return [];

    const unit = indentUnit(options);
    const prevIndent = m[1];
    // new indent = prev indent minus one unit (don't go below zero)
    let next = prevIndent.endsWith(unit)
      ? prevIndent.slice(0, prevIndent.length - unit.length)
      : prevIndent.replace(/[ \t]$/, "");
    if (next === cur.text) return [];                // already correct

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
