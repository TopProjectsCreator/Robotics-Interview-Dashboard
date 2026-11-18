import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
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
  backgroundPaths: "background_paths",
  backgroundRotationSeconds: "background_rotation_seconds",
  backgroundMode: "background_mode",
  backgroundOverlay: "background_overlay",
  backgroundAudience: "background_audience",
  backgroundMemberIds: "background_member_ids",
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
  ["team-a", { id: "team-a", name: "Team A", normalizedName: "team a", logoPath: null, primaryColor: "#16869a", backgroundPath: null, backgroundPaths: [], backgroundRotationSeconds: 0, backgroundMode: null, backgroundOverlay: 35 }],
  ["team-b", { id: "team-b", name: "Team B", normalizedName: "team b", logoPath: null, primaryColor: "#123456", backgroundPath: "secondary/team-branding/team-b/old-bg", backgroundPaths: [], backgroundRotationSeconds: 900, backgroundMode: "tile", backgroundOverlay: 20 }],
]);
const accounts = new Map([
  ["coordinator-a", { id: "coordinator-a", passwordHash: "configured", role: "coordinator", teamId: "team-a", customRoleId: null, hasPassword: true }],
  ["member-a", { id: "member-a", passwordHash: "configured", role: "interviewer", teamId: "team-a", customRoleId: null, hasPassword: true }],
  ["member-a-2", { id: "member-a-2", passwordHash: "configured", role: "interviewer", teamId: "team-a", customRoleId: null, hasPassword: true }],
  ["coordinator-b", { id: "coordinator-b", passwordHash: "configured", role: "coordinator", teamId: "team-b", customRoleId: null, hasPassword: true }],
]);
const uploadedBackgrounds = [];
const deletedObjects = [];

function rowMatches(row, table, condition) {
  if (!condition) return true;
  if (condition.kind === "and") return condition.conditions.every((child) => rowMatches(row, table, child));
  if (condition.kind === "or") return condition.conditions.some((child) => rowMatches(row, table, child));
  const columnName = Object.keys(table).find((key) => table[key] === condition.field);
  if (!columnName) return false;
  if (condition.kind === "eq") return (row[columnName] ?? null) === condition.value;
  if (condition.kind === "inArray") return condition.values.includes(row[columnName]);
  if (condition.kind === "isNull") return row[columnName] == null;
  return false;
}

