// Launches the Lumenlance LSP server and wires it to VS Code. Falls back
// silently (returns null, no throw) if the server binary is missing, so the
// extension's in-process providers can take over.
const path = require("path");
const fs = require("fs");

let client = null;

// Locate the server binary: setting override > bundled per-platform > null.
function serverBinary(ctx, cfg) {
  const override = cfg.get("lumen.lsp.serverPath");
  if (override && fs.existsSync(override)) return override;
  const exe = process.platform === "win32" ? "lumenlance.exe" : "lumenlance";
  // Bundled location (vsce packs ./server/<exe>); also try a dev build path.
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

// Start the client. Returns the LanguageClient on success, or null if the
// server binary or the vscode-languageclient module is unavailable.
function startClient(ctx, cfg) {
  const bin = serverBinary(ctx, cfg);
  if (!bin) return null;
  let lc;
  try {
    lc = require("vscode-languageclient/node");
  } catch (_) {
    return null; // dependency not installed -> in-process fallback
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
  return client;
}

function stopClient() {
  return client ? client.stop() : Promise.resolve();
}

module.exports = { startClient, stopClient };
