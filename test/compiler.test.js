// Tests src/compiler.js parseErrors against real `lumen check` stderr formats.
const path = require("path");
const C = require(path.join(__dirname, "..", "src", "compiler"));

let fails = 0;
function ok(c, m) { if (c) console.log("  ok   " + m); else { console.log("  FAIL " + m); fails++; } }

// real outputs captured from lumen.exe 0.71.0
const cases = [
  {
    name: "parse error with caret (missing colon)",
    text: "parse error: line 2: expected Colon, found Newline\n     2 |     print(1)\n       |     ^",
    expect: { line: 2, col: 4, message: /expected Colon/ },
  },
  {
    name: "parse error, no caret (just '(at line N)')",
    text: "parse error: line 3: unexpected token in expression: Newline\n  (at line 3)",
    expect: { line: 3, message: /unexpected token/ },
  },
  {
    name: "compile error with caret (undefined var)",
    text: "compile error: undefined variable 'undefined_var' - is it spelled correctly and in scope?\n     2 |     print(undefined_var)\n       |     ^",
    expect: { line: 2, col: 4, message: /undefined variable 'undefined_var'/ },
  },
  {
    name: "compile error, no caret (arity)",
    text: "compile error: too many arguments for struct 'P': it has 1 field(s) but 3 were given",
    expect: { line: 1, message: /too many arguments/ },
  },
];

for (const c of cases) {
  const errs = C.parseErrors(c.text);
  const e = errs[0];
  let good = e && e.line === c.expect.line && c.expect.message.test(e.message);
  if (good && c.expect.col !== undefined) good = e.col === c.expect.col;
  ok(good, `${c.name} -> ${e ? `L${e.line}:${e.col} "${e.message.slice(0, 40)}"` : "NO MATCH"}`);
}

// valid output -> no errors
ok(C.parseErrors("ok.lm: OK (parses and compiles)").length === 0, "valid file -> 0 errors");

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\ncompiler.js: all checks passed.");
