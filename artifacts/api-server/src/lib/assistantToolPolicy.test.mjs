import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

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

const {
  assistantRolePolicyKey,
  combineAssistantToolRestrictions,
  filterDisabledAssistantTools,
  isAssistantToolDisabled,
  normalizeAssistantToolPolicy,
  parseDisabledAssistantTools,
} = await import("./assistantToolPolicy.ts");

test("disabled selections retain only supported static, service, and workspace tools", () => {
  const knownTools = new Set(["generate_image", "search_applicants"]);
  const disabled = parseDisabledAssistantTools([
    "generate_image",
    "onshape_getDocument",
    "custom_mcp_write_file",
    "cw_0123456789abcdef_save_item",
    "not_a_tool",
    "custom_mcp_bad tool",
    "cw_invalid_save_item",
    null,
  ], knownTools);

  assert.deepEqual([...disabled].sort(), [
    "custom_mcp_write_file",
    "cw_0123456789abcdef_save_item",
    "generate_image",
    "onshape_getDocument",
  ]);
});

test("disabled static and dynamic tools are filtered from the model catalog", () => {
  const imageTool = { function: { name: "generate_image" } };
  assert.deepEqual(filterDisabledAssistantTools([imageTool], new Set()), [imageTool]);

  const disabled = parseDisabledAssistantTools(
    ["generate_image", "onshape_updateDocument", "custom_mcp_write_file", "cw_0123456789abcdef_save_item"],
    new Set(["generate_image"]),
  );
  const tools = [
    { function: { name: "generate_image" } },
    { function: { name: "search_applicants" } },
    { function: { name: "onshape_updateDocument" } },
    { function: { name: "custom_mcp_write_file" } },
    { function: { name: "cw_0123456789abcdef_save_item" } },
  ];

  assert.deepEqual(
    filterDisabledAssistantTools(tools, disabled).map((tool) => tool.function.name),
    ["search_applicants"],
  );
  assert.equal(isAssistantToolDisabled("custom_mcp_write_file", disabled), true);
  assert.equal(isAssistantToolDisabled("cw_0123456789abcdef_save_item", disabled), true);
  assert.equal(isAssistantToolDisabled("search_applicants", disabled), false);
});

test("legacy tool aliases remain blocked by their canonical disabled selection", () => {
  const disabled = parseDisabledAssistantTools(["python_exec", "web_search"], new Set(["python_exec", "web_search"]));
  assert.equal(isAssistantToolDisabled("python", disabled), true);
  assert.equal(isAssistantToolDisabled("fetch_url", disabled), true);
});

test("team, built-in role, and custom role restrictions are cumulative and cannot be overridden by requests", () => {
  const knownTools = new Set(["search_applicants", "delete_applicant", "generate_image"]);
  const policy = normalizeAssistantToolPolicy({
    teamDisabledTools: ["generate_image"],
    roleDisabledTools: {
      "builtin:interviewer": ["delete_applicant"],
      "custom:robotics-lead": ["search_applicants", "not_a_tool"],
    },
  }, knownTools);

  const builtInDisabled = combineAssistantToolRestrictions(
    ["delete_applicant"],
    policy,
    assistantRolePolicyKey("interviewer"),
    knownTools,
  );
  assert.deepEqual([...builtInDisabled].sort(), ["delete_applicant", "generate_image"]);

  const customDisabled = combineAssistantToolRestrictions(
    [],
    policy,
    assistantRolePolicyKey("custom", "robotics-lead"),
    knownTools,
  );
  assert.deepEqual([...customDisabled].sort(), ["generate_image", "search_applicants"]);
  assert.equal(customDisabled.has("not_a_tool"), false);
});

test("usage and tool-policy routes are protected by the built-in admin gate", () => {
  const routes = readFileSync(new URL("../routes/robotics.ts", import.meta.url), "utf8");
  const auth = readFileSync(new URL("../middlewares/adminAuth.ts", import.meta.url), "utf8");
  assert.match(routes, /router\.get\("\/assistant\/usage", requireCoordinator/);
  assert.match(routes, /router\.get\("\/assistant\/tool-policy", requireCoordinator/);
  assert.match(routes, /router\.put\("\/assistant\/tool-policy", requireCoordinator/);
  assert.ok(auth.includes("assistant\\/(?:usage|tool-policy)"));
});
