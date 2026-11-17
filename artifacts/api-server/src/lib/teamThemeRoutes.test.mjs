import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { GetTeamThemeResponse } from "../../../../lib/api-zod/src/generated/api.ts";
import { dbMockExports } from "./testDbExports.mjs";

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

process.env.SESSION_SECRET = "team-theme-test-session-secret";

const teamsTable = {
  id: "id",
  name: "name",
  normalizedName: "normalized_name",
  logoPath: "logo_path",
  primaryColor: "primary_color",
  backgroundPath: "background_path",
  backgroundMode: "background_mode",
  backgroundOverlay: "background_overlay",
  defaultTheme: "default_theme",
  themePolicy: "theme_policy",
};
const accountsTable = {
  id: "id",
  passwordHash: "password_hash",
  role: "role",
  teamId: "team_id",
  customRoleId: "custom_role_id",
  hasPassword: "has_password",
};
const revokedTable = { tokenHash: "token_hash", expiresAt: "expires_at" };
const teamRows = new Map([
  ["team-a", { id: "team-a", name: "Team A", normalizedName: "team a", logoPath: null, primaryColor: null, backgroundPath: null, backgroundMode: null, backgroundOverlay: 35, defaultTheme: null, themePolicy: "recommended" }],
  ["team-b", { id: "team-b", name: "Team B", normalizedName: "team b", logoPath: null, primaryColor: null, backgroundPath: null, backgroundMode: null, backgroundOverlay: 35, defaultTheme: "dark", themePolicy: "locked" }],
]);
const accounts = new Map([
  ["coordinator-a", { id: "coordinator-a", passwordHash: "configured", role: "coordinator", teamId: "team-a", customRoleId: null, hasPassword: true }],
  ["member-a", { id: "member-a", passwordHash: "configured", role: "interviewer", teamId: "team-a", customRoleId: null, hasPassword: true }],
  ["coordinator-b", { id: "coordinator-b", passwordHash: "configured", role: "coordinator", teamId: "team-b", customRoleId: null, hasPassword: true }],
]);

const db = {
  select(selection) {
    return {
      from(table) {
        return {
          where(condition) {
            const value = Array.isArray(condition) ? condition[0]?.value : condition?.value;
            const rows = table === teamsTable
              ? [...teamRows.values()].filter((row) => row.id === value)
              : [...accounts.values()].filter((row) => row.id === value);
            const project = (row) => selection
              ? Object.fromEntries(Object.entries(selection).map(([key, column]) => {
                const name = Object.keys(table).find((candidate) => table[candidate] === column);
                return [key, row[name] ?? null];
              }))
              : row;
            return {
              limit: async (count) => rows.slice(0, count).map(project),
              then: (resolve, reject) => Promise.resolve(rows.map(project)).then(resolve, reject),
            };
          },
        };
      },
    };
  },
  update(_table) {
    return {
      set(patch) {
        return {
          where(condition) {
            const value = Array.isArray(condition) ? condition[0]?.value : condition?.value;
            const row = [...teamRows.values()].find((candidate) => candidate.id === value);
            if (!row) {
              return { returning: async () => [] };
            }
            Object.assign(row, patch);
            return { returning: async (selection) => [Object.fromEntries(Object.entries(selection).map(([key, column]) => {
              const name = Object.keys(teamsTable).find((candidate) => teamsTable[candidate] === column);
              return [key, row[name] ?? null];
            }))] };
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
    and: (...conditions) => conditions,
    or: (...conditions) => conditions,
    count: () => ({ count: true }),
    inArray: (field, values) => ({ field, values }),
    isNull: (field) => ({ field, null: true }),
    sql: () => { throw new Error("unexpected SQL lock request in team theme test"); },
  },
});
mock.module("@workspace/db", {
  namedExports: {
    ...dbMockExports(),
    db,
    primaryDb: db,
    secondaryDb: () => null,
    secondaryPool: () => null,
    teamsTable,
    interviewerAccountsTable: accountsTable,
    revokedSessionsTable: revokedTable,
  },
});
mock.module("../lib/activeTeamDatabase", {
  namedExports: { activeTeamDatabaseInstance: () => "default" },
});
mock.module("../lib/workspaceVisibility", {
  namedExports: { userCanSeeWorkspace: () => true },
});
mock.module("../lib/workspaceAccess", {
  namedExports: {
    readWorkspaceVisibility: async () => ({}),
    userCanSeeWorkspace: () => true,
  },
});
mock.module("../lib/adminSessionPolicy", {
  namedExports: {
    ADMIN_SESSION_TTL_MS: 30 * 24 * 60 * 60 * 1000,
    isAdminSessionExpired: () => false,
  },
});
mock.module("../lib/roles", {
  namedExports: { isAdminRole: (role) => role === "coordinator" || role === "admin" },
});
mock.module("../lib/passkey", {
  namedExports: {
    authenticationOriginFor: () => "http://localhost",
    base64urlToBytes: () => new Uint8Array(),
    credentialIdFromResponse: () => "",
    bytesToBase64url: () => "",
    clearPasskeyChallenge: () => {},
    expectedOriginsForLogin: () => ["http://localhost"],
    expectedRpIdsForLogin: () => ["localhost"],
    normalizeOrigin: (value) => value,
    originFromResponse: () => "http://localhost",
    readPasskeyChallenge: () => null,
    setPasskeyChallenge: () => {},
    webauthnOrigin: () => "http://localhost",
    webauthnRPID: () => "localhost",
  },
});
mock.module("../routes/presence", {
  namedExports: { deletePresenceHeartbeat: () => {}, accountNamesById: async () => new Map() },
});
mock.module("../lib/spamGuard", {
  namedExports: {
    checkAccountCreationAllowed: async () => ({ allowed: true }),
    validateDisplayName: (value) => value.trim() || null,
  },
});
mock.module("../lib/interviewerRosterAccess", {
  namedExports: { interviewerRosterAccess: () => ({ visible: true }) },
});
mock.module("../lib/interviewerAccounts", {
  namedExports: {
    accountById: async (id) => accounts.get(id) ?? null,
    normalizeInterviewerName: (value) => String(value).trim(),
    syncInterviewerAccounts: async () => {},
    updateQueueLabels: async () => {},
  },
});
mock.module("../lib/roboticsData", {
  namedExports: { getInterviewSettings: async () => ({}) },
});
mock.module("../lib/passwordExposurePolicy", {
  namedExports: { assessPasswordExposure: () => ({ kind: "safe" }) },
});
mock.module("../lib/nameRules", {
  namedExports: { validateTeamNameRules: () => ({}) },
});
mock.module("../lib/pwnedPasswords", {
  namedExports: { getPwnedPasswordCount: async () => 0 },
});
mock.module("../lib/databaseErrors", {
  namedExports: { isDatabaseConnectionError: () => false },
});
mock.module("../lib/objectStorage", {
  namedExports: {
    ObjectStorageService: class {},
  },
});

const [{ default: express }, { createInterviewerSession }, { default: authRouter }] = await Promise.all([
  import("express"),
  import("../middlewares/adminAuth.ts"),
  import("../routes/auth.ts"),
]);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: () => {}, warn: () => {}, info: () => {} };
  next();
});
app.use(authRouter);

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const httpFetch = globalThis.fetch.bind(globalThis);

