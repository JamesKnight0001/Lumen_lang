// Tests src/indent.js smart on-Enter dedent provider logic.
const path = require("path");
const Module = require("module");

let fails = 0;
function ok(c, m) { if (c) console.log("  ok   " + m); else { console.log("  FAIL " + m); fails++; } }

// vscode stub: capture TextEdit.replace results
const edits = [];
const stub = {
  workspace: { getConfiguration: () => ({ get: () => true }) },
  Range: class { constructor(sl, sc, el, ec) { Object.assign(this, { sl, sc, el, ec }); } },
  TextEdit: { replace: (range, text) => ({ range, text }) },
  languages: { registerOnTypeFormattingEditProvider() {} },
};
const load = Module._load;
Module._load = (r, p, m) => (r === "vscode" ? stub : load.call(Module, r, p, m));
const indent = require(path.join(__dirname, "..", "src", "indent"));
Module._load = load;

// fake doc from lines
function doc(lines) {
  return { lineAt: (n) => ({ text: lines[n] }) };
}
const opts = { insertSpaces: true, tabSize: 4 };

// case 1: blank line after a `return` at 8 spaces -> dedent to 4
let d = doc(["impl P:", "    fn f(self):", "        return 1", "        "]);
let r = indent.provider.provideOnTypeFormattingEdits(d, { line: 3 }, "\n", opts);
ok(r.length === 1 && r[0].text === "    ", `dedent after return: "${r[0] && r[0].text}" (want 4 spaces)`);

// case 2: blank line after a normal statement -> no edit
d = doc(["fn f():", "    let x = 1", "    "]);
r = indent.provider.provideOnTypeFormattingEdits(d, { line: 2 }, "\n", opts);
ok(r.length === 0, "no dedent after a normal statement");

// case 3: non-newline trigger -> no edit
r = indent.provider.provideOnTypeFormattingEdits(d, { line: 2 }, "x", opts);
ok(r.length === 0, "ignores non-newline trigger");

// case 4: new line already has content -> no edit
d = doc(["fn f():", "        return 1", "    print(2)"]);
r = indent.provider.provideOnTypeFormattingEdits(d, { line: 2 }, "\n", opts);
ok(r.length === 0, "ignores non-blank new line");

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nindent.js: all checks passed.");
