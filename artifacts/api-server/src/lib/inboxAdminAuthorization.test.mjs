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

const interviewerAccountsTable = { id: "account_id", passwordHash: "password_hash", role: "role" };
const revokedSessionsTable = { tokenHash: "token_hash", expiresAt: "expires_at" };
let account = { passwordHash: "configured-hash", role: "admin" };
const match = (row, condition) => row[condition.field] === condition.value;
const db = {
  select(selection) {
    return {
      from(table) {
        return {
          where(condition) {
            const source = table === revokedSessionsTable ? [] : [{
              account_id: "inbox-admin",
              password_hash: account.passwordHash,
              role: account.role,
            }].filter(row => match(row, condition));
            const rows = source.map(row => {
              if (!selection) return row;
              return Object.fromEntries(Object.entries(selection).map(([key, column]) => [key, row[column]]));
            });
            return {
              limit: async (count) => rows.slice(0, count),
              then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
            };
          },
        };
      },
    };
  },
};

mock.module("drizzle-orm", {
  namedExports: {
    eq: (field, value) => ({ field, value }),
    lt: (field, value) => ({ field, value }),
  },
});
mock.module("@workspace/db", {
  namedExports: {
    db,
    DEFAULT_TEAM_ID: "default",
    interviewerAccountsTable,
    revokedSessionsTable,
    runWithInstance: (_instance, callback) => callback(),
  },
});
mock.module("../lib/workspaceVisibility.ts", {
  namedExports: { userCanSeeWorkspace: () => true },
});
mock.module("../lib/workspaceAccess.ts", {
  namedExports: { readWorkspaceVisibility: async () => ({}) },
});
mock.module("../lib/adminSessionPolicy.ts", {
  namedExports: {
    ADMIN_SESSION_TTL_MS: 60_000,
    isAdminSessionExpired: () => false,
  },
});

const { createInterviewerSession, requireInboxAdmin } = await import(
  `../middlewares/adminAuth.ts?inbox-auth-test=${Date.now()}`
);

async function invokeAs(role) {
  account = { passwordHash: "configured-hash", role };
  const session = createInterviewerSession("inbox-admin");
  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve({ status: this.statusCode, body: this.body });
      },
    };
    const request = {
      get: (name) => name.toLowerCase() === "authorization" ? `Bearer ${session}` : undefined,
      query: {},
      cookies: {},
      log: { error() {} },
    };
    requireInboxAdmin(request, response, () => resolve({ status: 200, body: null }));
  });
}

test("only Admin roles can read or change team inbox settings", async () => {
  assert.equal((await invokeAs("admin")).status, 200);
  assert.equal((await invokeAs("coordinator")).status, 200, "legacy Admin accounts stay authorized");
  assert.equal((await invokeAs("interviewer")).status, 403, "team members cannot manage inbox settings");
  assert.equal((await invokeAs("treasurer")).status, 403, "treasurers cannot manage inbox settings");
});
