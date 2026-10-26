import assert from "node:assert/strict";
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

test("CAD storage status access is limited to Wolverines coordinators", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";

  const accounts = new Map();
  const interviewerAccountsTable = {
    id: "id",
    passwordHash: "password_hash",
    role: "role",
    teamId: "team_id",
  };
  const revokedSessionsTable = { tokenHash: "token_hash" };
  mock.module("@workspace/db", {
    namedExports: {
      db: {
        select: () => ({
          from: (table) => ({
            where: (condition) => {
              if (table === revokedSessionsTable) return Promise.resolve([]);
              return {
                limit: async () => {
                  const account = accounts.get(condition.value);
                  return account ? [account] : [];
                },
              };
            },
          }),
        }),
      },
      DEFAULT_TEAM_ID: "default",
      interviewerAccountsTable,
      revokedSessionsTable,
      runWithInstance: (_instance, callback) => callback(),
    },
  });
  mock.module("drizzle-orm", {
    namedExports: {
      eq: (column, value) => ({ column, value }),
      lt: (column, value) => ({ column, value }),
    },
  });
  mock.module("../lib/workspaceVisibility", {
    namedExports: { userCanSeeWorkspace: () => true },
  });
  mock.module("../lib/workspaceAccess", {
    namedExports: { readWorkspaceVisibility: async () => ({}) },
  });
  t.after(() => {
    mock.restoreAll();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  const { createInterviewerSession, requireWolverinesCoordinator } =
    await import(`../middlewares/adminAuth.ts?cad-status-test=${Date.now()}`);

  async function requestFor(account) {
    accounts.set(account.id, { passwordHash: "configured", ...account });
    const req = {
      cookies: { robotics_admin_session: createInterviewerSession(account.id) },
      query: { teamId: "default", role: "coordinator" },
      get: () => undefined,
      log: { error() {} },
    };
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let proceeded = false;
    await new Promise((resolve) => {
      requireWolverinesCoordinator(req, res, () => {
        proceeded = true;
        resolve();
      });
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        originalJson(body);
        resolve();
        return res;
      };
    });
    return { res, proceeded };
  }

  await t.test("allows a Wolverines coordinator", async () => {
    const { res, proceeded } = await requestFor({
      id: "wolverines-coordinator",
      role: "coordinator",
      teamId: "default",
    });
    assert.equal(res.statusCode, 200);
    assert.equal(proceeded, true);
  });

  await t.test("denies a non-admin Wolverines user without proceeding", async () => {
    const { res, proceeded } = await requestFor({
      id: "wolverines-interviewer",
      role: "interviewer",
      teamId: "default",
    });
    assert.equal(res.statusCode, 403);
    assert.equal(proceeded, false);
    assert.deepEqual(res.body, { error: "Wolverines coordinators only" });
  });

  await t.test("denies another team's coordinator without proceeding", async () => {
    const { res, proceeded } = await requestFor({
      id: "other-team-coordinator",
      role: "coordinator",
      teamId: "team-elsewhere",
    });
    assert.equal(res.statusCode, 403);
    assert.equal(proceeded, false);
    assert.deepEqual(res.body, { error: "Wolverines coordinators only" });
  });
});
