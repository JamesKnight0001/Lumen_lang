const fs = require("fs");
const path = require("path");
const Module = require("module");

let fails = 0;
function ok(c, m) { if (c) console.log("  ok   " + m); else { console.log("  FAIL " + m); fails++; } }

const K = new Proxy({}, { get: (_t, p) => p });
const stub = {
  SymbolKind: K,
  DiagnosticSeverity: { Warning: 1, Error: 0 },
  Position: class { constructor(l, c) { this.line = l; this.character = c; } },
  Range: class { constructor(a, b, c, d) { Object.assign(this, { sl: a, sc: b, el: c, ec: d }); } },
  Location: class { constructor(u, p) { this.u = u; this.p = p; } },
  Diagnostic: class { constructor(r, msg, sev) { Object.assign(this, { range: r, message: msg, severity: sev }); } },
  MarkdownString: class { appendCodeblock() {} appendMarkdown() {} },
  Hover: class {},
  CompletionItemKind: new Proxy({}, { get: () => 0 }),
  CompletionItem: class {}, SnippetString: class {},
  languages: { createDiagnosticCollection: () => ({}), registerDefinitionProvider() {}, registerDocumentSymbolProvider() {} },
};
const load = Module._load;
Module._load = (req, p, m) => (req === "vscode" ? stub : load.call(Module, req, p, m));
const lang = require(path.join(__dirname, "..", "src", "lang"));
const diag = require(path.join(__dirname, "..", "src", "diagnostics"));
Module._load = load;

function fakeDoc(src, file) {
  return { getText: () => src, languageId: "lumen", uri: { fsPath: file || "t.lm" } };
}

const exDir = path.join("C:", "Users", "irene", "OneDrive", "Desktop", "Z", "Lumen", "examples");
function walk(d) {
  let out = [];
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (f.endsWith(".lm")) out.push(p);
  }
  return out;
}
let scanned = 0, fp = 0;
const sweep = fs.existsSync(exDir) ? walk(exDir) : [];
const sample = path.join(__dirname, "sample.lm");
if (fs.existsSync(sample)) sweep.push(sample);

for (const file of sweep) {
  const src = fs.readFileSync(file, "utf8");
  const ds = diag.check(fakeDoc(src, file), lang);
  scanned++;
  if (ds.length) {
    fp += ds.length;
    console.log(`     ${path.basename(file)}: ${ds.map((d) => d.message + "@" + d.range.sl).join(", ")}`);
  }
}
ok(fp === 0, `no false positives across ${scanned} files (got ${fp})`);

const edge = `#[\na block comment spanning lines\n]#\nfn main():\n    print(1.5e-3, 2.0e10, 1_000_000)\n`;
const de = diag.check(fakeDoc(edge), lang);
ok(de.length === 0, `block comment + sci/underscore numbers clean (got ${de.length}: ${de.map(d=>d.message).join("; ")})`);

const stocksim = path.join(exDir, "stocksim", "main.lm");
if (fs.existsSync(stocksim)) {
  const ds = diag.check(fakeDoc(fs.readFileSync(stocksim, "utf8"), stocksim), lang);
  ok(ds.length === 0, `cross-file imports (stocksim/main.lm) clean (got ${ds.length})`);
}

const bad = `fn main():\n    print(undeclared_thing)\n`;
const ds = diag.check(fakeDoc(bad), lang);
ok(ds.some((d) => /undeclared_thing/.test(d.message)), "flags 'undeclared_thing'");

const fwd = `fn main():\n    let p = Point(1, 2)\n    print(p.x)\n    helper(p)\nfn helper(q):\n    return q\nstruct Point:\n    x: i64\n    y: i64\n`;
const ds3 = diag.check(fakeDoc(fwd), lang);
ok(ds3.length === 0, `forward refs / params / members clean (got ${ds3.length}: ${ds3.map(d=>d.message).join("; ")})`);

const en = `enum Color:\n    Red\n    Green\nfn main():\n    let c = Color.Red\n    match c:\n        case Red:\n            print(1)\n    print(reallyUndefined)\n`;
const ds4 = diag.check(fakeDoc(en), lang);
ok(ds4.length === 1 && /reallyUndefined/.test(ds4[0].message),
   `enum variants clean, real unknown flagged (got ${ds4.length}: ${ds4.map(d=>d.message).join("; ")})`);

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\ndiagnostics.js: all checks passed.");

