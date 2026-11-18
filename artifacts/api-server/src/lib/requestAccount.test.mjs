import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import express from "express";
import pino from "pino";
import { dbMockExports } from "./testDbExports.mjs";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.(?:ts|js|mjs|json)$/.test(specifier)) {
        try { return nextResolve(`${specifier}.ts`, context); }
        catch { return nextResolve(`${specifier}/index.ts`, context); }
      }
      throw error;
    }
  },
});

const instance = new AsyncLocalStorage();
const currentInstance = () => instance.getStore() ?? "primary";
const runWithInstance = (value, callback) => instance.run(value, callback);
const accountTable = { id: "account_id" };
const revokedTable = { tokenHash: "token_hash" };
const assessmentsTable = { id: "assessment_id" };
const submissionsTable = { assessmentId: "assessment_id" };
const rolesTable = { id: "role_id" };
let account = { id: "member", role: "coordinator", passwordHash: "configured", teamId: "team-a", displayName: "Alex" };
let accountReads = 0;
let revocationReads = 0;
let required = [];
let submitted = [];
let revoked = false;
let failAccount = false;
let failAssessments = false;
let failRevocation = false;
const db = {
  select() {
    return {
      from(table) {
        return {
          where() {
            async function rows() {
              if (table === accountTable) {
                accountReads += 1;
                if (failAccount) throw new Error("test database failure");
                return account ? [{ ...account, teamId: currentInstance() === "secondary" ? "team-secondary" : account.teamId }] : [];
              }
              if (table === revokedTable) {
                revocationReads += 1;
                if (failRevocation) throw new Error("test revocation failure");
                return revoked ? [{ tokenHash: "revoked" }] : [];
              }
              if (table === assessmentsTable) {
                if (failAssessments) throw new Error("test assessment failure");
                return required;
              }
              if (table === submissionsTable) return submitted;
              if (table === rolesTable) return [];
              throw new Error("Unexpected test table");
            }
            return {
              limit: () => rows(),
              then: (resolve, reject) => rows().then(resolve, reject),
            };
          },
        };
      },
    };
  },
};

mock.module("@workspace/db", {
  namedExports: dbMockExports({
    db, currentInstance, runWithInstance,
    interviewerAccountsTable: accountTable,
    interviewQueueTable: {},
    revokedSessionsTable: revokedTable,
    teamAssessmentsTable: assessmentsTable,
    teamAssessmentSubmissionsTable: submissionsTable,
    teamRolesTable: rolesTable,
  }),
});
mock.module("drizzle-orm", {
  namedExports: {
    eq: (field, value) => ({ field, value }),
    lt: (field, value) => ({ field, value }),
    and: (...conditions) => ({ conditions }),
    or: (...conditions) => ({ conditions }),
    isNull: (field) => ({ field }),
  },
});
mock.module("./logger", { namedExports: { logger: pino({ level: "silent" }) } });
mock.module("./agentProfile", { namedExports: { rememberPublicOriginFromHeaders() {} } });
mock.module("./workspaceAccess", { namedExports: {
  readWorkspaceVisibility: async () => ({}),
  userCanSeeWorkspace: () => false,
} });
mock.module("../routes/sitemap", { namedExports: { sitemapHandler: (_req, res) => res.end() } });
mock.module("../routes/tinyUrls", { namedExports: { tinyUrlRedirectHandler: async (_req, res) => res.end() } });

const { requireAdmin, createInterviewerSession, requestTeamId } = await import("../middlewares/adminAuth.ts");
const { accountById } = await import("./interviewerAccounts.ts");
const { requestAccount } = await import("./requestAccount.ts");
const router = express.Router();
router.get("/queue/chat", requireAdmin, async (req, res) => {
  const signedIn = await accountById(req.interviewerId, req);
  const team = await requestTeamId(req);
  res.json({ displayName: signedIn.displayName, team });
});
mock.module("../routes/index.ts", { defaultExport: router });
const { default: app } = await import("../app.ts");

