import { createServer as createHttpServer, request as httpRequest } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import app, { securityHeaders } from "../../api-server/src/app";

const dashboardDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawPort = process.env["PORT"];
const port = Number(rawPort);
if (!rawPort || !Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer.");
}

const vite = await createViteServer({
  configFile: path.join(dashboardDir, "vite.config.ts"),
  server: { host: "127.0.0.1", hmr: false },
});
await vite.listen(0);
const viteAddress = vite.httpServer?.address();
if (!viteAddress || typeof viteAddress === "string") {
  throw new Error("Could not start the dashboard test server.");
}

const server = createHttpServer((req, res) => {
  securityHeaders(req, res, () => {
    const requestPath = new URL(req.url ?? "/", "http://localhost").pathname;
    if (
      requestPath === "/"
      || requestPath === "/index.html"
      || requestPath === "/api"
      || requestPath.startsWith("/api/")
    ) {
      app(req, res);
      return;
    }

    const proxy = httpRequest({
      hostname: "127.0.0.1",
      port: viteAddress.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `127.0.0.1:${viteAddress.port}` },
    }, (upstream) => {
      res.statusCode = upstream.statusCode ?? 502;
      for (const [name, value] of Object.entries(upstream.headers)) {
        if (name !== "permissions-policy" && value !== undefined) {
          res.setHeader(name, value);
        }
      }
      upstream.pipe(res);
    });
    proxy.on("error", () => {
      if (!res.headersSent) res.statusCode = 502;
      res.end("Could not reach the dashboard test server.");
    });
    req.pipe(proxy);
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Parts camera API test server listening on ${port}\n`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    void vite.close().finally(() => process.exit(0));
  });
});