async function call(path, { accountId, method = "GET", body } = {}) {
  const session = accountId ? createInterviewerSession(accountId) : null;
  const response = await httpFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, text: await response.text() };
}

test("team theme exposes the default theme and policy, coordinator-controlled per team", async (t) => {
  t.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
  });

  const unauthenticated = await call("/auth/team-theme");
  assert.equal(unauthenticated.status, 401);

  // Any signed-in account can read the team theme (it shapes every teammate's app).
  const memberRead = await call("/auth/team-theme", { accountId: "member-a" });
  assert.equal(memberRead.status, 200);
  const initial = GetTeamThemeResponse.parse(JSON.parse(memberRead.text));
  assert.deepEqual(initial, { defaultTheme: null, themePolicy: "recommended" });

  // Team B keeps its own locked dark default.
  const otherTeam = await call("/auth/team-theme", { accountId: "coordinator-b" });
  assert.equal(otherTeam.status, 200);
  assert.deepEqual(JSON.parse(otherTeam.text), { defaultTheme: "dark", themePolicy: "locked" });

  // Members cannot change the team theme.
  const memberWrite = await call("/auth/team-theme", {
    accountId: "member-a",
    method: "PATCH",
    body: { defaultTheme: "dark" },
  });
  assert.equal(memberWrite.status, 403);

  // Coordinators set the default theme; reads reflect it immediately.
  const setDark = await call("/auth/team-theme", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { defaultTheme: "dark" },
  });
  assert.equal(setDark.status, 200);
  assert.deepEqual(JSON.parse(setDark.text), { defaultTheme: "dark", themePolicy: "recommended" });

  // Policy can be locked on its own; the default stays.
  const lock = await call("/auth/team-theme", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { themePolicy: "locked" },
  });
  assert.equal(lock.status, 200);
  assert.deepEqual(JSON.parse(lock.text), { defaultTheme: "dark", themePolicy: "locked" });

  // Team B is untouched by team A's changes.
  const untouched = await call("/auth/team-theme", { accountId: "coordinator-b" });
  assert.deepEqual(JSON.parse(untouched.text), { defaultTheme: "dark", themePolicy: "locked" });

  // An empty patch is rejected.
  const empty = await call("/auth/team-theme", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: {},
  });
  assert.equal(empty.status, 400);

  // Invalid values are rejected.
  const invalid = await call("/auth/team-theme", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { defaultTheme: "blue" },
  });
  assert.equal(invalid.status, 400);
  const invalidPolicy = await call("/auth/team-theme", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { themePolicy: "strict" },
  });
  assert.equal(invalidPolicy.status, 400);

  // Clearing the default theme lets members follow their device again.
  const cleared = await call("/auth/team-theme", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { defaultTheme: null },
  });
  assert.equal(cleared.status, 200);
  assert.deepEqual(JSON.parse(cleared.text), { defaultTheme: null, themePolicy: "locked" });

  const policyReset = await call("/auth/team-theme", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { themePolicy: "recommended" },
  });
  assert.equal(policyReset.status, 200);
  assert.deepEqual(JSON.parse(policyReset.text), { defaultTheme: null, themePolicy: "recommended" });
});
