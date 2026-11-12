import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

mock.module("@workspace/db", { namedExports: { DEFAULT_TEAM_ID: "default", pool: { query: async () => ({ rows: [], rowCount: 0 }) }, runWithInstance: (_instance, fn) => fn() } });
mock.module("@workspace/integrations-openai-ai-server", { namedExports: { openai: { chat: { completions: { create: async () => ({ choices: [{ message: { content: "{}" } }] }) } } } } });
mock.module("./codeCollaboration", { namedExports: { applyCodeFileContent: async () => {} } });
mock.module("./assistantCustomWorkspaceTools", {
  namedExports: {
    validateWorkspaceToolDeclarations: () => null,
    listAssistantCustomWorkspaceTools: async () => [],
    runAssistantCustomWorkspaceTool: async () => ({ content: "{}", detail: "ok" }),
    CUSTOM_WORKSPACE_RESERVED_ACTIONS: new Set(),
    CUSTOM_WORKSPACE_TOOL_NAME_PATTERN: /^cw_/,
  },
});
mock.module("./realtime", { namedExports: { pushRealtimeHint() {} } });
mock.module("./teams", { namedExports: { teamSqlCondition: (column, placeholder) => `(${column} = ${placeholder})` } });
mock.module("./interviewerAccounts", { namedExports: { accountById: async () => null } });
mock.module("./workspaceAccess", { namedExports: { readWorkspaceVisibility: async () => ({}) } });
mock.module("./workspaceVisibility", { namedExports: { userCanSeeWorkspace: () => true } });
mock.module("./assistantModel", { namedExports: { getAssistantModel: async () => "test-model" } });
mock.module("./assistantSchedule", {
  namedExports: { nextAssistantTaskOccurrence: async () => null, validateAssistantTaskSchedule: () => null },
});
mock.module("./assistantBuilderJobs", { namedExports: { customWorkspaceDraftId: (id) => `builder-${id}` } });
mock.module("./customWorkspaceDeletion", { namedExports: { deleteCustomWorkspace: async () => null } });
mock.module("./customWorkspaceFilePatch", {
  namedExports: {
    applySearchReplace: () => ({ ok: true, content: "" }),
    diffSnippet: () => "",
    paginateContent: (content, offset, maxChars) => ({ content: content.slice(offset, offset + maxChars), totalChars: content.length, offset, truncated: false }),
    validateSourceFile: () => [],
  },
});
mock.module("./customWorkspacePreview", {
  namedExports: {
    previewWorkspaceHtml: async () => ({ findings: [] }),
    WORKSPACE_VIEWPORTS: ["desktop", "tablet", "mobile"],
  },
});
mock.module("./customWorkspaceAssets", { namedExports: { inlineLocalSvgAssets: (html) => html } });

const {
  ASSISTANT_WORKSPACE_TOOLS,
  ASSISTANT_EXECUTE_TOOLS_NAME,
  ASSISTANT_SCRIPT_EXCLUDED_TOOLS,
  buildExecuteToolsDescription,
  parseAssistantToolExposure,
  splitAssistantToolsByExposure,
} = await import("./assistantWorkspaceTools.ts");

const tool = (name) => ({ type: "function", function: { name, description: `${name} desc`, parameters: { type: "object", properties: {} } } });

test("parseAssistantToolExposure defaults to direct", () => {
  assert.equal(parseAssistantToolExposure("execute"), "execute");
  assert.equal(parseAssistantToolExposure("direct"), "direct");
  assert.equal(parseAssistantToolExposure(undefined), "direct");
  assert.equal(parseAssistantToolExposure("nope"), "direct");
  assert.equal(parseAssistantToolExposure(7), "direct");
});

test("direct mode exposes every tool except the script gateway", () => {
  const all = [tool("execute_workspace_tools"), tool("create_board"), tool("read_code_file")];
  const { exposed, scriptCatalog } = splitAssistantToolsByExposure(all, "direct");
  assert.deepEqual(exposed.map((t) => t.function.name), ["create_board", "read_code_file"]);
  assert.deepEqual(scriptCatalog.map((t) => t.function.name), ["create_board", "read_code_file"]);
});

test("execute mode exposes only the gateway and keeps the rest as the script catalog", () => {
  const all = [tool("execute_workspace_tools"), tool("create_board"), tool("read_code_file")];
  const { exposed, scriptCatalog } = splitAssistantToolsByExposure(all, "execute");
  assert.deepEqual(exposed.map((t) => t.function.name), ["execute_workspace_tools"]);
  assert.deepEqual(scriptCatalog.map((t) => t.function.name), ["create_board", "read_code_file"]);
});

test("the gateway description lists every callable tool with its schema", () => {
  const description = buildExecuteToolsDescription([
    { name: "list_custom_workspace_files", description: "List draft files", parameters: { type: "object", properties: { workspaceId: { type: "string" } } } },
  ]);
  assert.match(description, /list_custom_workspace_files/);
  assert.match(description, /workspaceId/);
  assert.match(description, /tools\.catalog\(\)/);
});

test("script-excluded tools cover the gateway and interactive-only tools", () => {
  assert.ok(ASSISTANT_SCRIPT_EXCLUDED_TOOLS.has(ASSISTANT_EXECUTE_TOOLS_NAME));
  assert.ok(ASSISTANT_SCRIPT_EXCLUDED_TOOLS.has("ask_user"));
  assert.ok(ASSISTANT_SCRIPT_EXCLUDED_TOOLS.has("create_chat_mini_tool"));
});

test("the workspace catalog contains the gateway tool", () => {
  assert.ok(ASSISTANT_WORKSPACE_TOOLS.some((item) => item.function.name === ASSISTANT_EXECUTE_TOOLS_NAME));
});

test("the route dispatches scripted calls through the shared tool chain", () => {
  const source = readFileSync(new URL("../routes/robotics.ts", import.meta.url), "utf8");
  assert.match(source, /name === ASSISTANT_EXECUTE_TOOLS_NAME/);
  assert.match(source, /runWorkspaceScript\(/);
  assert.match(source, /scriptDepth \+ 1/);
  assert.match(source, /buildExecuteToolsDescription\(scriptCatalog\)/);
  assert.match(source, /parseAssistantToolExposure/);
});
