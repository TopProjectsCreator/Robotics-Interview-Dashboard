import assert from "node:assert/strict";
import { once } from "node:events";
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

const USERS = {
  "coordinator-a": { teamId: "team-a", role: "coordinator" },
  "admin-a": { teamId: "team-a", role: "admin" },
  "admin-a-other": { teamId: "team-a", role: "admin" },
  "coordinator-b": { teamId: "team-b", role: "coordinator" },
  "admin-b": { teamId: "team-b", role: "admin" },
};

const TEAM_SQL = (column, placeholder) =>
  `(${column} = ${placeholder} or (${placeholder} = 'default' and ${column} is null))`;

const WORKSPACE_SEEDS = [
  {
    id: "workspace-a",
    teamId: "team-a",
    title: "Team A app",
    description: "",
    html: "<main>Team A</main>",
    capabilities: ["data", "llm"],
    status: "published",
    accessMode: "team",
    allowedInterviewerIds: [],
    createdBy: "coordinator-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "workspace-a-owner",
    teamId: "team-a",
    title: "Creator-only app",
    description: "",
    html: "<main>Private</main>",
    capabilities: ["data", "llm"],
    status: "published",
    accessMode: "owner",
    allowedInterviewerIds: [],
    createdBy: "coordinator-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "workspace-a-draft",
    teamId: "team-a",
    title: "Draft app",
    description: "",
    html: "<main>Draft</main>",
    capabilities: ["data", "llm"],
    status: "draft",
    accessMode: "team",
    allowedInterviewerIds: [],
    critiqueRounds: 5,
    verifiedCritiqueRounds: 5,
    createdBy: "coordinator-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "workspace-a-no-data",
    teamId: "team-a",
    title: "LLM-only app",
    description: "",
    html: "<main>LLM only</main>",
    capabilities: ["llm"],
    status: "published",
    accessMode: "team",
    allowedInterviewerIds: [],
    createdBy: "coordinator-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "workspace-a-no-llm",
    teamId: "team-a",
    title: "Data-only app",
    description: "",
    html: "<main>Data only</main>",
    capabilities: ["data"],
    status: "published",
    accessMode: "team",
    allowedInterviewerIds: [],
    createdBy: "coordinator-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "workspace-b",
    teamId: "team-b",
    title: "Team B app",
    description: "",
    html: "<main>Team B</main>",
    capabilities: ["data", "llm"],
    status: "published",
    accessMode: "team",
    allowedInterviewerIds: [],
    createdBy: "coordinator-b",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "workspace-a-selected",
    teamId: "team-a",
    title: "Selected teammates app",
    description: "",
    html: "<main>Selected</main>",
    capabilities: ["data", "llm"],
    status: "published",
    accessMode: "selected",
    allowedInterviewerIds: ["admin-a"],
    createdBy: "coordinator-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const RECORD_SEEDS = [
  { id: "record-a", teamId: "team-a", workspaceId: "workspace-a", value: { secret: "team A record" } },
  { id: "record-a-selected", teamId: "team-a", workspaceId: "workspace-a-selected", value: { visible: "selected record" } },
  { id: "record-b", teamId: "team-b", workspaceId: "workspace-b", value: { note: "team B record" } },
  // A mismatched row makes sure record-level team predicates still protect
  // reads and mutations even when a record id is supplied directly.
  { id: "record-a-in-b-workspace", teamId: "team-a", workspaceId: "workspace-b", value: { secret: "mis-scoped row" } },
];

let importId = 0;

async function createHarness(t) {
  const workspaces = structuredClone(WORKSPACE_SEEDS);
  const records = structuredClone(RECORD_SEEDS);
  const versions = [{
    id: "version-a-older",
    teamId: "team-a",
    workspaceId: "workspace-a",
    html: "<main>Saved app version</main>",
    capabilities: ["llm"],
    sourceFiles: [
      { path: "index.html", content: "<main>Saved app version</main>" },
      { path: "styles.css", content: ".saved { color: red; }" },
      { path: "app.js", content: "window.savedVersion = true;" },
    ],
    createdBy: "coordinator-a",
    message: "Before revision",
    createdAt: "2026-01-02T00:00:00.000Z",
  }, {
    id: "version-a-selected",
    teamId: "team-a",
    workspaceId: "workspace-a-selected",
    html: "<main>Selected app saved version</main>",
    capabilities: [],
    sourceFiles: [{ path: "index.html", content: "<main>Selected app saved version</main>" }],
    createdBy: "coordinator-a",
    message: "Before selected-app revision",
    createdAt: "2026-01-02T00:00:00.000Z",
  }, {
    id: "version-a-draft",
    teamId: "team-a",
    workspaceId: "workspace-a-draft",
    html: "<main>Draft saved version</main>",
    capabilities: [],
    sourceFiles: [{ path: "index.html", content: "<main>Draft saved version</main>" }],
    createdBy: "coordinator-a",
    message: "Before draft revision",
    createdAt: "2026-01-02T00:00:00.000Z",
  }];
  const calls = {
    queries: [],
    llm: [],
    routeErrors: [],
    keepRuntimeBroken: false,
    darkReviewRejectOnce: false,
    verificationRejectOnce: false,
    subagentWriteOnce: false,
  };
  const savedWorkspaceFiles = new Map(workspaces.map((workspace) => [
    workspace.id,
    [{ path: "index.html", content: workspace.html }],
  ]));
  const logger = {
    info() {},
    warn() {},
    error(context, message) {
      calls.routeErrors.push({
        message,
        error: context?.err instanceof Error ? context.err.message : context?.err,
        stack: context?.err instanceof Error ? context.err.stack : undefined,
      });
    },
  };

  const pool = {
    async query(statement, values = []) {
      calls.queries.push({ statement, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) return { rows: [], rowCount: 0 };

      const ensureTeamScope = (column, placeholder, teamId) => {
        assert.ok(
          statement.includes(TEAM_SQL(column, placeholder)),
          `expected query to scope ${column} using ${placeholder}: ${statement}`,
        );
        assert.equal(values[Number(placeholder.slice(1)) - 1], teamId);
      };

      if (statement.startsWith("select") && statement.includes('from "custom_workspaces"')) {
        if (statement.includes('select "html", "capabilities"')) {
          const [id, teamId] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) => workspace.id === id && workspace.teamId === teamId);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (statement.includes('"created_by" = $3') && !statement.includes('select "title", "prompt", "html"')) {
          const [id, teamId, accountId] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) =>
            workspace.id === id &&
            workspace.teamId === teamId &&
            (workspace.status === "published" ||
              (workspace.status === "draft" && workspace.createdBy === accountId)),
          );
          return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
        }
        if (statement.includes('"prompt"') && statement.includes('and "status" = \u0027draft\u0027')) {
          const [id, teamId] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) =>
            workspace.id === id && workspace.teamId === teamId && workspace.status === "draft",
          );
          const projected = row && statement.includes('"critique_rounds"')
            ? [{
                ...row,
                title: row.title, prompt: row.prompt, html: row.html,
                critique_rounds: row.critiqueRounds ?? 0,
                verified_critique_rounds: row.verifiedCritiqueRounds ?? 0,
                critique_findings: row.critiqueFindings ?? {},
              }]
            : row ? [row] : [];
          return { rows: projected, rowCount: projected.length };
        }
        if (statement.includes('"created_by" = $3')) {
          const [id, teamId, accountId] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) =>
            workspace.id === id &&
            workspace.teamId === teamId &&
            (workspace.status === "published" ||
              (workspace.status === "draft" && workspace.createdBy === accountId)),
          );
          return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
        }
        if (statement.includes("for update")) {
          const [id, teamId] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) =>
            workspace.id === id && workspace.teamId === teamId && ["draft", "published"].includes(workspace.status),
          );
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (statement.includes('order by "updated_at" desc limit 100')) {
          const teamId = values[0];
          const accountId = values[1];
          ensureTeamScope('"team_id"', "$1", teamId);
          const rows = workspaces.filter((workspace) =>
            workspace.teamId === teamId &&
            ((workspace.status === "published" &&
              (workspace.accessMode === "team" ||
                (workspace.accessMode === "owner" && workspace.createdBy === accountId) ||
                (workspace.accessMode === "selected" && workspace.allowedInterviewerIds.includes(accountId)))) ||
              workspace.createdBy === accountId),
          );
          return { rows, rowCount: rows.length };
        }

        const [id, teamId, allowDraftOwner, accountId] = values;
        ensureTeamScope('"team_id"', "$2", teamId);
        const row = workspaces.find((workspace) =>
          workspace.id === id &&
          workspace.teamId === teamId &&
          ((workspace.status === "published" &&
            (workspace.accessMode === "team" ||
              (workspace.accessMode === "owner" && workspace.createdBy === accountId) ||
              (workspace.accessMode === "selected" && workspace.allowedInterviewerIds.includes(accountId)))) ||
            (allowDraftOwner && workspace.status === "draft" && workspace.createdBy === accountId)),
        );
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (statement.startsWith("select") && statement.includes('from "custom_workspace_versions"')) {
        if (statement.includes('order by "created_at" desc limit 50')) {
          const [workspaceId, teamId] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const rows = versions
            .filter((version) => version.workspaceId === workspaceId && version.teamId === teamId)
            .map(({ id, message, createdBy, createdAt }) => ({ id, message, createdBy, createdAt }));
          return { rows, rowCount: rows.length };
        }
        const [versionId, workspaceId, teamId] = values;
        ensureTeamScope('"team_id"', "$3", teamId);
        const row = versions.find((version) =>
          version.id === versionId && version.workspaceId === workspaceId && version.teamId === teamId,
        );
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (statement.startsWith("select") && statement.includes('from "custom_workspace_files"')) {
        const [workspaceId, teamId] = values;
        ensureTeamScope('"team_id"', "$2", teamId);
        const row = workspaces.find((workspace) => workspace.id === workspaceId && workspace.teamId === teamId);
        const rows = row ? savedWorkspaceFiles.get(workspaceId) ?? [] : [];
        return { rows, rowCount: rows.length };
      }

      if (statement.startsWith("select") && statement.includes('from "interviewer_accounts"')) {
        const teamId = values[0];
        ensureTeamScope('"team_id"', "$1", teamId);
        const members = Object.entries(USERS)
          .filter(([, user]) => user.teamId === teamId)
          .map(([id]) => ({ id, displayName: id }));
        if (values.length === 1) return { rows: members, rowCount: members.length };
        const ids = new Set(values[1]);
        const matching = members.filter((member) => ids.has(member.id)).map(({ id }) => ({ id }));
        return { rows: matching, rowCount: matching.length };
      }

      if (statement.startsWith("update \"custom_workspaces\"")) {
        if (statement.includes('set "critique_rounds" = 0')) {
          const [id, teamId] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) =>
            workspace.id === id && workspace.teamId === teamId && workspace.status === "draft" &&
            workspace.critiqueRounds > 0 &&
            workspace.critiqueRounds === workspace.verifiedCritiqueRounds,
          );
          if (!row) return { rows: [], rowCount: 0 };
          row.critiqueRounds = 0;
          row.verifiedCritiqueRounds = 0;
          row.critiqueFindings = {};
          return { rows: [], rowCount: 1 };
        }
        if (statement.includes('set "verified_critique_rounds"')) {
          const [id, teamId, createdBy, verifiedRounds, expectedPrevious] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) =>
            workspace.id === id && workspace.teamId === teamId && workspace.createdBy === createdBy &&
            workspace.status === "draft" && (workspace.verifiedCritiqueRounds ?? 0) === expectedPrevious &&
            workspace.critiqueRounds === verifiedRounds,
          );
          if (!row) return { rows: [], rowCount: 0 };
          row.verifiedCritiqueRounds = verifiedRounds;
          return { rows: [], rowCount: 1 };
        }
        if (statement.includes('set "critique_rounds"')) {
          const [id, teamId, createdBy, critiqueRounds, expectedPrevious] = values;
          ensureTeamScope('"team_id"', "$2", teamId);
          const row = workspaces.find((workspace) =>
            workspace.id === id && workspace.teamId === teamId && workspace.createdBy === createdBy &&
            workspace.status === "draft" && (workspace.critiqueRounds ?? 0) === expectedPrevious,
          );
          if (!row) return { rows: [], rowCount: 0 };
          row.critiqueRounds = critiqueRounds;
          row.critiqueFindings = JSON.parse(values[5]);
          return { rows: [], rowCount: 1 };
        }
        const [id, teamId, accessMode, allowedIdsJson] = values;
        ensureTeamScope('"team_id"', "$2", teamId);
        const row = workspaces.find((workspace) => workspace.id === id && workspace.teamId === teamId);
        if (!row) return { rows: [], rowCount: 0 };
        if (statement.includes('set "html" = $3, "status" = \'published\'')) {
          row.html = accessMode;
          row.status = "published";
          row.accessMode = allowedIdsJson;
          row.allowedInterviewerIds = JSON.parse(values[4]);
        } else if (statement.includes('set "html" = $3')) {
          row.html = accessMode;
          if (row.status === "draft" && statement.includes('"capabilities" = case')) {
            row.capabilities = JSON.parse(allowedIdsJson);
          }
        } else if (statement.includes('set "access_mode" = $3')) {
          row.accessMode = accessMode;
          row.allowedInterviewerIds = JSON.parse(allowedIdsJson);
        }
        return { rows: [row], rowCount: 1 };
      }

      if (statement.startsWith('select') && statement.includes('from "custom_workspace_data"')) {
        const [workspaceId, teamId] = values;
        ensureTeamScope('"team_id"', "$2", teamId);
        const rows = records.filter((record) => record.workspaceId === workspaceId && record.teamId === teamId);
        return { rows, rowCount: rows.length };
      }

      if (statement.startsWith('insert into "custom_workspace_data"')) {
        const [id, teamId, workspaceId, serialized] = values;
        assert.ok(statement.includes('"team_id"'), "data inserts must store the caller's team id");
        assert.equal(
          teamId,
          workspaces.find((workspace) => workspace.id === workspaceId)?.teamId,
          "data inserts must use the workspace owner's team",
        );
        const row = {
          id,
          teamId,
          workspaceId,
          value: JSON.parse(serialized),
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        records.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (statement.startsWith('update "custom_workspace_data"')) {
        const [recordId, workspaceId, serialized, teamId] = values;
        ensureTeamScope('"team_id"', "$4", teamId);
        const row = records.find((record) =>
          record.id === recordId && record.workspaceId === workspaceId && record.teamId === teamId,
        );
        if (!row) return { rows: [], rowCount: 0 };
        row.value = JSON.parse(serialized);
        return { rows: [row], rowCount: 1 };
      }

      if (statement.startsWith('delete from "custom_workspace_data"')) {
        const [recordId, workspaceId, teamId] = values;
        ensureTeamScope('"team_id"', "$3", teamId);
        const index = records.findIndex((record) =>
          record.id === recordId && record.workspaceId === workspaceId && record.teamId === teamId,
        );
        if (index < 0) return { rows: [], rowCount: 0 };
        const [deleted] = records.splice(index, 1);
        return { rows: [{ id: deleted.id }], rowCount: 1 };
      }

      if (statement.startsWith('insert into "custom_workspaces"')) {
        const [id, teamId, title, description, prompt, html, capabilities, createdBy] = values;
        const row = {
          id,
          teamId,
          title,
          description,
          prompt,
          html,
          capabilities: JSON.parse(capabilities),
          status: "draft",
          accessMode: "team",
          allowedInterviewerIds: [],
          critiqueRounds: 0,
          verifiedCritiqueRounds: 0,
          critiqueFindings: {},
          createdBy,
        };
        workspaces.push(row);
        savedWorkspaceFiles.set(id, [{ path: "index.html", content: html }]);
        return { rows: [row], rowCount: 1 };
      }

      if (statement.startsWith('insert into "custom_workspace_versions"')) {
        const [id, teamId, workspaceId, html, capabilities, sourceFiles, createdBy] = values;
        const message = values[7] ?? (
          statement.includes("'Initial AI draft'") ? "Initial AI draft" : "Created by assistant"
        );
        versions.push({
          id,
          teamId,
          workspaceId,
          html,
          capabilities: JSON.parse(capabilities),
          sourceFiles: JSON.parse(sourceFiles),
          createdBy,
          message,
          createdAt: "2026-01-03T00:00:00.000Z",
        });
        return { rows: [], rowCount: 1 };
      }

      if (statement.startsWith('insert into "custom_workspace_files"')) {
        const [, teamId, workspaceId, filePath, content] = statement.includes("'index.html'")
          ? [values[0], values[1], values[2], "index.html", values[3]]
          : values;
        const workspace = workspaces.find((item) => item.id === workspaceId);
        assert.equal(workspace?.teamId, teamId);
        const files = savedWorkspaceFiles.get(workspaceId) ?? [];
        const existing = files.find((file) => file.path === filePath);
        if (existing) existing.content = content;
        else files.push({ path: filePath, content });
        savedWorkspaceFiles.set(workspaceId, files);
        return { rows: [], rowCount: 1 };
      }

      if (statement.startsWith('update "custom_workspace_files"')) {
        const [workspaceId, filePath, teamId, content] = values;
        ensureTeamScope('"team_id"', "$3", teamId);
        const files = savedWorkspaceFiles.get(workspaceId) ?? [];
        const file = files.find((item) => item.path === filePath);
        if (!file) return { rows: [], rowCount: 0 };
        file.content = content;
        return { rows: [{ path: filePath }], rowCount: 1 };
      }

      if (statement.startsWith('delete from "custom_workspace_files"')) {
        const [workspaceId, teamId] = values;
        ensureTeamScope('"team_id"', "$2", teamId);
        savedWorkspaceFiles.set(workspaceId, []);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected custom workspace query: ${statement}`);
    },
    async connect() {
      return {
        query: (...args) => pool.query(...args),
        release() {},
      };
    },
  };

  const resolveUser = (req) => USERS[req.get("x-test-user")];
  const authenticate = (req, res, next, coordinatorOnly = false) => {
    const user = resolveUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (coordinatorOnly && user.role !== "coordinator") {
      res.status(403).json({ error: "Admins only" });
      return;
    }
    next();
  };

  mock.module("@workspace/db", { namedExports: { pool } });
  mock.module("@workspace/integrations-openai-ai-server", {
    namedExports: {
      openai: {
        chat: {
          completions: {
            create: async (request) => {
              calls.llm.push(request);
              const systemPrompt = request.messages[0]?.content ?? "";
              if (systemPrompt.includes("visual QA agent")) {
                const userText = request.messages[1]?.content?.find((item) => item.type === "text")?.text ?? "";
                if (calls.darkReviewRejectOnce && userText.includes("dark theme screenshot")) {
                  calls.darkReviewRejectOnce = false;
                  return {
                    choices: [{
                      message: {
                        content: JSON.stringify({
                          passed: false,
                          issues: ["Dark card text has insufficient contrast."],
                          repair: "Use readable dashboard foreground and card colors in dark mode.",
                        }),
                      },
                    }],
                  };
                }
                return {
                  choices: [{
                    message: {
                      content: JSON.stringify({ passed: true, issues: [], repair: "" }),
                    },
                  }],
                };
              }
              if (systemPrompt.includes("separate custom workspace subagent")) {
                if (!calls.subagentWriteOnce) {
                  calls.subagentWriteOnce = true;
                  const userText = request.messages[1]?.content ?? "";
                  const workspaceId = userText.match(/Draft ID: ([^\n]+)/)?.[1] ?? "";
                  return {
                    choices: [{
                      message: {
                        content: null,
                        tool_calls: [{
                          id: "subagent-file-write",
                          type: "function",
                          function: {
                            name: "create_custom_workspace_file",
                            arguments: JSON.stringify({
                              workspaceId,
                              path: "subagent-review.md",
                              content: "Added a focused accessibility review.",
                            }),
                          },
                        }],
                      },
                    }],
                  };
                }
                return { choices: [{ message: { content: "Created subagent-review.md with the requested review." } }] };
              }
                if (systemPrompt.includes("independent verification agent")) {
                  const userText = request.messages[1]?.content ?? "";
                  const findingsText = userText.split("Required findings:\n")[1]?.split("\nCurrent source:")[0] ?? "[]";
                  const findings = JSON.parse(findingsText);
                  const checks = findings.map((finding) => ({
                    rank: finding.rank,
                    fixed: !calls.verificationRejectOnce,
                    reason: calls.verificationRejectOnce ? "The required behavior is still absent." : "Confirmed in the saved source.",
                  }));
                  calls.verificationRejectOnce = false;
                  return { choices: [{ message: { content: JSON.stringify({ checks }) } }] };
                }
              if (systemPrompt.includes("independent critique agent")) {
                return {
                  choices: [{
                    message: {
                      content: JSON.stringify({
                        flaws: Array.from({ length: 10 }, (_, index) => ({
                          rank: index + 1,
                          score: 10 - index,
                          flaw: `Actionable flaw ${index + 1}`,
                          fix: `Implement fix ${index + 1}`,
                        })),
                      }),
                    },
                  }],
                };
              }
              if (systemPrompt.includes("Repair the standalone internal app")) {
                const payload = JSON.parse(request.messages[1]?.content ?? "{}");
                const sourceFiles = (payload.savedSourceFiles ?? []).map((file) => {
                  if (calls.keepRuntimeBroken) return file;
                  if (file.path === "index.html") {
                    return { ...file, content: file.content.replace('<img src="missing.png">', "") };
                  }
                  if (file.path === "app.js") return { ...file, content: "window.previewReady = true;" };
                  return file;
                });
                return {
                  choices: [{
                    message: {
                      content: JSON.stringify({
                        title: "Repaired draft",
                        description: "",
                        html: "<main>Repaired draft</main>",
                        sourceFiles,
                      }),
                    },
                  }],
                };
              }
              return { choices: [{ message: { content: "Authorized answer" } }] };
            },
          },
        },
      },
    },
  });
  mock.module("../lib/teams", { namedExports: { teamSqlCondition: TEAM_SQL } });
  mock.module("../middlewares/adminAuth", {
    namedExports: {
      requireAdmin: (req, res, next) => authenticate(req, res, next),
      requireCoordinator: (req, res, next) => authenticate(req, res, next, true),
      authenticatedInterviewerId: (req) => req.get("x-test-user"),
      requestTeamId: async (req) => USERS[req.get("x-test-user")]?.teamId ?? "unknown-team",
    },
  });
  mock.module("./codeCollaboration", { namedExports: { applyCodeFileContent: async () => {} } });
  mock.module("./realtime", { namedExports: { pushRealtimeHint() {} } });
  mock.module("./interviewerAccounts", {
    namedExports: {
      accountById: async (accountId) => {
        const user = USERS[accountId];
        return user ? { id: accountId, role: user.role } : null;
      },
    },
  });
  mock.module("./workspaceAccess", { namedExports: { readWorkspaceVisibility: async () => ({}) } });
  mock.module("./workspaceVisibility", {
    namedExports: { userCanSeeWorkspace: () => true },
  });

  t.after(() => mock.restoreAll());

  const [{ default: express }, { default: router, setWorkspaceVisualTools }] = await Promise.all([
    import("express"),
    import(`../routes/customWorkspaces.ts?test=${++importId}`),
  ]);
  // Deterministic browser check: the real capture needs a headless Chromium
  // binary that only exists on some machines. The stub reports the same two
  // diagnostics the sandboxed preview reports (a thrown script and a missing
  // local asset) for the seeded broken draft, and nothing once repaired.
  setWorkspaceVisualTools({
    capture: async (html) => {
      const broken = html.includes("runtime boom") || html.includes("missing.png");
      return {
        screenshot: Buffer.from("stub-screenshot").toString("base64"),
        runtimeIssues: broken
          ? [
              { kind: "javascript", message: "JavaScript exception: runtime boom" },
              { kind: "asset", message: "Asset load failure: missing.png" },
            ]
          : [],
      };
    },
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = logger;
    next();
  });
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  return {
    calls,
    records,
    workspaces,
    savedWorkspaceFiles,
    versions,
    async request(user, method, path, body) {
      return fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "x-test-user": user,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
  };
}

test("workspace lists, reads, and coordinator changes stay within the caller's team", async (t) => {
  const harness = await createHarness(t);

  const listResponse = await harness.request("admin-b", "GET", "/custom-workspaces");
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.deepEqual(listed.workspaces.map((workspace) => workspace.id), ["workspace-b"]);

  const otherTeamRead = await harness.request("admin-b", "GET", "/custom-workspaces/workspace-a");
  assert.equal(otherTeamRead.status, 404);

  const foreignPublish = await harness.request(
    "coordinator-b",
    "POST",
    "/custom-workspaces/workspace-a/publish",
    { accessMode: "team" },
  );
  assert.equal(foreignPublish.status, 404);
  assert.equal(harness.workspaces.find((workspace) => workspace.id === "workspace-a").status, "published");

  const foreignRecords = await harness.request("admin-b", "GET", "/custom-workspaces/workspace-a/data");
  assert.equal(foreignRecords.status, 404);

  const draftReadByOtherTeamMember = await harness.request(
    "admin-a-other",
    "GET",
    "/custom-workspaces/workspace-a-draft",
  );
  assert.equal(draftReadByOtherTeamMember.status, 404);
  const creatorPreview = await harness.request("coordinator-a", "GET", "/custom-workspaces/workspace-a-draft");
  assert.equal(creatorPreview.status, 200);

  const draftWrite = await harness.request(
    "coordinator-a",
    "POST",
    "/custom-workspaces/workspace-a-draft/data",
    { record: { attempted: true } },
  );
  assert.equal(draftWrite.status, 404);
  assert.equal(harness.records.some((record) => record.value.attempted), false);

  const creatorOnlyRead = await harness.request("admin-a-other", "GET", "/custom-workspaces/workspace-a-owner");
  assert.equal(creatorOnlyRead.status, 404);
});

test("selected access is enforced for the app, records, and LLM", async (t) => {
  const harness = await createHarness(t);

  const allowedApp = await harness.request("admin-a", "GET", "/custom-workspaces/workspace-a-selected");
  assert.equal(allowedApp.status, 200);
  assert.deepEqual((await allowedApp.json()).workspace.allowedInterviewerIds, ["admin-a"]);

  const allowedRecords = await harness.request("admin-a", "GET", "/custom-workspaces/workspace-a-selected/data");
  assert.equal(allowedRecords.status, 200);
  assert.deepEqual((await allowedRecords.json()).records.map((record) => record.id), ["record-a-selected"]);
  const allowedLlm = await harness.request("admin-a", "POST", "/custom-workspaces/workspace-a-selected/llm", {
    prompt: "Summarize these records",
  });
  assert.equal(allowedLlm.status, 200);
  assert.equal(harness.calls.llm.length, 1);

  const deniedApp = await harness.request("admin-a-other", "GET", "/custom-workspaces/workspace-a-selected");
  assert.equal(deniedApp.status, 404);
  const deniedRecordRead = await harness.request("admin-a-other", "GET", "/custom-workspaces/workspace-a-selected/data");
  assert.equal(deniedRecordRead.status, 404);
  const deniedRecordCreate = await harness.request(
    "admin-a-other",
    "POST",
    "/custom-workspaces/workspace-a-selected/data",
    { record: { shouldNotPersist: true } },
  );
  assert.equal(deniedRecordCreate.status, 404);
  const deniedRecordUpdate = await harness.request(
    "admin-a-other",
    "PATCH",
    "/custom-workspaces/workspace-a-selected/data/record-a-selected",
    { record: { shouldNotPersist: true } },
  );
  assert.equal(deniedRecordUpdate.status, 404);
  const deniedRecordDelete = await harness.request(
    "admin-a-other",
    "DELETE",
    "/custom-workspaces/workspace-a-selected/data/record-a-selected",
  );
  assert.equal(deniedRecordDelete.status, 404);
  const deniedLlm = await harness.request("admin-a-other", "POST", "/custom-workspaces/workspace-a-selected/llm", {
    prompt: "This must not be sent to the model",
  });
  assert.equal(deniedLlm.status, 404);
  assert.equal(harness.calls.llm.length, 1, "denied requests must not reach the model");
  assert.deepEqual(
    harness.records.find((record) => record.id === "record-a-selected").value,
    { visible: "selected record" },
  );

  const creatorList = await harness.request("coordinator-a", "GET", "/custom-workspaces");
  assert.ok((await creatorList.json()).workspaces.some((workspace) => workspace.id === "workspace-a-selected"));
  const creatorApp = await harness.request("coordinator-a", "GET", "/custom-workspaces/workspace-a-selected");
  assert.equal(creatorApp.status, 404, "the creator does not bypass an explicit selected-member allowlist");
});

test("coordinators can update selected members but cannot grant access across teams", async (t) => {
  const harness = await createHarness(t);

  const membersResponse = await harness.request("coordinator-a", "GET", "/custom-workspaces/team-members");
  assert.equal(membersResponse.status, 200);
  const members = await membersResponse.json();
  assert.deepEqual(members.members.map((member) => member.id).sort(), ["admin-a", "admin-a-other", "coordinator-a"]);
  assert.equal((await harness.request("admin-a", "GET", "/custom-workspaces/team-members")).status, 403);

  const changed = await harness.request("coordinator-a", "PATCH", "/custom-workspaces/workspace-a/access", {
    accessMode: "selected",
    allowedInterviewerIds: ["admin-a", "admin-a-other", "admin-a"],
  });
  assert.equal(changed.status, 200);
  assert.deepEqual((await changed.json()).workspace.allowedInterviewerIds, ["admin-a", "admin-a-other"]);
  assert.equal(harness.workspaces.find((workspace) => workspace.id === "workspace-a").accessMode, "selected");

  const crossTeam = await harness.request("coordinator-a", "PATCH", "/custom-workspaces/workspace-a/access", {
    accessMode: "selected",
    allowedInterviewerIds: ["admin-b"],
  });
  assert.equal(crossTeam.status, 400);
  assert.deepEqual(
    harness.workspaces.find((workspace) => workspace.id === "workspace-a").allowedInterviewerIds,
    ["admin-a", "admin-a-other"],
  );

  const selectedOnPublish = await harness.request(
    "coordinator-a",
    "POST",
    "/custom-workspaces/workspace-a-draft/publish",
    { accessMode: "selected", allowedInterviewerIds: ["admin-a"] },
  );
  assert.equal(selectedOnPublish.status, 200);
  const publishEvents = (await selectedOnPublish.text()).trim().split("\n").map((line) => JSON.parse(line));
  const publishedEvent = publishEvents.find((event) => event.type === "complete");
  const failedPublish = publishEvents.find((event) => event.type === "failed");
  if (publishedEvent) {
    assert.deepEqual(publishedEvent.workspace.allowedInterviewerIds, ["admin-a"]);
  } else {
    assert.ok(failedPublish, "publish must either pass visual QA or explicitly fail");
    assert.equal(harness.workspaces.find((workspace) => workspace.id === "workspace-a-draft").status, "draft");
  }
  assert.equal(
    (await harness.request("admin-a", "GET", "/custom-workspaces/workspace-a-draft")).status,
    publishedEvent ? 200 : 404,
  );
});

function seedBrokenWorkspacePreview(harness) {
  const draft = harness.workspaces.find((workspace) => workspace.id === "workspace-a-draft");
  const indexHtml = "<!doctype html><html><head><meta http-equiv=content-security-policy content=\"default-src 'none'; script-src 'none'\"><script src=\"app.js\"></script></head><body><img src=\"missing.png\"><main>Draft app</main></body></html>";
  const appJs = 'throw new Error("runtime boom");';
  draft.html = indexHtml.replace('<script src="app.js"></script>', `<script>${appJs}</script>`);
  harness.savedWorkspaceFiles.set(draft.id, [
    { path: "index.html", content: indexHtml },
    { path: "app.js", content: appJs },
  ]);
  return draft;
}

test("runtime errors and missing local assets are reported, repaired in saved files, and checked again", async (t) => {
  const harness = await createHarness(t);
  seedBrokenWorkspacePreview(harness);

  const response = await harness.request("coordinator-a", "POST", "/custom-workspaces/workspace-a-draft/publish", {
    accessMode: "team",
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  const runtimeCheck = events.find((event) => event.type === "tool_done" && event.id === "runtime-1");
  assert.equal(runtimeCheck.passed, false);
  assert.match(runtimeCheck.detail, /JavaScript exception:.*runtime boom/);
  assert.match(runtimeCheck.detail, /Asset load failure|Blocked resource/);
  assert.ok(events.some((event) => event.type === "tool_start" && event.tool === "Repair browser runtime issues"));
  assert.ok(
    events.some((event) => event.type === "complete"),
    `the repaired preview should pass on the next check: ${JSON.stringify(events.map(({ image, ...event }) => event))}; ${JSON.stringify(harness.calls.routeErrors)}`,
  );

  const repairRequest = harness.calls.llm.find((request) =>
    request.messages[0]?.content?.includes("Repair the standalone internal app"),
  );
  const repairPayload = JSON.parse(repairRequest.messages[1].content);
  assert.ok(repairPayload.savedSourceFiles.some((file) => file.path === "app.js"));
  assert.equal(
    harness.savedWorkspaceFiles.get("workspace-a-draft").find((file) => file.path === "app.js").content,
    "window.previewReady = true;",
  );
  assert.doesNotMatch(
    harness.savedWorkspaceFiles.get("workspace-a-draft").find((file) => file.path === "index.html").content,
    /missing\.png/,
  );
  assert.equal(harness.workspaces.find((workspace) => workspace.id === "workspace-a-draft").status, "published");
});

test("dark-theme contrast failures are repaired and both themes pass before publishing", async (t) => {
  const harness = await createHarness(t);
  harness.calls.darkReviewRejectOnce = true;

  const response = await harness.request("coordinator-a", "POST", "/custom-workspaces/workspace-a-draft/publish", {
    accessMode: "team",
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(events.some((event) => event.type === "screenshot" && event.theme === "light"));
  assert.ok(
    events.some((event) => event.type === "screenshot" && event.theme === "dark"),
    `dark screenshot missing: ${JSON.stringify(events.map(({ image, ...event }) => event))}; ${JSON.stringify(harness.calls.routeErrors)}`,
  );
  assert.ok(events.some((event) =>
    event.type === "review" && event.theme === "dark" && event.passed === false &&
    event.issues.includes("Dark card text has insufficient contrast."),
  ));
  assert.ok(events.some((event) => event.type === "tool_start" && event.tool === "Repair visual issues"));
  assert.ok(events.some((event) => event.type === "complete"));
  assert.equal(harness.workspaces.find((workspace) => workspace.id === "workspace-a-draft").status, "published");

  const reviewRequests = harness.calls.llm.filter((request) =>
    request.messages[0]?.content?.includes("visual QA agent"),
  );
  assert.ok(reviewRequests.some((request) =>
    request.messages[0].content.includes("DARK-THEME") &&
    request.messages[0].content.includes("hard-coded light surfaces"),
  ));
  const repairRequest = harness.calls.llm.find((request) =>
    request.messages[0]?.content?.includes("Repair the standalone internal app"),
  );
  assert.match(JSON.parse(repairRequest.messages[1].content).visualAndRuntimeFindings, /DARK THEME:/);
  assert.match(JSON.parse(repairRequest.messages[1].content).visualAndRuntimeFindings, /insufficient contrast/);
});

test("persistent browser runtime failures block publication and leave the draft unchanged", async (t) => {
  const harness = await createHarness(t);
  seedBrokenWorkspacePreview(harness);
  harness.calls.keepRuntimeBroken = true;

  const response = await harness.request("coordinator-a", "POST", "/custom-workspaces/workspace-a-draft/publish", {
    accessMode: "team",
  });
  const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(
    events.filter((event) => event.type === "tool_start" && event.tool === "Check browser runtime").length,
    3,
    `${JSON.stringify(events.map(({ image, ...event }) => event))}; ${JSON.stringify(harness.calls.routeErrors)}`,
  );
  assert.match(events.find((event) => event.type === "failed").message, /Browser runtime checks still found errors/);
  assert.equal(harness.workspaces.find((workspace) => workspace.id === "workspace-a-draft").status, "draft");
  assert.match(
    harness.savedWorkspaceFiles.get("workspace-a-draft").find((file) => file.path === "app.js").content,
    /runtime boom/,
  );
});

test("coordinators can preview and restore published versions without changing app permissions", async (t) => {
  const harness = await createHarness(t);
  const workspace = harness.workspaces.find((item) => item.id === "workspace-a-selected");
  workspace.allowedInterviewerIds = ["admin-a"];
  harness.savedWorkspaceFiles.set(workspace.id, [
    { path: "index.html", content: "<main>Selected</main>" },
    { path: "current.css", content: ".current { color: blue; }" },
    { path: "current.js", content: "window.currentVersion = true;" },
  ]);
  const history = await harness.request(
    "coordinator-a",
    "GET",
    "/custom-workspaces/workspace-a-selected/versions",
  );
  assert.equal(history.status, 200);
  const preview = await harness.request(
    "coordinator-a",
    "GET",
    "/custom-workspaces/workspace-a-selected/versions/version-a-selected",
  );
  assert.equal(preview.status, 200);
  const previewVersion = (await preview.json()).version;
  assert.equal(previewVersion.html, "<main>Selected app saved version</main>");
  assert.deepEqual(previewVersion.sourceFiles, [
    { path: "index.html", content: "<main>Selected app saved version</main>" },
  ]);

  const forbidden = await harness.request(
    "admin-a",
    "POST",
    "/custom-workspaces/workspace-a-selected/versions/version-a-selected/restore",
    {},
  );
  assert.equal(forbidden.status, 403);

  const restored = await harness.request(
    "coordinator-a",
    "POST",
    "/custom-workspaces/workspace-a-selected/versions/version-a-selected/restore",
    {},
  );
  assert.equal(restored.status, 200);
  const result = (await restored.json()).workspace;
  assert.equal(result.html, "<main>Selected app saved version</main>");
  assert.deepEqual(result.capabilities, ["data", "llm"]);
  assert.equal(result.accessMode, "selected");
  assert.deepEqual(result.allowedInterviewerIds, ["admin-a"]);
  assert.equal(workspace.status, "published");

  const snapshot = harness.versions.find((version) => version.message === "Before published version restore");
  assert.equal(snapshot.html, "<main>Selected</main>");
  assert.deepEqual(snapshot.capabilities, ["data", "llm"]);
  assert.deepEqual(snapshot.sourceFiles, [
    { path: "index.html", content: "<main>Selected</main>" },
    { path: "current.css", content: ".current { color: blue; }" },
    { path: "current.js", content: "window.currentVersion = true;" },
  ]);
  assert.equal(snapshot.createdBy, "coordinator-a");
  assert.deepEqual(harness.savedWorkspaceFiles.get(workspace.id), [
    { path: "index.html", content: "<main>Selected app saved version</main>" },
  ], "restore removes files that are not part of the selected saved version");

  const foreignPreview = await harness.request(
    "coordinator-b",
    "GET",
    "/custom-workspaces/workspace-a-selected/versions/version-a-selected",
  );
  assert.equal(foreignPreview.status, 404);
});

test("draft restores keep restoring the saved capability set", async (t) => {
  const harness = await createHarness(t);
  const restored = await harness.request(
    "coordinator-a",
    "POST",
    "/custom-workspaces/workspace-a-draft/versions/version-a-draft/restore",
    {},
  );
  assert.equal(restored.status, 200);
  const result = (await restored.json()).workspace;
  assert.equal(result.html, "<main>Draft saved version</main>");
  assert.deepEqual(result.capabilities, []);
  assert.equal(result.status, "draft");
  const snapshot = harness.versions.find((version) => version.message === "Before version restore");
  assert.equal(snapshot.html, "<main>Draft</main>");
  assert.deepEqual(snapshot.capabilities, ["data", "llm"]);
});

test("direct record reads and mutations cannot cross team boundaries", async (t) => {
  const harness = await createHarness(t);

  const recordsResponse = await harness.request("admin-b", "GET", "/custom-workspaces/workspace-b/data");
  assert.equal(recordsResponse.status, 200);
  const result = await recordsResponse.json();
  assert.deepEqual(result.records.map((record) => record.id), ["record-b"]);
  assert.equal(JSON.stringify(result).includes("mis-scoped row"), false);

  const updateResponse = await harness.request(
    "admin-b",
    "PATCH",
    "/custom-workspaces/workspace-b/data/record-a-in-b-workspace",
    { record: { changed: true } },
  );
  assert.equal(updateResponse.status, 404);
  const deleteResponse = await harness.request(
    "admin-b",
    "DELETE",
    "/custom-workspaces/workspace-b/data/record-a-in-b-workspace",
  );
  assert.equal(deleteResponse.status, 404);

  const protectedRecord = harness.records.find((record) => record.id === "record-a-in-b-workspace");
  assert.deepEqual(protectedRecord.value, { secret: "mis-scoped row" });
  assert.equal(harness.records.includes(protectedRecord), true);
});

test("data capability gates reads and writes while authorized CRUD persists", async (t) => {
  const harness = await createHarness(t);

  const noCapabilityRead = await harness.request("admin-a", "GET", "/custom-workspaces/workspace-a-no-data/data");
  assert.equal(noCapabilityRead.status, 403);
  const noCapabilityCreate = await harness.request(
    "admin-a",
    "POST",
    "/custom-workspaces/workspace-a-no-data/data",
    { record: { blocked: true } },
  );
  assert.equal(noCapabilityCreate.status, 403);
  const noCapabilityUpdate = await harness.request(
    "admin-a",
    "PATCH",
    "/custom-workspaces/workspace-a-no-data/data/record-a",
    { record: { blocked: true } },
  );
  assert.equal(noCapabilityUpdate.status, 403);
  const noCapabilityDelete = await harness.request(
    "admin-a",
    "DELETE",
    "/custom-workspaces/workspace-a-no-data/data/record-a",
  );
  assert.equal(noCapabilityDelete.status, 403);
  assert.equal(harness.records.find((record) => record.id === "record-a").value.secret, "team A record");

  const createResponse = await harness.request(
    "admin-b",
    "POST",
    "/custom-workspaces/workspace-b/data",
    { record: { status: "created" } },
  );
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).record;
  assert.equal(created.teamId, "team-b");

  const updateResponse = await harness.request(
    "admin-b",
    "PATCH",
    `/custom-workspaces/workspace-b/data/${created.id}`,
    { record: { status: "updated" } },
  );
  assert.equal(updateResponse.status, 200);
  assert.deepEqual((await updateResponse.json()).record.value, { status: "updated" });

  const listResponse = await harness.request("admin-b", "GET", "/custom-workspaces/workspace-b/data");
  assert.equal(listResponse.status, 200);
  assert.ok((await listResponse.json()).records.some((record) => record.id === created.id));

  const deleteResponse = await harness.request(
    "admin-b",
    "DELETE",
    `/custom-workspaces/workspace-b/data/${created.id}`,
  );
  assert.equal(deleteResponse.status, 200);
  assert.equal(harness.records.some((record) => record.id === created.id), false);
});

test("LLM requests require workspace visibility and the LLM capability", async (t) => {
  const harness = await createHarness(t);

  const allowed = await harness.request("admin-a", "POST", "/custom-workspaces/workspace-a/llm", {
    prompt: "Summarize this app's records",
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { answer: "Authorized answer" });
  assert.equal(harness.calls.llm.length, 1);
  assert.equal(harness.calls.llm[0].messages[0].content, "Summarize this app's records");

  const foreignTeam = await harness.request("admin-b", "POST", "/custom-workspaces/workspace-a/llm", {
    prompt: "Try another team's app",
  });
  assert.equal(foreignTeam.status, 404);

  const missingCapability = await harness.request("admin-a", "POST", "/custom-workspaces/workspace-a-no-llm/llm", {
    prompt: "This workspace did not request LLM access",
  });
  assert.equal(missingCapability.status, 403);

  const creatorOnlyRead = await harness.request("coordinator-a", "GET", "/custom-workspaces/workspace-a-owner");
  assert.equal(creatorOnlyRead.status, 200);
  const creatorOnlyLlm = await harness.request("coordinator-a", "POST", "/custom-workspaces/workspace-a-owner/llm", {
    prompt: "Use creator-only app access",
  });
  assert.equal(creatorOnlyLlm.status, 200);

  const creatorOnly = await harness.request("admin-a-other", "POST", "/custom-workspaces/workspace-a-owner/llm", {
    prompt: "Try a creator-only app",
  });
  assert.equal(creatorOnly.status, 404);

  const unpublished = await harness.request("coordinator-a", "POST", "/custom-workspaces/workspace-a-draft/llm", {
    prompt: "Try a draft",
  });
  assert.equal(unpublished.status, 404);
  assert.equal(harness.calls.llm.length, 2, "denied requests must not reach the model");
});

test("assistant-created custom apps remain drafts owned by the current team", async (t) => {
  const harness = await createHarness(t);
  const { runAssistantWorkspaceTool } = await import(`./assistantWorkspaceTools.ts?test=${++importId}`);
  const args = {
    title: "Assistant-created app",
    description: "A private draft",
    prompt: "Build a simple tracker",
    html: "<main>Tracker</main>",
    capabilities: ["data"],
  };

  const created = await runAssistantWorkspaceTool("create_custom_workspace", args, {
    accountId: "coordinator-b",
    authorName: "Team B coordinator",
    teamId: "team-b",
  });
  assert.match(created.detail, /created custom workspace draft/);

  const insert = harness.calls.queries.find((query) =>
    query.statement.startsWith('insert into "custom_workspaces"'),
  );
  assert.ok(insert);
  assert.equal(insert.values[1], "team-b");
  assert.equal(insert.values[6], JSON.stringify(["data"]));
  assert.match(insert.statement, /'draft'/);
  const createdWorkspace = harness.workspaces.find((workspace) => workspace.title === "Assistant-created app");
  assert.ok(createdWorkspace);
  const initialVersion = harness.versions.find((version) => version.workspaceId === createdWorkspace.id);
  assert.deepEqual(initialVersion.sourceFiles, [
    { path: "index.html", content: "<main>Tracker</main>" },
  ]);
  const critique = await runAssistantWorkspaceTool("critique_custom_workspace", {
    workspaceId: createdWorkspace.id,
    round: 1,
  }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
  const report = JSON.parse(critique.content);
  assert.equal(report.flaws.length, 10);
  assert.deepEqual(report.flaws.map((flaw) => flaw.score), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.match(critique.detail, /10 ranked flaws/);
  assert.equal(report.completedRounds, 1);
  assert.equal(report.requiredRounds, 5);
  assert.match(report.implementationRule, /verify_custom_workspace_fixes/);
  assert.equal(createdWorkspace.critiqueRounds, 1, "a successful critique must persist its round count");
  harness.calls.verificationRejectOnce = true;
  const rejectedVerification = await runAssistantWorkspaceTool("verify_custom_workspace_fixes", {
    workspaceId: createdWorkspace.id, round: 1,
  }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
  assert.equal(JSON.parse(rejectedVerification.content).verified, false);
  assert.match(rejectedVerification.detail, /required fixes remain/);

  const blockedRound = await runAssistantWorkspaceTool("critique_custom_workspace", {
    workspaceId: createdWorkspace.id, round: 2,
  }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
  assert.equal(blockedRound.detail, "previous critique fixes not verified");
  for (const round of [1, 2, 3, 4, 5]) {
    if (round > 1) {
      const nextCritique = await runAssistantWorkspaceTool("critique_custom_workspace", {
        workspaceId: createdWorkspace.id, round,
      }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
      assert.equal(nextCritique.detail, `critique round ${round}: 10 ranked flaws`);
    }
    const verification = await runAssistantWorkspaceTool("verify_custom_workspace_fixes", {
      workspaceId: createdWorkspace.id, round,
    }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
    assert.equal(JSON.parse(verification.content).verified, true);
    if (round === 1) continue;
  }

  await runAssistantWorkspaceTool("create_custom_workspace_file", {
    workspaceId: createdWorkspace.id,
    path: "styles.css",
    content: ".tracker { color: red; }",
  }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
  await runAssistantWorkspaceTool("write_custom_workspace_file", {
    workspaceId: createdWorkspace.id,
    path: "index.html",
    content: '<link rel="stylesheet" href="styles.css"><main class="tracker">Tracker</main>',
  }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
  const beforeIndexEdit = harness.versions.find((version) => version.message === "Before changing index.html");
  assert.deepEqual(beforeIndexEdit.sourceFiles, [
    { path: "index.html", content: "<main>Tracker</main>" },
    { path: "styles.css", content: ".tracker { color: red; }" },
  ]);
  assert.match(createdWorkspace.html, /<style>\.tracker \{ color: red; \}<\/style>/);
  assert.equal(createdWorkspace.critiqueRounds, 0, "editing after verification must invalidate the old review");
  const unverifiedPublish = await harness.request(
    "coordinator-b",
    "POST",
    `/custom-workspaces/${createdWorkspace.id}/publish`,
    { accessMode: "team", allowedInterviewerIds: [] },
  );
  assert.equal(unverifiedPublish.status, 409);
  assert.match((await unverifiedPublish.json()).error, /verify all five critique rounds/);

  const delegated = await runAssistantWorkspaceTool("spawn_workspace_subagent", {
    workspaceId: createdWorkspace.id,
    specialty: "accessibility",
    objective: "Review keyboard accessibility and make a useful source edit.",
  }, { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" });
  assert.match(delegated.detail, /spawned accessibility subagent; 1 file operations/);
  assert.match(JSON.parse(delegated.content).report, /Created subagent-review\.md/);
  assert.equal(
    harness.savedWorkspaceFiles.get(createdWorkspace.id).find((file) => file.path === "subagent-review.md")?.content,
    "Added a focused accessibility review.",
    "the subagent must save its own file edit in the authorized draft",
  );

  const queryCount = harness.calls.queries.length;
  const invalid = await runAssistantWorkspaceTool(
    "create_custom_workspace",
    { ...args, capabilities: ["admin"] },
    { accountId: "coordinator-b", authorName: "Team B coordinator", teamId: "team-b" },
  );
  assert.equal(invalid.detail, "invalid custom workspace");
  assert.equal(harness.calls.queries.length, queryCount, "invalid capabilities must not write a workspace");
});
