import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import {
  assistantSkillInstructions,
  assistantSkillRepositoryBindings,
  skillActionAllowlist,
} from "./assistantSkills.ts";

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

const policies = new Map();
const pool = {
  async query(statement, values = []) {
    if (statement.includes("from assistant_integration_policies")) {
      return { rows: policies.has(values[0]) ? [{ ...policies.get(values[0]) }] : [] };
    }
    if (statement.includes("insert into assistant_integration_policies")) {
      const row = {
        blocked_mcp_servers: JSON.parse(values[1]),
        blocked_github_repositories: JSON.parse(values[2]),
        updated_at: new Date("2026-11-09T00:00:00.000Z"),
      };
      policies.set(values[0], row);
      return { rows: [{ ...row }] };
    }
    throw new Error(`Unexpected integration policy query: ${statement}`);
  },
};
mock.module("@workspace/db", { namedExports: { pool } });

const {
  getAssistantIntegrationPolicy,
  isMcpServerBlocked,
  normalizeBlockedGithubRepositories,
  normalizeBlockedMcpServers,
  normalizeMcpServerIdentifier,
  parseAssistantIntegrationPolicyRow,
  saveAssistantIntegrationPolicy,
  withoutBlockedGithubSkills,
} = await import("./assistantIntegrationPolicy.ts");

test("MCP identifiers normalize built-ins and HTTPS endpoint URLs", () => {
  assert.equal(normalizeMcpServerIdentifier(" ONshape "), "onshape");
  assert.equal(normalizeMcpServerIdentifier("https://MCP.EXAMPLE:443/mcp"), "https://mcp.example/mcp");
  assert.equal(normalizeMcpServerIdentifier("http://mcp.example/mcp"), null);
  assert.equal(normalizeMcpServerIdentifier("https://user:pass@mcp.example/mcp"), null);
  assert.deepEqual(normalizeBlockedMcpServers(["ONSHAPE", "https://MCP.EXAMPLE:443/mcp"]), [
    "https://mcp.example/mcp",
    "onshape",
  ]);
  assert.equal(normalizeBlockedMcpServers(["https://mcp.example/mcp", "https://MCP.EXAMPLE:443/mcp"]), null);
  assert.equal(normalizeBlockedMcpServers(["onshape", "ONSHAPE"]), null);
});

test("public GitHub repository blocks are canonicalized and validated", () => {
  assert.deepEqual(
    normalizeBlockedGithubRepositories(["https://github.com/team/guide.git/"]),
    ["https://github.com/team/guide"],
  );
  assert.equal(normalizeBlockedGithubRepositories(["https://github.com.evil.example/team/guide"]), null);
  assert.equal(normalizeBlockedGithubRepositories(["https://github.com/team/guide", "https://github.com/team/guide.git"]), null);
});

test("policy reads and updates persist by team without leaking to another team", async () => {
  const saved = await saveAssistantIntegrationPolicy("team-a", {
    blockedMcpServers: ["onshape"],
    blockedGithubRepositories: ["https://github.com/team/guide"],
  });
  assert.deepEqual(saved.blockedMcpServers, ["onshape"]);
  assert.deepEqual((await getAssistantIntegrationPolicy("team-a")).blockedGithubRepositories, ["https://github.com/team/guide"]);
  assert.deepEqual(await getAssistantIntegrationPolicy("team-b"), {
    blockedMcpServers: [],
    blockedGithubRepositories: [],
    updatedAt: null,
  });
  assert.equal(isMcpServerBlocked(await getAssistantIntegrationPolicy("team-a"), "ONSHAPE"), true);
  assert.equal(isMcpServerBlocked(await getAssistantIntegrationPolicy("team-b"), "onshape"), false);
});

test("invalid stored policy fails closed instead of silently lifting blocks", () => {
  assert.throws(() => parseAssistantIntegrationPolicyRow({
    blocked_mcp_servers: ["http://not-https.example/mcp"],
    blocked_github_repositories: [],
  }), /policy is invalid/);
});

test("startup migration creates a private team-scoped policy table", async () => {
  const source = await readFile(new URL("../index.ts", import.meta.url), "utf8");
  assert.match(source, /create table if not exists "assistant_integration_policies"/);
  assert.match(source, /"team_id" text primary key/);
  assert.match(source, /"blocked_mcp_servers" jsonb not null default '\[\]'::jsonb/);
  assert.match(source, /"blocked_github_repositories" jsonb not null default '\[\]'::jsonb/);
  assert.match(source, /"assistant_integration_policies",/);
});

test("a blocked repository removes the whole skill before matching or tool construction", () => {
  const blocked = {
    name: "Applicant evidence review",
    description: "Compare applicants using robotics experience and interview evidence.",
    instructions: "Use this exact workflow guidance.",
    actions: ["search_applicants"],
    githubRepositoryUrl: "https://github.com/team/guide",
  };
  const allowed = {
    ...blocked,
    name: "Applicant summary",
    instructions: "Use only unlinked guidance.",
    actions: ["get_applicant"],
    githubRepositoryUrl: null,
  };
  const policy = {
    blockedMcpServers: [],
    blockedGithubRepositories: ["https://github.com/team/guide"],
    updatedAt: null,
  };
  const skills = withoutBlockedGithubSkills([blocked, allowed], policy);
  assert.deepEqual(skills, [allowed]);
  assert.equal(assistantSkillInstructions(skills).includes("exact workflow guidance"), false);
  assert.equal(assistantSkillInstructions(skills).includes("Use only unlinked guidance."), true);
  assert.deepEqual(skillActionAllowlist(skills), new Set(["get_applicant"]));
  assert.deepEqual(assistantSkillRepositoryBindings(skills), new Map());
  assert.deepEqual(withoutBlockedGithubSkills([blocked], { ...policy, blockedGithubRepositories: [] }), [blocked]);
});

test("admin endpoints protect team-scoped policy and both assistant request modes load filtered skills", async () => {
  const routes = await readFile(new URL("../routes/robotics.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../middlewares/adminAuth.ts", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/assistant\/integration-policy", requireCoordinator/);
  assert.match(routes, /router\.put\("\/assistant\/integration-policy", requireCoordinator/);
  assert.match(routes, /requestTeamId\(req\)/);
  assert.ok(auth.includes("assistant\\/(?:usage|tool-policy|integration-policy)"), "custom roles cannot bypass admin-only policy routes");
  assert.match(routes, /async function getEnabledAssistantSkills\(teamId: string\)[\s\S]*?withoutBlockedGithubSkills\(skills, integrationPolicy\)/);
  assert.match(routes, /await getEnabledAssistantSkills\(teamId\)/);
  assert.match(routes, /getEnabledAssistantSkills\(teamId\?\.trim\(\) \? teamId : DEFAULT_TEAM_ID\)/);
  assert.equal((routes.match(/findRelevantAssistantSkills\(/g) ?? []).length, 2,
    "both interactive assistant request modes match only the already-filtered skill list");
});

test.after(() => mock.restoreAll());
