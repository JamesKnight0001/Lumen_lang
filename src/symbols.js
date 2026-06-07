// User-symbol intelligence: parse a .lm doc into declarations, then power
// go-to-definition, hover, and the outline. Indentation-based, like Lumen
// itself: a decl's parent is the nearest less-indented struct/impl/enum/trait
// /fn above it.

const vscode = require("vscode");

const ID = "[A-Za-z_][A-Za-z0-9_]*";
const RE = {
  fn:     new RegExp(`^(\\s*)fn\\s+(${ID})\\s*\\(([^)]*)\\)`),
  typ:    new RegExp(`^(\\s*)(struct|enum|trait)\\s+(${ID})`),
  impl:   new RegExp(`^(\\s*)impl\\s+(${ID})`),
  let:    new RegExp(`^(\\s*)(let|mut)\\s+(${ID})\\s*=`),
  field:  new RegExp(`^(\\s*)(${ID})\\s*:\\s*(${ID})\\s*$`), // struct field
  variant:new RegExp(`^(\\s*)(${ID})\\s*(\\([^)]*\\))?\\s*(#.*)?$`), // enum variant (bare id, opt args)
  import: new RegExp(`^\\s*import\\s+(${ID}(?:\\.${ID})*)(?:\\s+as\\s+(${ID}))?`),
  fromImp:new RegExp(`^\\s*from\\s+(${ID}(?:\\.${ID})*)\\s+import\\s+(${ID})(?:\\s+as\\s+(${ID}))?`),
};
// binding forms that introduce locals anywhere on a line (loop/catch/lambda/comp)
const FORALL = {
  forIn:  new RegExp(`\\bfor\\s+(${ID})\\s+in\\b`, "g"),     // for x in ..  /  [.. for x in ..]
  catch:  new RegExp(`\\bcatch\\s+(${ID})`, "g"),            // catch e:
  lambda: new RegExp(`\\bfn\\s*\\(([^)]*)\\)`, "g"),         // inline fn(a, b):
};

const K = vscode.SymbolKind;

// indent width in spaces (tabs count as one level ~ keep simple: char count)
function indent(s) {
  const m = s.match(/^\s*/)[0];
  return m.replace(/\t/g, "    ").length;
}

// leading "# ..." comment block directly above `line` -> summary string
function docAbove(lines, line) {
  const out = [];
  for (let i = line - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t.startsWith("#") && !t.startsWith("#[")) out.unshift(t.replace(/^#+\s?/, ""));
    else break;
  }
  return out.join(" ").trim();
}

// Parse the whole document once. Returns {symbols, byName}.
function scan(doc) {
  const text = doc.getText();
  const lines = text.split(/\r?\n/);
  const symbols = [];
  // stack of open containers: {name, indent}
  const stack = [];
  let inBlock = false; // inside a #[ ]# multi-line comment

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inBlock) { if (line.includes("]#")) inBlock = false; continue; }
    const bo = line.indexOf("#[");
    if (bo !== -1 && line.indexOf("]#", bo) === -1) { inBlock = true; continue; }
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const ind = indent(line);

    // pop containers we've dedented out of
    while (stack.length && ind <= stack[stack.length - 1].indent) stack.pop();
    const top = stack.length ? stack[stack.length - 1] : null;
    const parent = top ? top.name : null;

    let m;
    if ((m = RE.typ.exec(line))) {
      const name = m[3];
      const kind = m[2] === "trait" ? K.Interface : m[2] === "enum" ? K.Enum : K.Struct;
      push(name, kind, m[2], i, m[1].length, parent);
      stack.push({ name, indent: ind, isEnum: m[2] === "enum" });
    } else if ((m = RE.impl.exec(line))) {
      // impl attaches methods to an existing type; treat the type as container
      stack.push({ name: m[2], indent: ind });
    } else if ((m = RE.fn.exec(line))) {
      const name = m[2];
      const detail = `fn ${name}(${m[3].trim()})`;
      push(name, parent ? K.Method : K.Function, detail, i, m[1].length, parent);
      // params are locals of this fn
      for (const p of params(m[3])) {
        const col = line.indexOf(p, line.indexOf("("));
        push(p, K.Variable, `param of ${name}`, i, col < 0 ? m[1].length : col, name, true);
      }
      stack.push({ name, indent: ind });
    } else if ((m = RE.let.exec(line))) {
      push(m[3], K.Variable, `${m[2]} ${m[3]}`, i, m[1].length, parent);
    } else if (top && top.isEnum && (m = RE.variant.exec(line))) {
      // a bare identifier line inside an enum body is a variant
      push(m[2], K.EnumMember, `${parent}.${m[2]}`, i, m[1].length, parent);
    } else if ((m = RE.field.exec(line)) && parent) {
      push(m[2], K.Field, `${m[2]}: ${m[3]}`, i, m[1].length, parent);
    } else if ((m = RE.import.exec(line))) {
      // import a.b.c  -> module accessible as last segment "c" (or the alias)
      const last = m[1].split(".").pop();
      const alias = m[2] || last;
      push(alias, K.Module, alias === m[1] ? `import ${m[1]}` : `import ${m[1]} as ${alias}`, i, line.indexOf(alias), null);
    } else if ((m = RE.fromImp.exec(line))) {
      const alias = m[3] || m[2];
      push(alias, K.Module, `from ${m[1]} import ${m[2]}${m[3] ? ` as ${m[3]}` : ""}`, i, line.lastIndexOf(alias), null);
    }

    function push(name, kind, detail, ln, col, par, local) {
      symbols.push({
        name, kind, detail, line: ln, col, parent: par,
        local: !!local, summary: docAbove(lines, ln),
      });
    }

    // locals introduced mid-line: for-loop vars, catch bindings, lambda params,
    // list-comprehension vars. All scoped as locals so diagnostics see them.
    let g;
    FORALL.forIn.lastIndex = 0;
    while ((g = FORALL.forIn.exec(line))) push(g[1], K.Variable, `loop var ${g[1]}`, i, g.index, parent, true);
    FORALL.catch.lastIndex = 0;
    while ((g = FORALL.catch.exec(line))) push(g[1], K.Variable, `caught ${g[1]}`, i, g.index, parent, true);
    FORALL.lambda.lastIndex = 0;
    while ((g = FORALL.lambda.exec(line))) {
      for (const p of params(g[1])) push(p, K.Variable, `lambda param ${p}`, i, g.index, parent, true);
    }
  }
  return symbols;
}

