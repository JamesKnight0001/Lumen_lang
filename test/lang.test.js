const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
let fails = 0;
function ok(cond, msg) {
  if (cond) console.log("  ok   " + msg);
  else { console.log("  FAIL " + msg); fails++; }
}

for (const f of ["src/extension.js", "src/lang.js", "src/symbols.js", "src/diagnostics.js", "src/compiler.js", "src/indent.js"]) {
  try {
    execFileSync(process.execPath, ["--check", path.join(ROOT, f)]);
    ok(true, `node --check ${f}`);
  } catch (e) {
    ok(false, `node --check ${f}: ${e.message}`);
  }
}

const Module = require("module");
const stub = new Proxy({}, {
  get(_t, p) {
    if (p === "CompletionItemKind") return new Proxy({}, { get: () => 0 });
    if (p === "MarkdownString") return class { appendCodeblock() {} appendMarkdown() {} };
    if (p === "CompletionItem") return class { constructor(l) { this.label = l; } };
    if (p === "SnippetString") return class { constructor(v) { this.value = v; } };
    return new Proxy(function () {}, { get: () => () => {}, apply: () => {} });
  },
});
const load = Module._load;
Module._load = (req, parent, main) => (req === "vscode" ? stub : load.call(Module, req, parent, main));
const lang = require(path.join(ROOT, "src/lang.js"));
Module._load = load;

ok(lang.KW.length === 38, `38 keywords (got ${lang.KW.length})`);
ok(Object.keys(lang.BUILTINS).length === 19, `19 builtins (got ${Object.keys(lang.BUILTINS).length})`);
ok(!("sorted" in lang.BUILTINS), "no 'sorted' builtin");
ok(Object.keys(lang.METHODS).length === 29, `29 methods (got ${Object.keys(lang.METHODS).length})`);
const mods = Object.values(lang.MODULES).reduce((a, m) => a + Object.keys(m).length, 0);
ok(mods === 98, `98 module funcs (got ${mods})`);
ok(Object.keys(lang.MODULES).join(",") === "math,os,rand,time,json,cffi", "modules ok");

const gram = fs.readFileSync(path.join(ROOT, "syntaxes/lumen.tmLanguage.json"), "utf8");
const has = (w) => new RegExp("[(|]" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[|)]").test(gram);
for (const b of Object.keys(lang.BUILTINS)) ok(has(b), `grammar has builtin '${b}'`);
for (const m of Object.keys(lang.METHODS)) ok(has(m), `grammar has method '${m}'`);

if (fails) { console.error(`\n${fails} check(s) FAILED`); process.exit(1); }
console.log("\nlang.js: all checks passed.");

