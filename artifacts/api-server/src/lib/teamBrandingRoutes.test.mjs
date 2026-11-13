import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { GetTeamBrandingResponse } from "../../../../lib/api-zod/src/generated/api.ts";
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

process.env.SESSION_SECRET = "team-branding-test-session-secret";

const teamsTable = {
  id: "id",
  name: "name",
  normalizedName: "normalized_name",
  logoPath: "logo_path",
  primaryColor: "primary_color",
  backgroundPath: "background_path",
  backgroundMode: "background_mode",
  backgroundOverlay: "background_overlay",
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
  ["team-a", { id: "team-a", name: "Team A", normalizedName: "team a", logoPath: null, primaryColor: "#16869a", backgroundPath: null, backgroundMode: null, backgroundOverlay: 35 }],
  ["team-b", { id: "team-b", name: "Team B", normalizedName: "team b", logoPath: null, primaryColor: "#123456", backgroundPath: "secondary/team-branding/team-b/old-bg", backgroundMode: "tile", backgroundOverlay: 20 }],
]);
const accounts = new Map([
  ["coordinator-a", { id: "coordinator-a", passwordHash: "configured", role: "coordinator", teamId: "team-a", customRoleId: null, hasPassword: true }],
  ["member-a", { id: "member-a", passwordHash: "configured", role: "interviewer", teamId: "team-a", customRoleId: null, hasPassword: true }],
  ["coordinator-b", { id: "coordinator-b", passwordHash: "configured", role: "coordinator", teamId: "team-b", customRoleId: null, hasPassword: true }],
]);
const uploadedBackgrounds = [];
const deletedObjects = [];

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
                const name = Object.keys(table).find((key) => table[key] === column);
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
  update(table) {
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
    sql: () => { throw new Error("unexpected SQL lock request in team branding test"); },
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
const passkeyFn = () => null;
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
  namedExports: { deletePresenceHeartbeat: () => {} },
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
    ObjectStorageService: class {
      async uploadTeamBackground(data, contentType, teamId) {
        uploadedBackgrounds.push({ size: data.length, contentType, teamId });
        return `primary/team-branding/${teamId}/bg-${uploadedBackgrounds.length}`;
      }
      async deleteObject(objectPath) {
        deletedObjects.push(objectPath);
      }
    },
  },
});

const [{ default: express }, { createInterviewerSession, authenticatedInterviewerId }, { default: authRouter }] = await Promise.all([
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

async function call(path, { accountId, method = "GET", body, rawBody, contentType } = {}) {
  const session = accountId ? createInterviewerSession(accountId) : null;
  const response = await httpFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
      ...(contentType ? { "Content-Type": contentType } : body ? { "Content-Type": "application/json" } : {}),
    },
    ...(rawBody ? { body: rawBody } : body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, text: await response.text() };
}

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const GIF = Buffer.from([71, 73, 70, 56, 57, 97, 0, 0]);

test("team branding exposes and updates the app background within coordinator control", async (t) => {
  t.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
  });

  const unauthenticated = await call("/auth/team-branding");
  assert.equal(unauthenticated.status, 401);

  // Any signed-in account can read the team branding (it is shared with the whole team).
  const memberBranding = await call("/auth/team-branding", { accountId: "member-a" });
  assert.equal(memberBranding.status, 200);

  const brandingB = await call("/auth/team-branding", { accountId: "coordinator-b" });
  assert.equal(brandingB.status, 200);
  assert.equal(JSON.parse(brandingB.text).backgroundMode, "tile");
  assert.equal(JSON.parse(brandingB.text).backgroundOverlay, 20);
  assert.equal(JSON.parse(brandingB.text).backgroundPath, "secondary/team-branding/team-b/old-bg");

  const memberUpload = await call("/auth/team-branding/background", {
    accountId: "member-a",
    method: "POST",
    rawBody: PNG,
    contentType: "image/png",
  });
  assert.equal(memberUpload.status, 403);
  assert.equal(uploadedBackgrounds.length, 0);

  const rejected = await call("/auth/team-branding/background", {
    accountId: "coordinator-a",
    method: "POST",
    rawBody: GIF,
    contentType: "image/gif",
  });
  assert.equal(rejected.status, 400);
  assert.equal(uploadedBackgrounds.length, 0);

  const uploaded = await call("/auth/team-branding/background", {
    accountId: "coordinator-a",
    method: "POST",
    rawBody: PNG,
    contentType: "image/png",
  });
  assert.equal(uploaded.status, 201);
  assert.equal(uploadedBackgrounds.length, 1);
  assert.equal(uploadedBackgrounds[0].teamId, "team-a");
  assert.equal(uploadedBackgrounds[0].contentType, "image/png");

  const saved = JSON.parse(uploaded.text);
  const brandingA = await call("/auth/team-branding", { accountId: "coordinator-a" });
  assert.equal(brandingA.status, 200);
  assert.equal(JSON.parse(brandingA.text).backgroundPath, saved.backgroundPath);
  // The background is scoped to team-a; team-b still sees its own.
  const crossBranding = await call("/auth/team-branding", { accountId: "coordinator-b" });
  assert.equal(JSON.parse(crossBranding.text).backgroundPath, "secondary/team-branding/team-b/old-bg");

  const options = await call("/auth/team-branding", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { primaryColor: "#16869a", backgroundMode: "tile", backgroundOverlay: 10 },
  });
  assert.equal(options.status, 200);
  assert.deepEqual(JSON.parse(options.text).backgroundMode, "tile");
  assert.deepEqual(JSON.parse(options.text).backgroundOverlay, 10);

  const invalidOverlay = await call("/auth/team-branding", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { primaryColor: "#16869a", backgroundOverlay: 120 },
  });
  assert.equal(invalidOverlay.status, 400);

  const reset = await call("/auth/team-branding/background", {
    accountId: "coordinator-a",
    method: "DELETE",
  });
  assert.equal(reset.status, 204);
  assert.deepEqual(deletedObjects, [saved.backgroundPath]);

  const cleared = await call("/auth/team-branding", { accountId: "coordinator-a" });
  assert.equal(JSON.parse(cleared.text).backgroundPath, null);
  // Team B's background is untouched by team-a's reset.
  const untouched = await call("/auth/team-branding", { accountId: "coordinator-b" });
  assert.equal(JSON.parse(untouched.text).backgroundPath, "secondary/team-branding/team-b/old-bg");
});
