const fs = require("fs");
const path = require("path");
const vsctm = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");

const ROOT = path.join(__dirname, "..");

async function main() {
  const wasmBin = fs.readFileSync(
    path.join(ROOT, "node_modules/vscode-oniguruma/release/onig.wasm")
  ).buffer;
  const vscodeOnigurumaLib = oniguruma.loadWASM(wasmBin).then(() => ({
    createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
    createOnigString: (s) => new oniguruma.OnigString(s),
  }));

  const registry = new vsctm.Registry({
    onigLib: vscodeOnigurumaLib,
    loadGrammar: async (scopeName) => {
      if (scopeName === "source.lumen") {
        const g = fs.readFileSync(
          path.join(ROOT, "syntaxes/lumen.tmLanguage.json"), "utf8");
        return vsctm.parseRawGrammar(g, "lumen.tmLanguage.json");
      }
      return null;
    },
  });

  const grammar = await registry.loadGrammar("source.lumen");
  if (!grammar) { console.error("FAILED to load grammar"); process.exit(1); }

  const text = fs.readFileSync(path.join(__dirname, "sample.lm"), "utf8");
  const lines = text.split(/\r?\n/);
  let ruleStack = vsctm.INITIAL;
  let interesting = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const r = grammar.tokenizeLine(line, ruleStack);
    for (const tok of r.tokens) {
      const txt = line.substring(tok.startIndex, tok.endIndex);
      if (!txt.trim()) continue;
      const scopes = tok.scopes.join(" ");
      // only print tokens that got a meaningful (non-default) scope
      if (tok.scopes.length > 1) {
        interesting++;
        console.log(`L${String(i + 1).padStart(2)} ${JSON.stringify(txt).padEnd(22)} ${tok.scopes.slice(1).join(", ")}`);
      }
    }
    ruleStack = r.ruleStack;
  }
  console.log(`\n${interesting} scoped tokens. grammar loaded + tokenized OK.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