const db = {
  select(selection) {
    return {
      from(table) {
        return {
          where(condition) {
            const rows = table === teamsTable
              ? [...teamRows.values()].filter((row) => rowMatches(row, table, condition))
              : [...accounts.values()].filter((row) => rowMatches(row, table, condition));
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
            const row = [...teamRows.values()].find((candidate) => rowMatches(candidate, table, condition));
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
    eq: (field, value) => ({ kind: "eq", field, value }),
    lt: (field, value) => ({ kind: "lt", field, value }),
    and: (...conditions) => ({ kind: "and", conditions }),
    or: (...conditions) => ({ kind: "or", conditions }),
    count: () => ({ count: true }),
    inArray: (field, values) => ({ kind: "inArray", field, values }),
    isNull: (field) => ({ kind: "isNull", field }),
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
  const unauthenticatedEffective = await call("/auth/team-branding/effective");
  assert.equal(unauthenticatedEffective.status, 401);

  // Any signed-in account can read the team branding (it is shared with the whole team).
  const memberBranding = await call("/auth/team-branding", { accountId: "member-a" });
  assert.equal(memberBranding.status, 200);

  const brandingB = await call("/auth/team-branding", { accountId: "coordinator-b" });
  assert.equal(brandingB.status, 200);
  assert.equal(JSON.parse(brandingB.text).backgroundMode, "tile");
  assert.equal(JSON.parse(brandingB.text).backgroundOverlay, 20);
  // Team B has only the legacy column set; it is folded into the array.
  assert.equal(JSON.parse(brandingB.text).backgroundPath, "secondary/team-branding/team-b/old-bg");
  assert.deepEqual(JSON.parse(brandingB.text).backgrounds, ["secondary/team-branding/team-b/old-bg"]);
  assert.equal(JSON.parse(brandingB.text).backgroundRotationSeconds, 900);
  assert.equal(JSON.parse(brandingB.text).backgroundAudience, "everyone");
  assert.deepEqual(JSON.parse(brandingB.text).backgroundMemberIds, []);
  const legacyEffective = await call("/auth/team-branding/effective", { accountId: "coordinator-b" });
  assert.equal(JSON.parse(legacyEffective.text).backgroundPath, "secondary/team-branding/team-b/old-bg");
  assert.deepEqual(JSON.parse(legacyEffective.text).backgrounds, ["secondary/team-branding/team-b/old-bg"]);
  assert.equal(JSON.parse(legacyEffective.text).backgroundRotationSeconds, 900);
  assert.equal("backgroundMemberIds" in JSON.parse(legacyEffective.text), false);
  assert.equal("backgroundAudience" in JSON.parse(legacyEffective.text), false);

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
  assert.deepEqual(saved.backgrounds, ["primary/team-branding/team-a/bg-1"]);
  assert.equal(saved.backgroundRotationSeconds, 0);
  // A second background is appended, not swapped in.
  const uploadedSecond = await call("/auth/team-branding/background", {
    accountId: "coordinator-a",
    method: "POST",
    rawBody: PNG,
    contentType: "image/png",
  });
  assert.equal(uploadedSecond.status, 201);
  assert.deepEqual(JSON.parse(uploadedSecond.text).backgrounds, ["primary/team-branding/team-a/bg-1", "primary/team-branding/team-a/bg-2"]);
  const brandingA = await call("/auth/team-branding", { accountId: "coordinator-a" });
  assert.equal(brandingA.status, 200);
  assert.equal(JSON.parse(brandingA.text).backgroundPath, "primary/team-branding/team-a/bg-1");
  assert.deepEqual(JSON.parse(brandingA.text).backgrounds, ["primary/team-branding/team-a/bg-1", "primary/team-branding/team-a/bg-2"]);
  assert.equal(JSON.parse(brandingA.text).backgroundPath, saved.backgroundPath);
  const defaultAudienceMember = await call("/auth/team-branding/effective", { accountId: "member-a" });
  assert.equal(JSON.parse(defaultAudienceMember.text).backgroundPath, saved.backgroundPath);
  assert.deepEqual(JSON.parse(defaultAudienceMember.text).backgrounds, ["primary/team-branding/team-a/bg-1", "primary/team-branding/team-a/bg-2"]);
  assert.equal(JSON.parse(defaultAudienceMember.text).backgroundRotationSeconds, 0);
  // The background is scoped to team-a; team-b still sees its own.
  const crossBranding = await call("/auth/team-branding", { accountId: "coordinator-b" });
  assert.equal(JSON.parse(crossBranding.text).backgroundPath, "secondary/team-branding/team-b/old-bg");
  assert.deepEqual(JSON.parse(crossBranding.text).backgrounds, ["secondary/team-branding/team-b/old-bg"]);

  const audience = await call("/auth/team-branding", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: {
      primaryColor: "#16869a",
      backgroundAudience: "selected",
      backgroundMemberIds: ["member-a"],
    },
  });
  assert.equal(audience.status, 200);
  assert.equal(JSON.parse(audience.text).backgroundAudience, "selected");
  assert.deepEqual(JSON.parse(audience.text).backgroundMemberIds, ["member-a"]);
  const included = await call("/auth/team-branding/effective", { accountId: "member-a" });
  assert.equal(JSON.parse(included.text).backgroundPath, saved.backgroundPath);
  assert.deepEqual(JSON.parse(included.text).backgrounds, ["primary/team-branding/team-a/bg-1", "primary/team-branding/team-a/bg-2"]);
  const excluded = await call("/auth/team-branding/effective", { accountId: "member-a-2" });
  assert.equal(JSON.parse(excluded.text).backgroundPath, null);
  assert.deepEqual(JSON.parse(excluded.text).backgrounds, []);
  assert.equal(JSON.parse(excluded.text).backgroundRotationSeconds, 0);
  assert.equal(JSON.parse(excluded.text).backgroundMode, null);
  const excludedManager = await call("/auth/team-branding/effective", { accountId: "coordinator-a" });
  assert.equal(JSON.parse(excludedManager.text).backgroundPath, null);
  assert.deepEqual(JSON.parse(excludedManager.text).backgrounds, []);
  const managerStillSeesConfiguredBackground = await call("/auth/team-branding", { accountId: "coordinator-a" });
  assert.equal(JSON.parse(managerStillSeesConfiguredBackground.text).backgroundPath, saved.backgroundPath);
  const crossTeamSelection = await call("/auth/team-branding", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: {
      primaryColor: "#16869a",
      backgroundAudience: "selected",
      backgroundMemberIds: ["coordinator-b"],
    },
  });
  assert.equal(crossTeamSelection.status, 400);
  assert.match(crossTeamSelection.text, /current members of your team/);
  const switchedTeamEffective = await call("/auth/team-branding/effective", { accountId: "coordinator-b" });
  assert.equal(JSON.parse(switchedTeamEffective.text).backgroundPath, "secondary/team-branding/team-b/old-bg");

  const options = await call("/auth/team-branding", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { primaryColor: "#16869a", backgroundMode: "tile", backgroundOverlay: 10, backgroundRotationSeconds: 600 },
  });
  assert.equal(options.status, 200);
  assert.deepEqual(JSON.parse(options.text).backgroundMode, "tile");
  assert.deepEqual(JSON.parse(options.text).backgroundOverlay, 10);
  assert.deepEqual(JSON.parse(options.text).backgroundRotationSeconds, 600);

  const invalidOverlay = await call("/auth/team-branding", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { primaryColor: "#16869a", backgroundOverlay: 120 },
  });
  assert.equal(invalidOverlay.status, 400);

  const invalidRotation = await call("/auth/team-branding", {
    accountId: "coordinator-a",
    method: "PATCH",
    body: { primaryColor: "#16869a", backgroundRotationSeconds: 90000 },
  });
  assert.equal(invalidRotation.status, 400);

  // Removing a single background leaves the rest, and only deletes that object.
  const removedOne = await call("/auth/team-branding/background", {
    accountId: "coordinator-a",
    method: "DELETE",
    body: { path: "primary/team-branding/team-a/bg-1" },
  });
  assert.equal(removedOne.status, 204);
  assert.deepEqual(deletedObjects, ["primary/team-branding/team-a/bg-1"]);
  const afterRemoveOne = await call("/auth/team-branding", { accountId: "coordinator-a" });
  assert.deepEqual(JSON.parse(afterRemoveOne.text).backgrounds, ["primary/team-branding/team-a/bg-2"]);
  assert.equal(JSON.parse(afterRemoveOne.text).backgroundPath, "primary/team-branding/team-a/bg-2");

  const reset = await call("/auth/team-branding/background", {
    accountId: "coordinator-a",
    method: "DELETE",
  });
  assert.equal(reset.status, 204);
  assert.deepEqual(deletedObjects, ["primary/team-branding/team-a/bg-1", "primary/team-branding/team-a/bg-2"]);

  const cleared = await call("/auth/team-branding", { accountId: "coordinator-a" });
  assert.equal(JSON.parse(cleared.text).backgroundPath, null);
  assert.deepEqual(JSON.parse(cleared.text).backgrounds, []);
  // Team B's background is untouched by team-a's reset.
  const untouched = await call("/auth/team-branding", { accountId: "coordinator-b" });
  assert.equal(JSON.parse(untouched.text).backgroundPath, "secondary/team-branding/team-b/old-bg");

  // The ten-background cap is enforced before any storage write happens.
  const rowA = teamRows.get("team-a");
  rowA.backgroundPaths = Array.from({ length: 10 }, (_, index) => `primary/team-branding/team-a/existing-${index}`);
  const capped = await call("/auth/team-branding/background", {
    accountId: "coordinator-a",
    method: "POST",
    rawBody: PNG,
    contentType: "image/png",
  });
  assert.equal(capped.status, 409);
  assert.equal(uploadedBackgrounds.length, 2);
});
