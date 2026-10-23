import assert from "node:assert/strict";
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
  filterDisabledAssistantTools,
  isAssistantToolDisabled,
  parseDisabledAssistantTools,
} = await import("./assistantToolPolicy.ts");

test("disabled selections retain only supported static and dynamically named MCP tools", () => {
  const knownTools = new Set(["generate_image", "search_applicants"]);
  const disabled = parseDisabledAssistantTools([
    "generate_image",
    "onshape_getDocument",
    "custom_mcp_write_file",
    "not_a_tool",
    "custom_mcp_bad tool",
    null,
  ], knownTools);

  assert.deepEqual([...disabled].sort(), [
    "custom_mcp_write_file",
    "generate_image",
    "onshape_getDocument",
  ]);
});

test("disabled static and dynamic tools are filtered from the model catalog", () => {
  const imageTool = { function: { name: "generate_image" } };
  assert.deepEqual(filterDisabledAssistantTools([imageTool], new Set()), [imageTool]);

  const disabled = parseDisabledAssistantTools(
    ["generate_image", "onshape_updateDocument", "custom_mcp_write_file"],
    new Set(["generate_image"]),
  );
  const tools = [
    { function: { name: "generate_image" } },
    { function: { name: "search_applicants" } },
    { function: { name: "onshape_updateDocument" } },
    { function: { name: "custom_mcp_write_file" } },
  ];

  assert.deepEqual(
    filterDisabledAssistantTools(tools, disabled).map((tool) => tool.function.name),
    ["search_applicants"],
  );
  assert.equal(isAssistantToolDisabled("custom_mcp_write_file", disabled), true);
  assert.equal(isAssistantToolDisabled("search_applicants", disabled), false);
});

test("legacy tool aliases remain blocked by their canonical disabled selection", () => {
  const disabled = parseDisabledAssistantTools(["python_exec", "web_search"], new Set(["python_exec", "web_search"]));
  assert.equal(isAssistantToolDisabled("python", disabled), true);
  assert.equal(isAssistantToolDisabled("fetch_url", disabled), true);
});
