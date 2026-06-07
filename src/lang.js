const vscode = require("vscode");
const syms = require("./symbols");

const KW = [
  "let", "mut", "fn", "if", "elif", "else", "for", "in", "while", "return",
  "match", "case", "struct", "enum", "trait", "impl", "import", "from", "as",
  "export", "extern", "dynamic", "weak", "and", "or", "not", "true", "false",
  "nil", "break", "continue", "try", "catch", "raise", "do", "end", "self",
  "with",
];

const TYPES = [
  "i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "f32", "f64",
  "int", "float", "bool", "str", "list", "map", "ptr",
];

const BUILTINS = {
  print:    { sig: "print(*args)",        doc: "Print values space-separated, then a newline." },
  len:      { sig: "len(x) -> int",       doc: "Length of a str, list, or map." },
  str:      { sig: "str(x) -> str",       doc: "Convert to string." },
  int:      { sig: "int(x) -> int",       doc: "Convert a number or numeric string to int." },
  float:    { sig: "float(x) -> float",   doc: "Convert a number or numeric string to float." },
  type:     { sig: "type(x) -> str",      doc: "Runtime type name." },
  input:    { sig: "input(prompt?) -> str", doc: "Read a line from stdin." },
  range:    { sig: "range(stop) | range(start, stop[, step])", doc: "Integer range." },
  sum:      { sig: "sum(list) -> number", doc: "Sum a list of numbers." },
  min:      { sig: "min(a, b, ...) | min(list)", doc: "Smallest value." },
  max:      { sig: "max(a, b, ...) | max(list)", doc: "Largest value." },
  abs:      { sig: "abs(x) -> number",    doc: "Absolute value." },
  ord:      { sig: "ord(ch) -> int",      doc: "Code point of a 1-char string." },
  chr:      { sig: "chr(n) -> str",       doc: "1-char string for a code point." },
  is_digit: { sig: "is_digit(s) -> bool", doc: "All chars are digits." },
  is_alpha: { sig: "is_alpha(s) -> bool", doc: "All chars are alphabetic." },
  is_space: { sig: "is_space(s) -> bool", doc: "All chars are whitespace." },
  assert:   { sig: "assert(cond, msg?)",  doc: "Abort if cond is false." },
  drop:     { sig: "drop(x)",             doc: "Release a value / resource." },
};

const METHODS = {
  len:         "len() -> int",
  upper:       "upper() -> str",
  lower:       "lower() -> str",
  title:       "title() -> str",
  contains:    "contains(x) -> bool",
  find:        "find(sub) -> int  (-1 if absent)",
  replace:     "replace(old, new) -> str",
  starts_with: "starts_with(prefix) -> bool",
  ends_with:   "ends_with(suffix) -> bool",
  lstrip:      "lstrip() -> str",
  rstrip:      "rstrip() -> str",
  trim:        "trim() -> str",
  split:       "split(sep) -> list",
  repeat:      "repeat(n) -> str|list",
  join:        "join(list) -> str",
  push:        "push(x)",
  pop:         "pop() -> value",
  insert:      "insert(i, x)",
  index:       "index(x) -> int",
  count:       "count(x) -> int",
  map:         "map(fn) -> list",
  filter:      "filter(fn) -> list",
  sort:        "sort()",
  reverse:     "reverse()",
  has:         "has(key) -> bool",
  get:         "get(key, default?) -> value",
  keys:        "keys() -> list",
  values:      "values() -> list",
  remove:      "remove(key)",
};

