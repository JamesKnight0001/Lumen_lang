// Live diagnostics: flag identifiers that are used but never declared/imported
// ("X is not defined"), Python-style. Deliberately CONSERVATIVE: we only flag a
// bare identifier in a value/call position that matches nothing we can see, so
// valid programs stay clean. Anything after a "." (method/field), inside a
// string or comment, or used as a struct-field label is skipped.

const vscode = require("vscode");
const syms = require("./symbols");
const fs = require("fs");
const path = require("path");

// always-defined names: builtins, keywords, types, module roots, literals
function baseNames(lang) {
  const s = new Set();
  for (const k of lang.KW) s.add(k);
  for (const t of lang.TYPES) s.add(t);
  for (const b of Object.keys(lang.BUILTINS)) s.add(b);
  for (const m of Object.keys(lang.MODULES)) s.add(m);
  for (const x of ["self", "true", "false", "nil"]) s.add(x);
  return s;
}

// resolve a module path ("rng", "lib.mathx") to a sibling .lm file
function resolveModule(dir, mod) {
  const rel = mod.split(".").join(path.sep) + ".lm";
  const cands = [path.join(dir, rel), path.join(dir, mod.split(".").pop() + ".lm")];
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch (_) {} }
  return null;
}

// top-level (non-local) symbol names exported by an imported .lm file.
// `import X` in Lumen exposes X's top-level fns/structs unqualified, so we add
// them. Recurses one level only (re-exports are rare); guarded by `seen`.
function importedNames(doc, seen) {
  const names = new Set();
  let dir;
  try { dir = path.dirname(doc.uri.fsPath); } catch (_) { return names; }
  if (!dir) return names;

  const text = doc.getText();
  for (const line of text.split(/\r?\n/)) {
    const im = line.match(/^\s*import\s+([A-Za-z_][\w.]*)/);
    const fm = line.match(/^\s*from\s+([A-Za-z_][\w.]*)\s+import\b/);
    const mod = (im && im[1]) || (fm && fm[1]);
    if (!mod) continue;
    const file = resolveModule(dir, mod);
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let src;
    try { src = fs.readFileSync(file, "utf8"); } catch (_) { continue; }
    const fdoc = { getText: () => src, uri: { fsPath: file } };
    for (const s of syms.scan(fdoc)) if (!s.local) names.add(s.name);
  }
  return names;
}

// blank out strings and comments on a line so we don't scan inside them.
// keeps length so columns stay correct.
function strip(line) {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === "#") { out += " ".repeat(line.length - i); break; }
    if (c === '"' || c === "'") {
      const q = c;
      out += " "; i++;
      while (i < line.length && line[i] !== q) {
        if (line[i] === "\\") { out += "  "; i += 2; continue; }
        out += " "; i++;
      }
      if (i < line.length) { out += " "; i++; }
      continue;
    }
    // f-string prefix: blank the leading f so it isn't seen as an identifier
    if ((c === "f") && (line[i + 1] === '"' || line[i + 1] === "'")) { out += " "; i++; continue; }
    out += c; i++;
  }
  return out;
}

const WORD = /[A-Za-z_][A-Za-z0-9_]*/g;

