const path = require("path");
const Module = require("module");

let fails = 0;
function ok(c, m) { if (c) console.log("  ok   " + m); else { console.log("  FAIL " + m); fails++; } }

const stub = {
  SymbolKind: { Method: "Method", Function: "Function", Struct: "Struct", Enum: "Enum",
    Interface: "Interface", Field: "Field", Module: "Module", Variable: "Variable" },
  Position: class { constructor(l, c) { this.line = l; this.character = c; } },
  Range: class { constructor(a, b, c, d) { Object.assign(this, { a, b, c, d }); } },
  Location: class { constructor(uri, pos) { this.uri = uri; this.pos = pos; } },
  SymbolInformation: class { constructor(n, k, c, l) { Object.assign(this, { n, k, c, l }); } },
  MarkdownString: class { appendCodeblock() {} appendMarkdown() {} },
  Hover: class { constructor(c, r) { this.c = c; this.r = r; } },
  languages: { registerDefinitionProvider() {}, registerDocumentSymbolProvider() {} },
};
const load = Module._load;
Module._load = (req, p, m) => (req === "vscode" ? stub : load.call(Module, req, p, m));
const S = require(path.join(__dirname, "..", "src", "symbols"));
Module._load = load;

const src = `# structs and methods

struct Point:
    x: i64
    y: i64

impl Point:
    fn dist_sq(self):
        return self.x * self.x + self.y * self.y

fn main():
    let p = Point(3, 4)
    print(p.dist_sq())
`;

const lines = src.split("\n");
const doc = {
  getText: () => src,
  uri: "file:///t.lm",
  getWordRangeAtPosition: () => null,
  lineAt: (n) => ({ text: lines[n] }),
};

const syms = S.scan(doc);
const find = (n) => syms.filter((s) => s.name === n);

ok(find("Point").some((s) => s.kind === "Struct"), "Point parsed as struct");
ok(find("x").some((s) => s.kind === "Field" && s.parent === "Point"), "field x has parent Point");
ok(find("dist_sq").some((s) => s.kind === "Method" && s.parent === "Point"),
   "dist_sq is a method of Point");
ok(find("main").some((s) => s.kind === "Function" && !s.parent), "main is a top-level function");
ok(find("p").some((s) => s.kind === "Variable"), "p parsed as variable");

const r = S.resolve(syms, "dist_sq", 12);
ok(r && r.parent === "Point", "resolve(dist_sq) -> method of Point");

const rp = S.resolve(syms, "p", 12);
ok(rp && rp.detail.startsWith("let p"), "resolve(p) -> let binding");

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nsymbols.js: all checks passed.");

