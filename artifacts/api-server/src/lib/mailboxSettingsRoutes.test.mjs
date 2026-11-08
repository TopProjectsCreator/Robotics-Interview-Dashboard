import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import {
  GetSystemUsageResponse,
  GetTeamMailboxSettingsResponse,
  UpdateTeamMailboxSettingsBody,
} from "../../../../lib/api-zod/src/generated/api.ts";

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

process.env.AI_BYOK_ENCRYPTION_KEY = "mailbox-route-test-encryption-secret";
process.env.SESSION_SECRET = "mailbox-route-test-session-secret";

const accountTable = {
  id: "account_id",
  passwordHash: "password_hash",
  role: "role",
  teamId: "team_id",
};
const revokedTable = { tokenHash: "token_hash", expiresAt: "expires_at" };
const inboxTable = {
  teamId: "team_id",
  mailbox: "mailbox",
  enabled: "enabled",
  allowedSenders: "allowed_senders",
  encryptedApiKey: "encrypted_api_key",
};
const accounts = new Map([
  ["admin-a", { id: "admin-a", passwordHash: "configured", role: "admin", teamId: "team-a" }],
  ["admin-b", { id: "admin-b", passwordHash: "configured", role: "admin", teamId: "team-b" }],
  ["member-a", { id: "member-a", passwordHash: "configured", role: "interviewer", teamId: "team-a" }],
]);
const inboxRows = [];
const logs = [];
let injectedWriteError = null;
let injectedWriteValues = null;
let injectedWriteKey = null;

function selectedRows(table, selection, condition) {
  if (table === revokedTable) return [];
  if (table === accountTable) {
    const account = [...accounts.values()].find((row) => row.id === condition?.value);
    if (!account) return [];
    return [Object.fromEntries(Object.entries(selection ?? account).map(([key, column]) => [
      key,
      typeof column === "string" ? account[Object.keys(accountTable).find((name) => accountTable[name] === column)] : column,
    ]))];
  }
  if (table === inboxTable) {
    const rows = inboxRows.filter((row) => !condition || row.teamId === condition.value);
    return rows.map((row) => selection
      ? Object.fromEntries(Object.entries(selection).map(([key]) => [key, row[key]]))
      : row);
  }
  return [];
}