function params(s) {
  return s.split(",").map((p) => p.trim().split(":")[0].trim()).filter((p) => p && p !== "self");
}

function pos(doc, s) {
  return new vscode.Location(doc.uri, new vscode.Position(s.line, s.col));
}

// pick the best decl for `word` near `line`: a local param of the enclosing fn
// wins over a top-level decl; otherwise the last (latest) matching decl.
function resolve(syms, word, line) {
  const hits = syms.filter((s) => s.name === word);
  if (!hits.length) return null;
  const locals = hits.filter((s) => s.local);
  if (locals.length) {
    // nearest local at or above the use site
    const above = locals.filter((s) => s.line <= line).sort((a, b) => b.line - a.line);
    if (above.length) return above[0];
  }
  // prefer a decl at or above; else first
  const above = hits.filter((s) => s.line <= line).sort((a, b) => b.line - a.line);
  return above[0] || hits[0];
}

function kindWord(k) {
  if (k === K.Method) return "method";
  if (k === K.Function) return "function";
  if (k === K.Struct) return "struct";
  if (k === K.Enum) return "enum";
  if (k === K.Interface) return "trait";
  if (k === K.Field) return "field";
  if (k === K.Module) return "module";
  return "variable";
}

const definition = {
  provideDefinition(doc, p) {
    const r = doc.getWordRangeAtPosition(p, /[A-Za-z_][A-Za-z0-9_]*/);
    if (!r) return;
    const s = resolve(scan(doc), doc.getText(r), p.line);
    return s ? pos(doc, s) : null;
  },
};

// hover for a user symbol: declaration + parent context + summary
function userHover(doc, p) {
  const r = doc.getWordRangeAtPosition(p, /[A-Za-z_][A-Za-z0-9_]*/);
  if (!r) return null;
  const s = resolve(scan(doc), doc.getText(r), p.line);
  if (!s) return null;
  const md = new vscode.MarkdownString();
  md.appendCodeblock(s.detail, "lumen");
  let ctx = kindWord(s.kind);
  if (s.parent) ctx += ` of ${s.parent}`;
  md.appendMarkdown(`\n\n${ctx}`);
  if (s.summary) md.appendMarkdown(`\n\n${s.summary}`);
  return new vscode.Hover(md, r);
}

const symbolsOutline = {
  provideDocumentSymbols(doc) {
    const syms = scan(doc).filter((s) => !s.local && s.kind !== K.Module);
    // build a flat list with container names (breadcrumbs use containerName)
    return syms.map((s) => {
      const range = new vscode.Range(s.line, s.col, s.line, s.col + s.name.length);
      const info = new vscode.SymbolInformation(s.name, s.kind, s.parent || "", new vscode.Location(doc.uri, range));
      return info;
    });
  },
};

function register(context) {
  const sel = { language: "lumen" };
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(sel, definition),
    vscode.languages.registerDocumentSymbolProvider(sel, symbolsOutline)
  );
}

module.exports = { register, scan, resolve, userHover };