const MODULES = {
  math: {
    sqrt: 1, sin: 1, cos: 1, tan: 1, abs: 1, floor: 1, ceil: 1, pow: 2,
    log: 1, log10: 1, exp: 1, pi: 0, e: 0, tau: 0, inf: 0, log2: 1, cbrt: 1,
    asin: 1, acos: 1, atan: 1, atan2: 2, sinh: 1, cosh: 1, tanh: 1, hypot: 2,
    round: 1, trunc: 1, min: 2, max: 2, sign: 1, deg: 1, rad: 1, isnan: 1,
    isinf: 1, gcd: 2, lcm: 2, factorial: 1, fmod: 2, copysign: 2, log1p: 1,
    expm1: 1, isfinite: 1,
  },
  os: {
    read: 1, write: 2, append: 2, exists: 1, is_file: 1, is_dir: 1, remove: 1,
    rmdir: 1, rename: 2, mkdir: 1, listdir: 1, getenv: 1, setenv: 2, cwd: 0,
    time: 0, clock: 0, getpid: 0, sep: 0, platform: 0, system: 1, exec: 1,
    exit: 1, args: 0,
  },
  rand: { seed: 1, int: 2, float: 0 },
  time: { now: 0, format: 1, sleep: 1 },
  json: { stringify: 1, parse: 1 },
  net: {
    listen: 2, accept: 1, connect: 2, udp: 2, send: 2, recv: 2, sendto: 4,
    recvfrom: 2, close: 1, shutdown: 2, set_timeout: 2, set_blocking: 2,
    set_opt: 3, poll: 2, resolve: 1, local_port: 1, errno: 0,
  },
  cffi: {
    cbuf: 1, len: 1, addr: 1, set_i8: 3, set_i16: 3, set_i32: 3, set_i64: 3,
    set_ptr: 3, set_f32: 3, set_f64: 3, get_i8: 2, get_i16: 2, get_i32: 2,
    get_i64: 2, get_ptr: 2, get_f32: 2, get_f64: 2, vcall: 4, peek_i64: 1,
    poke_i64: 2, peek_i32: 1, poke_i32: 2, str_ptr: 1, guid: 1, callback: 1,
  },
};
const MODS = Object.keys(MODULES);

const SNIPS = [
  ["fn",     "fn ${1:name}(${2:args}):\n\t$0",             "function"],
  ["if",     "if ${1:cond}:\n\t$0",                        "if"],
  ["elif",   "elif ${1:cond}:\n\t$0",                      "elif"],
  ["else",   "else:\n\t$0",                                "else"],
  ["for",    "for ${1:item} in ${2:iter}:\n\t$0",          "for"],
  ["while",  "while ${1:cond}:\n\t$0",                      "while"],
  ["struct", "struct ${1:Name}:\n\t$0",                    "struct"],
  ["enum",   "enum ${1:Name}:\n\t$0",                      "enum"],
  ["trait",  "trait ${1:Name}:\n\t$0",                     "trait"],
  ["impl",   "impl ${1:Name}:\n\t$0",                       "impl"],
  ["match",  "match ${1:expr}:\n\tcase ${2:pat}:\n\t\t$0",  "match"],
  ["try",    "try:\n\t${1}\ncatch ${2:err}:\n\t$0",         "try/catch"],
  ["import", "import ${1:module}",                          "import"],
];

const C = vscode.CompletionItemKind;

function kwItem(s) {
  const it = new vscode.CompletionItem(s, C.Keyword);
  it.detail = "keyword";
  return it;
}
function typeItem(s) {
  const it = new vscode.CompletionItem(s, C.TypeParameter);
  it.detail = "type";
  return it;
}
function fnItem(name) {
  const b = BUILTINS[name];
  const it = new vscode.CompletionItem(name, C.Function);
  it.detail = b.sig;
  it.documentation = new vscode.MarkdownString(b.doc);
  it.insertText = new vscode.SnippetString(`${name}($0)`);
  return it;
}
function snipItem([trig, body, label]) {
  const it = new vscode.CompletionItem(trig, C.Snippet);
  it.detail = label;
  it.insertText = new vscode.SnippetString(body);
  it.sortText = "0" + trig;
  return it;
}
function modItem(name) {
  const it = new vscode.CompletionItem(name, C.Module);
  it.detail = "module";
  it.documentation = new vscode.MarkdownString(
    `Members: ${Object.keys(MODULES[name]).join(", ")}`
  );
  return it;
}
function memItem(mod, name) {
  const ar = MODULES[mod][name];
  const it = new vscode.CompletionItem(name, ar === 0 ? C.Constant : C.Function);
  it.detail = ar === 0 ? `${mod}.${name}` : `${mod}.${name}(${"_, ".repeat(ar).replace(/, $/, "")})`;
  if (ar > 0) it.insertText = new vscode.SnippetString(`${name}($0)`);
  return it;
}
function methItem(name) {
  const it = new vscode.CompletionItem(name, C.Method);
  it.detail = METHODS[name];
  it.insertText = new vscode.SnippetString(`${name}($0)`);
  return it;
}

function ctxAt(doc, pos) {
  const line = doc.lineAt(pos.line).text.slice(0, pos.character);
  const m = line.match(/\b([a-z]+)\.([A-Za-z_][A-Za-z0-9_]*)?$/);
  if (m && MODS.includes(m[1])) return { kind: "member", mod: m[1] };
  if (/\.[A-Za-z_]*$/.test(line)) return { kind: "method" };
  return { kind: "top" };
}