function check(doc, lang) {
  const defined = baseNames(lang);
  for (const s of syms.scan(doc)) defined.add(s.name);
  // names brought in by imports of sibling .lm files (cross-file)
  for (const n of importedNames(doc, new Set())) defined.add(n);

  const text = doc.getText();
  const lines = text.split(/\r?\n/);
  const diags = [];
  let inBlock = false; // inside a #[ ]# multi-line comment

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];

    // multi-line #[ ]# block comment: skip every line until the closer
    if (inBlock) {
      if (raw.includes("]#")) inBlock = false;
      continue;
    }
    const open = raw.indexOf("#[");
    if (open !== -1 && raw.indexOf("]#", open) === -1) { inBlock = true; continue; }

    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const line = strip(raw);

    let m;
    WORD.lastIndex = 0;
    while ((m = WORD.exec(line))) {
      const word = m[0];
      const start = m.index;
      const end = start + word.length;
      const prev = line[start - 1];
      const after = line.slice(end);

      if (prev === ".") continue;               // member access: x.foo
      if (prev && /[0-9.]/.test(prev)) continue; // number tail: 2.0e10 -> "e10", 1_000_000 -> "_000_000"
      if (/^\d/.test(word)) continue;            // number-led (guard)
      if (defined.has(word)) continue;           // known

      // skip a declaration site itself (let X, fn X, struct X, param, field label)
      const before = line.slice(0, start);
      if (/\b(let|mut|fn|struct|enum|trait|impl|import|as)\s+$/.test(before)) continue;
      if (/\bfrom\s+\S+\s+import\s+$/.test(before)) continue;
      // struct-field label inside a call/decl:  Name(x: ..)  or  x: type
      if (/^\s*:/.test(after) && !/^\s*::/.test(after)) continue;

      // f-string interpolation braces etc. are already stripped; remaining bare
      // unknown identifier in a value position -> flag it.
      const range = new vscode.Range(ln, start, ln, end);
      diags.push(new vscode.Diagnostic(
        range, `'${word}' is not defined`, vscode.DiagnosticSeverity.Warning));
    }
  }
  return diags;
}

// Convert a compiler error to a VSCode Diagnostic with a precise range.
function toDiag(doc, e) {
  const lineIdx = Math.max(0, (e.line || 1) - 1);
  let startCh = e.col || 0;
  let endCh = e.endCol;
  try {
    const text = doc.lineAt(lineIdx).text;
    // no caret width: underline from the column to end of the trimmed line
    if (endCh == null) {
      const trimmedEnd = text.replace(/\s+$/, "").length;
      endCh = Math.max(startCh + 1, trimmedEnd);
    }
    // clamp to the line
    startCh = Math.min(startCh, text.length);
    endCh = Math.min(Math.max(endCh, startCh + 1), Math.max(text.length, startCh + 1));
  } catch (_) { endCh = (endCh == null) ? startCh + 1 : endCh; }
  const range = new vscode.Range(lineIdx, startCh, lineIdx, endCh);
  const sev = e.severity === "warning"
    ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
  const d = new vscode.Diagnostic(range, e.message, sev);
  d.source = "lumen";
  return d;
}

function register(context, lang) {
  const compiler = require("./compiler");
  const col = vscode.languages.createDiagnosticCollection("lumen");
  context.subscriptions.push(col);

  const getCfg = () => vscode.workspace.getConfiguration("lumen").get("path");
  const versions = new Map(); // uri -> last dispatched run id (to drop stale results)

  const run = (doc) => {
    if (!doc || doc.languageId !== "lumen") return;
    if (vscode.workspace.getConfiguration("lumen").get("diagnostics") === false) {
      col.delete(doc.uri); return;
    }
    const key = doc.uri.toString();
    const id = (versions.get(key) || 0) + 1;
    versions.set(key, id);

    const realPath = (doc.uri && doc.uri.fsPath) || null;
    compiler.checkSource(doc.getText(), realPath, getCfg, (res) => {
      if (versions.get(key) !== id) return;            // a newer run superseded us
      if (res.unavailable) {                            // no compiler -> regex fallback
        col.set(doc.uri, check(doc, lang));
        return;
      }
      col.set(doc.uri, (res.errors || []).map((e) => toDiag(doc, e)));
    });
  };

  // debounce live checks ~400ms after the last edit (runs the compiler async)
  const timers = new Map();
  const runSoon = (doc) => {
    if (!doc || doc.languageId !== "lumen") return;
    const key = doc.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); run(doc); }, 400));
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(run),
    vscode.workspace.onDidChangeTextDocument((e) => runSoon(e.document)),
    vscode.workspace.onDidSaveTextDocument(run),
    vscode.workspace.onDidCloseTextDocument((d) => { versions.delete(d.uri.toString()); col.delete(d.uri); })
  );
  if (vscode.window.activeTextEditor) run(vscode.window.activeTextEditor.document);
  for (const d of vscode.workspace.textDocuments) run(d);
}

module.exports = { register, check, strip };
