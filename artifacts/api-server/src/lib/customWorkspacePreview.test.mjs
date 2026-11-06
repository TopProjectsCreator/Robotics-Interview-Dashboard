import assert from "node:assert/strict";
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

mock.module("@workspace/db", { namedExports: { DEFAULT_TEAM_ID: "default" } });
mock.module("@workspace/integrations-openai-ai-server", {
  namedExports: {
    openai: { chat: { completions: { create: async () => ({ choices: [{ message: { content: "{}" } }] }) } } },
  },
});
mock.module("./assistantModel", { namedExports: { getAssistantModel: async () => "test-model" } });

const {
  visualSandboxDocument,
  previewWorkspaceHtml,
  setWorkspaceVisualTools,
  WORKSPACE_VIEWPORTS,
} = await import("./customWorkspacePreview.ts");

test("visualSandboxDocument seals the preview and injects theme tokens", () => {
  const doc = visualSandboxDocument("<html><head></head><body>hi</body></html>", true);
  assert.match(doc, /sandbox="allow-scripts"/);
  assert.match(doc, /--workspace-teal/);
  assert.match(doc, /class=&quot;dark&quot;/);
  const mobile = visualSandboxDocument("<body>hi</body>", false, { width: 390, height: 844 });
  assert.match(mobile, /width:390px;height:844px/);
});

test("previewWorkspaceHtml reports runtime errors and vision findings per variant", async () => {
  setWorkspaceVisualTools({
    capture: async () => ({
      screenshot: Buffer.from("png").toString("base64"),
      runtimeIssues: [{ kind: "JavaScript exception", message: "boom" }],
    }),
    inspect: async () => ({ passed: true, issues: [], repair: "" }),
  });
  const variants = await previewWorkspaceHtml("req", "<body>hi</body>", { themes: ["dark"] });
  assert.equal(variants.length, 1);
  assert.equal(variants[0].passed, false, "runtime errors fail the variant");
  assert.match(variants[0].issues.join(" "), /boom/);
});

test("previewWorkspaceHtml fails open when capture is unavailable", async () => {
  setWorkspaceVisualTools({
    capture: async () => { throw new Error("no chromium"); },
  });
  const variants = await previewWorkspaceHtml("req", "<body>hi</body>", {
    themes: ["light"],
    viewports: [WORKSPACE_VIEWPORTS[0]],
  });
  assert.equal(variants[0].passed, false);
  assert.match(variants[0].issues.join(" "), /no chromium/);
});
