import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

process.env.SESSION_SECRET = "assistant-access-test-secret-at-least-32-characters";
const accountTable = {};
const revokedTable = {};
const db = {
  select() {
    let table;
    return {
      from(value) {
        table = value;
        return {
          where() {
            return {
              limit: async () => table === accountTable ? [{ passwordHash: "configured", role: "interviewer" }] : [],
              then(resolve, reject) {
                return Promise.resolve([]).then(resolve, reject);
              },
            };
          },
        };
      },
    };
  },
};
mock.module("@workspace/db", {
  namedExports: {
    db,
    DEFAULT_TEAM_ID: "default",
    interviewerAccountsTable: accountTable,
    revokedSessionsTable: revokedTable,
    runWithInstance: (_instance, callback) => callback(),
  },
});

const { createInterviewerSession, requireAdmin } = await import("../middlewares/adminAuth.ts");
const routes = readFileSync(new URL("../routes/robotics.ts", import.meta.url), "utf8");

test("a signed-in non-coordinator passes the authenticated-member gate", async () => {
  const token = createInterviewerSession("member-a");
  const req = {
    cookies: { robotics_admin_session: token },
    query: {},
    get: () => undefined,
    log: { error() {} },
  };
  let nextCalled = false;
  const res = {
    status() { throw new Error("Unexpected authorization failure"); },
    json() { throw new Error("Unexpected authorization failure"); },
  };

  requireAdmin(req, res, () => { nextCalled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(nextCalled, true);
});

test("signed-out MCP management and assistant requests are rejected by authentication middleware", () => {
  const req = { cookies: {}, query: {}, get: () => undefined, log: { error() {} } };
  let responseCode = 0;
  let responseBody;
  const res = {
    status(code) { responseCode = code; return this; },
    json(body) { responseBody = body; return this; },
  };

  requireAdmin(req, res, () => assert.fail("signed-out caller must not proceed"));
  assert.equal(responseCode, 401);
  assert.equal(responseBody.error, "Authentication required");
});

test("MCP routes and MCP-enabled assistant paths use signed-in access, not coordinator access", () => {
  for (const route of [
    'router.get("/assistant/tools", requireAdmin',
    'router.get("/onshape-mcp/status", requireAdmin',
    'router.get("/onshape-mcp/connect", requireAdmin',
    'router.delete("/onshape-mcp/connection", requireAdmin',
    'router.get("/assistant/custom-mcp/connection", requireAdmin',
    'router.post("/assistant/custom-mcp/connection", requireAdmin',
    'router.delete("/assistant/custom-mcp/connection", requireAdmin',
    'router.post("/assistant/ask", requireAdmin',
    'router.post("/assistant/ask/stream", requireAdmin',
  ]) {
    assert.ok(routes.includes(route), `expected authenticated-member route: ${route}`);
  }
  assert.ok(routes.includes('router.post("/assistant/images", requireCoordinator'));
  assert.ok(routes.includes('router.post("/assistant/skills", requireCoordinator'));
  assert.ok(routes.includes('router.delete("/assistant/history", requireCoordinator'));
  assert.match(routes, /const mcpOnly = account\.role !== "coordinator"/);
  assert.match(routes, /const conversationOwnerId = account\.role === "coordinator" \? null : account\.id/);
  assert.ok(routes.includes("listOnshapeMcpTools(account.id, teamId)"));
  assert.ok(routes.includes("listCustomMcpTools(account.id, teamId)"));
  assert.ok(routes.includes("listOnshapeMcpTools(accountId, teamId)"));
  assert.ok(routes.includes("listCustomMcpTools(accountId, teamId)"));
  assert.ok(routes.includes("const activeTools = mcpOnly"));
  assert.match(routes, /mcpOnly && !onshapeBindings\.has\(name \?\? ""\) && !customMcpBindings\.has\(name \?\? ""\)/);
});

test.after(() => mock.restoreAll());
