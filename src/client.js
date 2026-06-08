const path = require("path");
const fs = require("fs");

let client = null;

// Expand environment variables in a configured path: %VAR% (Windows) and
// ${VAR} / $VAR (POSIX). Unknown vars are left as-is so a miss falls through
// to the bundled build rather than resolving to a bogus path.
function expandEnv(p) {
  if (!p) return p;
  return p
    .replace(/%([^%]+)%/g, (m, name) => process.env[name] || m)
    .replace(/\$\{([^}]+)\}/g, (m, name) => process.env[name] || m)
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, name) => process.env[name] || m);
}

function serverBinary(ctx, cfg) {
  // Configured path (default: %LOCALAPPDATA%/Lumen/bin/lumenlance.exe). Expand
  // env vars and use it IF it exists; otherwise fall back to the bundled build.
  const override = cfg.get("lumen.lsp.serverPath");
  if (override) {
    const resolved = path.normalize(expandEnv(override));
    if (fs.existsSync(resolved)) return resolved;
  }
  const exe = process.platform === "win32" ? "lumenlance.exe" : "lumenlance";

  const candidates = [
    path.join(ctx.extensionPath, "server", exe),
    path.join(
      ctx.extensionPath,
      "..",
      "Lumenlance",
      "server",
      "target",
      "release",
      exe
    ),
    path.join(
      ctx.extensionPath,
      "..",
      "Lumenlance",
      "server",
      "target",
      "debug",
      exe
    ),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function startClient(ctx, cfg) {
  const bin = serverBinary(ctx, cfg);
  if (!bin) return null;
  let lc;
  try {
    lc = require("vscode-languageclient/node");
  } catch (_) {
    return null;
  }
  const { LanguageClient, TransportKind } = lc;
  const serverOptions = {
    run: { command: bin, transport: TransportKind.stdio },
    debug: { command: bin, transport: TransportKind.stdio },
  };
  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "lumen" }],
  };
  client = new LanguageClient(
    "lumenlance",
    "Lumenlance",
    serverOptions,
    clientOptions
  );
  client.start();
  // Surface which binary we launched in the "Lumenlance" output channel - the
  // server then logs its own + the compiler's version once it initializes.
  try {
    client.outputChannel.appendLine(`[client] launching server: ${bin}`);
  } catch (_) {}
  return client;
}

function stopClient() {
  return client ? client.stop() : Promise.resolve();
}

module.exports = { startClient, stopClient };

