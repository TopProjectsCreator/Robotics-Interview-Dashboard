import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import {
  UpdateTeamAccessCodeBody,
  UpdateTeamAccessCodeResponse,
} from "../../../../lib/api-zod/src/generated/api.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.(?:ts|js|mjs|json)$/.test(specifier)) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

process.env.SESSION_SECRET = "team-code-route-test-session-secret";
process.env.ADMIN_PASSWORD = "legacy-default-code";

const teamsTable = { id: "id", codeHash: "code_hash" };
const accountsTable = {
  id: "account_id",
  passwordHash: "password_hash",
  role: "role",
  teamId: "team_id",
};
const revokedSessionsTable = { tokenHash: "token_hash", expiresAt: "expires_at" };
const accounts = new Map([
  ["admin-a", { id: "admin-a", passwordHash: "configured", role: "admin", teamId: "team-a" }],
  ["member-a", { id: "member-a", passwordHash: "configured", role: "interviewer", teamId: "team-a" }],
]);
let teamRows = [];

function propertyFor(table, column) {
  return Object.keys(table).find((key) => table[key] === column);
}

function project(row, selection, table) {
  if (!selection) return { ...row };
  return Object.fromEntries(Object.entries(selection).map(([name, column]) => [
    name,
    typeof column === "string" ? row[propertyFor(table, column)] : column,
  ]));
}

function selectedRows(table, selection, condition) {
  if (table === revokedSessionsTable) return [];
  if (table === accountsTable) {
    const account = accounts.get(condition?.value);
    return account ? [project(account, selection, table)] : [];
  }
  if (table === teamsTable) {
    return teamRows
      .filter((team) => !condition || team.id === condition.value)
      .map((team) => project(team, selection, table));
  }
  return [];
}

function queryBuilder(rows) {
  return {
    limit: async (limit) => rows.slice(0, limit),
    then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
  };
}

const db = {
  select(selection) {
    return {
      from(table) {
        const rows = selectedRows(table, selection);
        return {
          where(condition) {
            return queryBuilder(selectedRows(table, selection, condition));
          },
          ...queryBuilder(rows),
        };
      },
    };
  },
  async transaction(callback) {
    const tx = {
      execute: async () => undefined,
      select(selection) {
        return { from: (table) => queryBuilder(selectedRows(table, selection)) };
      },
      update(table) {
        return {
          set(values) {
            return {
              where(condition) {
                return {
                  async returning(selection) {
                    const row = teamRows.find((team) => team.id === condition.value);
                    if (!row || table !== teamsTable) return [];
                    Object.assign(row, values);
                    return [project(row, selection, table)];
                  },
                };
              },
            };
          },
        };
      },
    };
    return callback(tx);
  },
};

mock.module("drizzle-orm", {
  namedExports: {
    eq: (field, value) => ({ field, value }),
    lt: (field, value) => ({ field, value }),
    isNull: (field) => ({ field, isNull: true }),
    or: (...conditions) => ({ conditions }),
    sql: (strings, ...values) => ({ strings, values }),
  },
});
mock.module("@workspace/db", {
  namedExports: {
    db,
    primaryDb: db,
    secondaryDb: () => null,
    hasSecondary: () => false,
    enterInstance: () => undefined,
    runWithInstance: (_instance, callback) => callback(),
    teamsTable,
    interviewerAccountsTable: accountsTable,
    revokedSessionsTable,
    DEFAULT_TEAM_ID: "default",
    normalizeTeamName: (name) => name.trim().replace(/\s+/g, " ").toLowerCase(),
  },
});
mock.module("@workspace/api-zod", {
  namedExports: { UpdateTeamAccessCodeBody, UpdateTeamAccessCodeResponse },
});
mock.module("../lib/workspaceVisibility.ts", {
  namedExports: { userCanSeeWorkspace: () => true },
});
mock.module("../lib/workspaceAccess.ts", {
  namedExports: {
    readWorkspaceVisibility: async () => ({}),
    writeWorkspaceVisibility: async (value) => value,
  },
});

const [
  { default: express },
  { createInterviewerSession, isValidAdminSession },
  { default: teamAccessCodeRouter },
  { findTeamByCode, hashTeamCode, verifyTeamCodeHash },
] = await Promise.all([
  import("express"),
  import("../middlewares/adminAuth.ts"),
  import("../routes/teamAccessCode.ts"),
  import("./teams.ts"),
]);

const { attachAdminSession, isRevokedAdminSession } = await import("../middlewares/adminAuth.ts");
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: () => undefined, warn: () => undefined, info: () => undefined };
  next();
});
app.use(attachAdminSession);
app.use(teamAccessCodeRouter);

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const endpoint = `${baseUrl}/auth/teams/access-code`;

async function updateCode(code, session) {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
    },
    body: JSON.stringify({ code }),
  });
  return { status: response.status, text: await response.text() };
}

test("team access code rotation is protected, validated, unique, private, and session-safe", async (t) => {
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  t.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
  });

  teamRows = [
    { id: "team-a", name: "Team A", normalizedName: "team a", codeHash: hashTeamCode("Old-Team-Code") },
    { id: "team-b", name: "Team B", normalizedName: "team b", codeHash: hashTeamCode("Used-Team-Code") },
    { id: "default", name: "Default Team", normalizedName: "default team", codeHash: hashTeamCode("Previous-Default-Code") },
  ];
  const adminSession = createInterviewerSession("admin-a", "primary");
  const memberSession = createInterviewerSession("member-a", "primary");

  assert.equal((await updateCode("Fresh-Team-Code")).status, 401);
  assert.equal((await updateCode("Fresh-Team-Code", memberSession)).status, 403);
  assert.equal((await updateCode("   ", adminSession)).status, 400);
  assert.equal((await updateCode("x".repeat(129), adminSession)).status, 400);

  const duplicate = await updateCode("used-team-code", adminSession);
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.text, /already in use/);
  assert.equal(duplicate.text.includes("used-team-code"), false);
  const legacy = await updateCode("LEGACY-DEFAULT-CODE", adminSession);
  assert.equal(legacy.status, 409);
  assert.match(legacy.text, /already in use/);

  const submittedCode = "Fresh-Team-Code";
  const success = await updateCode(`  ${submittedCode}  `, adminSession);
  assert.equal(success.status, 200);
  assert.deepEqual(JSON.parse(success.text), { message: "Team access code updated." });
  assert.equal(success.text.includes(submittedCode), false);
  const storedHash = teamRows.find((team) => team.id === "team-a")?.codeHash;
  assert.ok(storedHash);
  assert.notEqual(storedHash, submittedCode);
  assert.equal(verifyTeamCodeHash(submittedCode, storedHash), true);
  assert.equal(success.text.includes(storedHash), false);

  assert.equal(await findTeamByCode("Old-Team-Code"), null);
  assert.equal((await findTeamByCode(submittedCode))?.id, "team-a");
  assert.equal(isValidAdminSession(adminSession), true);
  assert.equal(await isRevokedAdminSession(adminSession), false);

  // The same signed-in session can still make an authenticated request after
  // the rotation; changing the shared code does not revoke existing sessions.
  const secondUpdate = await updateCode("Next-Team-Code", adminSession);
  assert.equal(secondUpdate.status, 200);
});
