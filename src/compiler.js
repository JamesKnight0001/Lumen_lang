const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function lumenBin(getConfig) {
  const set = getConfig && getConfig();
  if (set && set !== "lumen") return set;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const p = path.join(process.env.LOCALAPPDATA, "Lumen", "bin", "lumen.exe");
    if (fs.existsSync(p)) return p;
  }
  return "lumen";
}

function parseErrors(text) {
  const lines = text.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    let m, line = null, col = 0, endCol = undefined, message = null;

    if ((m = ln.match(/^parse error:\s*line\s+(\d+):\s*(.*)$/))) {
      line = parseInt(m[1], 10); message = m[2].trim();
    } else if ((m = ln.match(/^parse error:\s*(.*)$/))) {
      message = m[1].trim();
    } else if ((m = ln.match(/^compile error:\s*(.*)$/))) {
      message = m[1].trim();
    } else {
      continue;
    }

    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const src = lines[j].match(/^\s*(\d+)\s*\|(.*)$/);
      const car = (lines[j + 1] || "").match(/^\s*\|(\s*)(\^+)/);
      if (src) {
        if (line == null) line = parseInt(src[1], 10);
        if (car) {

          col = Math.max(0, car[1].length - 1);
          endCol = col + car[2].length;
        }
        break;
      }
    }

    if (line == null) line = 1;
    out.push({ line, col, endCol, message, severity: "error" });
  }
  return out;
}

function check(file, getConfig, cb) {
  const bin = lumenBin(getConfig);
  cp.execFile(bin, ["check", file], { timeout: 10000 }, (err, stdout, stderr) => {
    if (err && err.code === "ENOENT") return cb({ unavailable: true });
    const text = (stderr || "") + (stdout || "");
    const errors = parseErrors(text);
    cb({ ok: !err, errors, stderr: text });
  });
}

function checkSource(content, realPath, getConfig, cb) {
  let tmp;
  try {
    const dir = realPath ? path.dirname(realPath) : os.tmpdir();
    tmp = path.join(dir, `.lumen-check-${process.pid}-${Date.now()}.lm`);
    fs.writeFileSync(tmp, content);
  } catch (e) { return cb({ unavailable: true }); }
  check(tmp, getConfig, (res) => {
    try { fs.unlinkSync(tmp); } catch (_) {}
    cb(res);
  });
}

module.exports = { lumenBin, parseErrors, check, checkSource };

