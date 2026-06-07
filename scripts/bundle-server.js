const fs = require("fs");
const path = require("path");

const exe = process.platform === "win32" ? "lumenlance.exe" : "lumenlance";
const src = path.join(
  __dirname,
  "..",
  "..",
  "Lumenlance",
  "server",
  "target",
  "release",
  exe
);
const dstDir = path.join(__dirname, "..", "server");
const dst = path.join(dstDir, exe);

if (!fs.existsSync(src)) {
  console.warn(
    `lumenlance server not built at ${src}\n` +
      `  build it with: (cd ../Lumenlance/server && cargo build --release)\n` +
      `  packaging without a bundled server (extension will use in-process fallback).`
  );
  process.exit(0);
}
fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log(`bundled ${dst}`);

