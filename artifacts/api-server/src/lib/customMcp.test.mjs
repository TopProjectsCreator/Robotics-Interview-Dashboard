import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
mock.module("@workspace/db", { namedExports: { pool: { query: async () => ({ rows: [] }) } } });
const { validateCustomMcpEndpoint } = await import("./customMcp.ts");

test("rejects non-HTTPS MCP endpoints before making a request", async () => {
  await assert.rejects(validateCustomMcpEndpoint("http://example.com/mcp"), /must use HTTPS/);
});

test("rejects localhost and private-address MCP endpoints", async () => {
  await assert.rejects(validateCustomMcpEndpoint("https://localhost/mcp"), /Private and local/);
  await assert.rejects(validateCustomMcpEndpoint("https://127.0.0.1/mcp"), /Private and local/);
  await assert.rejects(validateCustomMcpEndpoint("https://192.168.1.10/mcp"), /Private and local/);
});

test("rejects endpoint URLs that include embedded credentials", async () => {
  await assert.rejects(validateCustomMcpEndpoint("https://user:pass@example.com/mcp"), /cannot include credentials/);
});
