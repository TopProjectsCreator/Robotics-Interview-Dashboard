import assert from "node:assert/strict";
import test from "node:test";
import { runWorkspaceScript } from "./workspaceScript.ts";

test("runs a script that calls tools and returns a result", async () => {
  const catalog = [{ name: "echo", description: "echo args" }];
  const runner = async (tool, args) => ({ content: JSON.stringify({ tool, args }), detail: `called ${tool}` });
  const result = await runWorkspaceScript("const r = await tools.echo({ x: 1 }); return r.args.x + 1;", runner, catalog);
  assert.equal(result.result, 2);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].tool, "echo");
});

test("exposes catalog and help inside the script", async () => {
  const catalog = [{ name: "a_tool", description: "does A" }];
  const runner = async () => ({ content: "{}", detail: "ok" });
  const result = await runWorkspaceScript(
    "return { tools: tools.catalog(), help: tools.help('a_tool'), unknown: tools.help('nope') };",
    runner,
    catalog,
  );
  assert.deepEqual(result.result.tools, ["a_tool"]);
  assert.match(result.result.help, /a_tool: does A/);
  assert.match(result.result.unknown, /Unknown tool/);
});

test("enforces max tool calls", async () => {
  const catalog = [{ name: "tick", description: "tick" }];
  let n = 0;
  const runner = async () => ({ content: JSON.stringify({ n: ++n }), detail: "tick" });
  const code = "for (let i = 0; i < 100; i++) await tools.tick({}); return 'done';";
  await assert.rejects(() => runWorkspaceScript(code, runner, catalog), /exceeded 50 tool calls/);
  assert.equal(n, 50);
});

test("rejects scripts that exceed the size limit", async () => {
  await assert.rejects(() => runWorkspaceScript("x".repeat(8001), async () => ({ content: "{}", detail: "x" }), []), /exceeds 8000 characters/);
});

test("rejects empty scripts", async () => {
  await assert.rejects(() => runWorkspaceScript("  ", async () => ({ content: "{}", detail: "x" }), []), /Script is empty/);
});

test("scripts cannot execute the execute tool recursively", async () => {
  const catalog = [{ name: "execute_workspace_tools", description: "recursive" }];
  const result = await runWorkspaceScript("return tools.catalog();", async () => ({ content: "{}", detail: "x" }), catalog);
  assert.deepEqual(result.result, []);
});

test("script code generation is disabled", async () => {
  await assert.rejects(
    () => runWorkspaceScript("eval('1')", async () => ({ content: "{}", detail: "x" }), []),
    /eval is not allowed|Code generation from strings disallowed/,
  );
});

test("rejects non-serializable results", async () => {
  await assert.rejects(
    () => runWorkspaceScript("return () => 1;", async () => ({ content: "{}", detail: "x" }), []),
    /JSON-serializable/,
  );
});