test("account reads coalesce across real capability, assessment, auth and route layers", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
  });
  const url = `http://127.0.0.1:${server.address().port}/api/queue/chat`;
  async function get(session = createInterviewerSession("member", "primary")) {
    accountReads = 0;
    revocationReads = 0;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${session}` } });
    return { status: response.status, body: await response.json() };
  }

  await t.test("five serial account lookups become one without skipping revocation", async () => {
    assert.deepEqual(await get(), { status: 200, body: { displayName: "Alex", team: "team-a" } });
    assert.equal(accountReads, 1);
    assert.equal(revocationReads, 1);
    account.displayName = "Updated";
    account.teamId = "team-b";
    assert.deepEqual(await get(), { status: 200, body: { displayName: "Updated", team: "team-b" } });
    assert.equal(accountReads, 1, "new requests must read updated account data");
  });
  await t.test("required assessments and custom role removal still fail closed", async () => {
    account.role = "interviewer";
    required = [{ id: "required" }];
    assert.equal((await get()).status, 403);
    assert.equal(accountReads, 1);
    submitted = [{ assessmentId: "required" }];
    assert.equal((await get()).status, 200);
    assert.equal(accountReads, 1);
    failAssessments = true;
    assert.equal((await get()).status, 503);
    failAssessments = false;
    account.customRoleId = "removed-role";
    assert.equal((await get()).status, 403);
    delete account.customRoleId;
    account.role = "coordinator";
  });
  await t.test("revoked, missing, unconfigured and unavailable accounts are not authorized", async () => {
    revoked = true;
    assert.equal((await get()).status, 401);
    revoked = false;
    failRevocation = true;
    assert.equal((await get()).status, 503);
    failRevocation = false;
    const saved = account;
    account = null;
    assert.equal((await get()).status, 403);
    account = { ...saved, passwordHash: null };
    assert.equal((await get()).status, 401);
    account = saved;
    failAccount = true;
    assert.equal((await get()).status, 503);
    failAccount = false;
    assert.equal((await get("invalid-session")).status, 401);
    assert.equal(accountReads, 0, "unsigned identities must not cause account lookups");
  });
  await t.test("signed secondary sessions and request caches stay instance-scoped", async () => {
    assert.deepEqual(await get(createInterviewerSession("member", "secondary")), {
      status: 200, body: { displayName: "Updated", team: "team-secondary" },
    });
    assert.equal(accountReads, 1);
    const req = {};
    accountReads = 0;
    const primary = await runWithInstance("primary", () => Promise.all([
      requestAccount(req, "member"), requestAccount(req, "member"), accountById("member", req),
    ]));
    assert.equal(accountReads, 1, "concurrent consumers share a promise");
    assert.equal(primary[0], primary[1]);
    const secondary = await runWithInstance("secondary", () => requestAccount(req, "member"));
    assert.equal(secondary.teamId, "team-secondary");
    assert.equal(accountReads, 2, "changing instances cannot reuse the other database's account");
  });
  await t.test("missing and failed reads remain scoped to one request and never default a signed-in team", async () => {
    const saved = account;
    account = null;
    const absentReq = {};
    accountReads = 0;
    assert.equal(await requestAccount(absentReq, "member"), undefined);
    assert.equal(await requestAccount(absentReq, "member"), undefined);
    assert.equal(accountReads, 1);
    account = saved;
    failAccount = true;
    const failedReq = {};
    accountReads = 0;
    await assert.rejects(requestAccount(failedReq, "member"));
    await assert.rejects(requestAccount(failedReq, "member"));
    assert.equal(accountReads, 1);
    const signedReq = { get: () => undefined, cookies: { robotics_admin_session: createInterviewerSession("member") } };
    await assert.rejects(requestTeamId(signedReq));
    failAccount = false;
    assert.ok(await requestAccount({}, "member"));
    assert.equal(await requestTeamId({ get: () => undefined }), "default");
  });
  await t.test("the real chat handler opts into request account reuse", () => {
    const source = readFileSync("src/routes/robotics.ts", "utf8");
    const start = source.indexOf('router.get("/queue/chat",');
    const handler = source.slice(start, source.indexOf('router.get("/queue/chat/export"', start));
    assert.match(handler, /accountById\(accountId, req\)/);
    assert.match(handler, /requestTeamId\(req\)/);
  });
});