const completion = {
  provideCompletionItems(doc, pos) {
    const c = ctxAt(doc, pos);
    if (c.kind === "member") return Object.keys(MODULES[c.mod]).map((n) => memItem(c.mod, n));
    if (c.kind === "method") return Object.keys(METHODS).map(methItem);

    const items = [];
    for (const k of KW) items.push(kwItem(k));
    for (const t of TYPES) items.push(typeItem(t));
    for (const b of Object.keys(BUILTINS)) items.push(fnItem(b));
    for (const m of MODS) items.push(modItem(m));
    for (const s of SNIPS) items.push(snipItem(s));
    return items;
  },
};

const hover = {
  provideHover(doc, pos) {
    const range = doc.getWordRangeAtPosition(pos, /[A-Za-z_][A-Za-z0-9_]*/);
    if (!range) return;
    const word = doc.getText(range);
    const before = doc.lineAt(pos.line).text.slice(0, range.start.character);

    const mm = before.match(/\b([a-z]+)\.$/);
    if (mm && MODULES[mm[1]] && MODULES[mm[1]][word] !== undefined) {
      const ar = MODULES[mm[1]][word];
      const md = new vscode.MarkdownString();
      md.appendCodeblock(ar === 0 ? `${mm[1]}.${word}` : `${mm[1]}.${word}(...)  // arity ${ar}`, "lumen");
      return new vscode.Hover(md, range);
    }
    if (/\.$/.test(before) && METHODS[word]) {
      const md = new vscode.MarkdownString();
      md.appendCodeblock(METHODS[word], "lumen");
      return new vscode.Hover(md, range);
    }
    if (MODULES[word]) {
      return new vscode.Hover(
        `**${word}** module - members: ${Object.keys(MODULES[word]).join(", ")}`, range);
    }
    if (BUILTINS[word]) {
      const md = new vscode.MarkdownString();
      md.appendCodeblock(BUILTINS[word].sig, "lumen");
      md.appendMarkdown("\n\n" + BUILTINS[word].doc);
      return new vscode.Hover(md, range);
    }
    if (KW.includes(word)) return new vscode.Hover(`**${word}** - keyword`, range);
    if (TYPES.includes(word)) return new vscode.Hover(`**${word}** - type`, range);
    return syms.userHover(doc, pos);
  },
};

const sigHelp = {
  provideSignatureHelp(doc, pos) {
    const line = doc.lineAt(pos.line).text.slice(0, pos.character);

    let depth = 0, open = -1;
    for (let i = line.length - 1; i >= 0; i--) {
      const ch = line[i];
      if (ch === ")") depth++;
      else if (ch === "(") { if (depth === 0) { open = i; break; } depth--; }
    }
    if (open < 0) return;
    const head = line.slice(0, open);
    const id = head.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (!id) return;
    const name = id[1];
    const mm = head.match(/\b([a-z]+)\.([A-Za-z_][A-Za-z0-9_]*)\s*$/);

    let label, doc2;
    if (mm && MODULES[mm[1]] && MODULES[mm[1]][mm[2]] !== undefined) {
      const ar = MODULES[mm[1]][mm[2]];
      const ps = Array.from({ length: ar }, (_, i) => `arg${i + 1}`);
      label = `${mm[1]}.${mm[2]}(${ps.join(", ")})`;
    } else if (BUILTINS[name]) {
      label = BUILTINS[name].sig;
      doc2 = BUILTINS[name].doc;
    } else {
      return;
    }

    const sig = new vscode.SignatureInformation(label, doc2 ? new vscode.MarkdownString(doc2) : undefined);
    const inside = label.slice(label.indexOf("(") + 1, label.lastIndexOf(")"));
    sig.parameters = inside.split(",").map((p) => new vscode.ParameterInformation(p.trim()));
    const active = (line.slice(open + 1).match(/,/g) || []).length;
    const help = new vscode.SignatureHelp();
    help.signatures = [sig];
    help.activeSignature = 0;
    help.activeParameter = Math.min(active, Math.max(0, sig.parameters.length - 1));
    return help;
  },
};

function register(context) {
  const sel = { language: "lumen" };
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(sel, completion, ".", "("),
    vscode.languages.registerHoverProvider(sel, hover),
    vscode.languages.registerSignatureHelpProvider(sel, sigHelp, "(", ",")
  );
  syms.register(context);
  require("./diagnostics").register(context, module.exports);
  require("./indent").register(context);
}

module.exports = { register, KW, TYPES, BUILTINS, METHODS, MODULES };

