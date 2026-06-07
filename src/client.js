const path = require("path");
const fs = require("fs");

let client = null;

function serverBinary(ctx, cfg) {
  const override = cfg.get("lumen.lsp.serverPath");
  if (override && fs.existsSync(override)) return override;
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
  return client;
}

function stopClient() {
  return client ? client.stop() : Promise.resolve();
}

module.exports = { startClient, stopClient };