const db = {
  select(selection) {
    return {
      from(table) {
        return {
          where(condition) {
            const rows = selectedRows(table, selection, condition);
            return {
              limit: async (count) => rows.slice(0, count),
              then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
            };
          },
        };
      },
    };
  },
  insert(table) {
    return {
      values(value) {
        return {
          async onConflictDoUpdate({ set }) {
            if (table !== inboxTable) return;
            if (injectedWriteError) {
              injectedWriteValues = set;
              throw new Error(`${injectedWriteError} ${injectedWriteKey} ${set.encryptedApiKey}`);
            }
            const existing = inboxRows.find((row) => row.teamId === value.teamId);
            if (existing) Object.assign(existing, set);
            else inboxRows.push({ ...value, ...set });
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
    pool: {},
    DEFAULT_TEAM_ID: "default",
    interviewerAccountsTable: accountTable,
    revokedSessionsTable: revokedTable,
    maildropInboxesTable: inboxTable,
    ingestedEmailsTable: {},
    interviewChatMessagesTable: {},
    primaryDb: db,
    secondaryDb: () => null,
    hasSecondary: () => false,
    runWithInstance: (_instance, callback) => callback(),
  },
});
mock.module("@workspace/api-zod", {
  namedExports: {
    GetSystemUsageResponse,
    GetTeamMailboxSettingsResponse,
    UpdateTeamMailboxSettingsBody,
  },
});
mock.module("../lib/workspaceVisibility.ts", {
  namedExports: { userCanSeeWorkspace: () => true },
});
mock.module("../lib/workspaceAccess.ts", {
  namedExports: {
    normalizeWorkspaceVisibility: (value) => value,
    readWorkspaceVisibility: async () => ({}),
    writeWorkspaceVisibility: async (value) => value,
  },
});

const [{ default: express }, { createInterviewerSession }, { default: systemRouter }] = await Promise.all([
  import("express"),
  import("../middlewares/adminAuth.ts"),
  import("../routes/system.ts"),
]);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = {
    error: (...args) => logs.push(args),
    warn: (...args) => logs.push(args),
    info: (...args) => logs.push(args),
  };
  next();
});
app.use(systemRouter);

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

function assertSecretFree(result, secrets, label) {
  for (const secret of secrets.filter(Boolean)) {
    assert.equal(result.text.includes(secret), false, `${label} must not expose secret material`);
  }
}

test("authenticated inbox routes keep team keys private and team-scoped", async (t) => {
  t.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
  });

  const keyA = "MAILBOX_ROUTE_PRIVATE_KEY_A";
  const keyAReplacement = "MAILBOX_ROUTE_PRIVATE_KEY_A_REPLACEMENT";
  const keyB = "MAILBOX_ROUTE_PRIVATE_KEY_B";
  let encryptedA = null;
  let encryptedB = null;

  try {
    const unauthenticated = await call("/system/mailbox", { method: "PUT", body: {
      enabled: false,
      allowedSenders: ["coach@example.org"],
      apiKey: keyA,
    } });
    assert.equal(unauthenticated.status, 401);
    assertSecretFree(unauthenticated, [keyA], "unauthenticated error");

    const initialB = await call("/system/mailbox", {
      accountId: "admin-b",
      method: "PUT",
      body: { enabled: false, allowedSenders: ["coach@example.org"], apiKey: keyB },
    });
    assert.equal(initialB.status, 200);
    assertSecretFree(initialB, [keyB], "Team B PUT response");
    encryptedB = inboxRows.find((row) => row.teamId === "team-b")?.encryptedApiKey;
    assert.ok(encryptedB);

    const crossTeamGet = await call("/system/mailbox?teamId=team-b", { accountId: "admin-a" });
    assert.equal(crossTeamGet.status, 200);
    assert.equal(JSON.parse(crossTeamGet.text).teamId, "team-a");
    assert.equal(JSON.parse(crossTeamGet.text).apiKeyConfigured, false);
    assertSecretFree(crossTeamGet, [keyA, keyB, encryptedB], "cross-team GET response");

    const firstSave = await call("/system/mailbox", {
      accountId: "admin-a",
      method: "PUT",
      body: {
        enabled: true,
        allowedSenders: ["coach@example.org"],
        apiKey: keyA,
        teamId: "team-b",
      },
    });
    assert.equal(firstSave.status, 200);
    assert.equal(JSON.parse(firstSave.text).teamId, "team-a");
    assert.equal(JSON.parse(firstSave.text).apiKeyConfigured, true);
    assertSecretFree(firstSave, [keyA, keyB, encryptedB], "Team A PUT response");
    encryptedA = inboxRows.find((row) => row.teamId === "team-a")?.encryptedApiKey;
    assert.ok(encryptedA);
    assert.notEqual(encryptedA, keyA);
    assert.equal(inboxRows.find((row) => row.teamId === "team-b")?.encryptedApiKey, encryptedB);

    const readAfterSave = await call("/system/mailbox", { accountId: "admin-a" });
    assert.equal(readAfterSave.status, 200);
    assert.equal(JSON.parse(readAfterSave.text).teamId, "team-a");
    assertSecretFree(readAfterSave, [keyA, keyB, encryptedA, encryptedB], "Team A GET response");

    const replacement = await call("/system/mailbox", {
      accountId: "admin-a",
      method: "PUT",
      body: {
        enabled: true,
        allowedSenders: ["coach@example.org"],
        apiKey: keyAReplacement,
        teamId: "team-b",
      },
    });
    assert.equal(replacement.status, 200);
    assertSecretFree(replacement, [keyA, keyAReplacement, keyB, encryptedA, encryptedB], "replacement PUT response");
    const replacementCiphertext = inboxRows.find((row) => row.teamId === "team-a")?.encryptedApiKey;
    assert.ok(replacementCiphertext);
    assert.notEqual(replacementCiphertext, encryptedA);
    assert.notEqual(replacementCiphertext, keyAReplacement);
    assert.equal(inboxRows.find((row) => row.teamId === "team-b")?.encryptedApiKey, encryptedB);

    let requestAuthorization = null;
    let requestMailbox = null;
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.maildrop.cc/graphql");
      requestAuthorization = init.headers.Authorization;
      requestMailbox = JSON.parse(init.body).variables.mailbox;
      return new Response(JSON.stringify({ data: { inbox: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    let sync;
    try {
      sync = await call("/system/mailbox/sync?teamId=team-b", {
        accountId: "admin-a",
        method: "POST",
        body: { teamId: "team-b" },
      });
    } finally {
      globalThis.fetch = previousFetch;
    }
    assert.equal(sync.status, 200);
    assert.equal(requestAuthorization, `Bearer ${keyAReplacement}`);
    assert.match(requestMailbox, /^robotics-/);
    assertSecretFree(sync, [keyA, keyAReplacement, keyB, encryptedA, replacementCiphertext, encryptedB], "sync response");

    const nonAdmin = await call("/system/mailbox", {
      accountId: "member-a",
      method: "PUT",
      body: {
        enabled: false,
        allowedSenders: ["coach@example.org"],
        apiKey: "MAILBOX_ROUTE_NON_ADMIN_KEY",
        teamId: "team-b",
      },
    });
    assert.equal(nonAdmin.status, 403);
    assertSecretFree(nonAdmin, ["MAILBOX_ROUTE_NON_ADMIN_KEY"], "non-admin error");
    assert.equal(inboxRows.find((row) => row.teamId === "team-b")?.encryptedApiKey, encryptedB);

    const remove = await call("/system/mailbox", {
      accountId: "admin-a",
      method: "PUT",
      body: { enabled: false, allowedSenders: ["coach@example.org"], removeApiKey: true, teamId: "team-b" },
    });
    assert.equal(remove.status, 200);
    assert.equal(JSON.parse(remove.text).apiKeyConfigured, false);
    assertSecretFree(remove, [keyA, keyAReplacement, keyB, encryptedA, replacementCiphertext, encryptedB], "remove PUT response");
    assert.equal(inboxRows.find((row) => row.teamId === "team-a")?.encryptedApiKey, null);
    assert.equal(inboxRows.find((row) => row.teamId === "team-b")?.encryptedApiKey, encryptedB);

    const invalidKey = "MAILBOX_ROUTE_INVALID_KEY";
    const invalidWrite = await call("/system/mailbox", {
      accountId: "admin-a",
      method: "PUT",
      body: {
        enabled: false,
        allowedSenders: ["coach@example.org"],
        apiKey: `${invalidKey}\u0001`,
      },
    });
    assert.equal(invalidWrite.status, 400);
    assertSecretFree(invalidWrite, [invalidKey], "invalid-key error");

    const failedKey = "MAILBOX_ROUTE_FAILED_WRITE_KEY";
    injectedWriteKey = failedKey;
    injectedWriteError = "database failure";
    const failedWrite = await call("/system/mailbox", {
      accountId: "admin-a",
      method: "PUT",
      body: { enabled: false, allowedSenders: ["coach@example.org"], apiKey: failedKey },
    });
    injectedWriteError = null;
    assert.equal(failedWrite.status, 500);
    assert.match(failedWrite.text, /Unable to update team inbox settings/);
    assert.ok(injectedWriteValues?.encryptedApiKey);
    assertSecretFree(
      failedWrite,
      [failedKey, injectedWriteValues.encryptedApiKey, keyA, keyAReplacement, keyB, encryptedB],
      "failed PUT response",
    );

    const serializedLogs = JSON.stringify(logs);
    for (const secret of [keyA, keyAReplacement, keyB, invalidKey, failedKey, encryptedA, replacementCiphertext, encryptedB, injectedWriteValues.encryptedApiKey]) {
      assert.equal(serializedLogs.includes(secret), false, "captured request logs must not contain key material");
    }
    assert.equal(serializedLogs.includes("database failure"), false, "raw persistence errors must not be logged");
    assert.equal(inboxRows.find((row) => row.teamId === "team-b")?.encryptedApiKey, encryptedB);
  } finally {
    injectedWriteError = null;
    injectedWriteKey = null;
  }
});
