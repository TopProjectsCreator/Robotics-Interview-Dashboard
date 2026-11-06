import vm from "node:vm";

/**
 * Sandboxed script runner for the `execute_workspace_tools` builder tool
 * (Code Mode pattern). The model writes JavaScript that orchestrates the
 * workspace tools — loops, conditions, and data transforms between calls —
 * instead of burning one LLM turn per tool invocation.
 *
 * The script runs in a `node:vm` context with:
 *  - `tools.<toolName>(args)` bound to the server-side tool runner
 *  - `tools.catalog()` listing callable tools
 *  - `tools.help(name)` returning a tool's description
 *  - standard JS globals (JSON, Math, ...) — no Node, fs, network, or
 *    code generation (`eval`/`Function` are disabled).
 *
 * The script body may use `await` and `return` to produce the result.
 */

export interface ScriptToolCall {
  tool: string;
  detail: string;
  outputPreview: string;
}

export interface ScriptRunResult {
  result: unknown;
  calls: ScriptToolCall[];
}

export type ScriptToolRunner = (tool: string, args: Record<string, unknown>) => Promise<{ content: string; detail: string }>;

const MAX_SCRIPT_CHARS = 8_000;
const MAX_TOOL_CALLS = 50;
const MAX_RESULT_CHARS = 30_000;
const SCRIPT_TIMEOUT_MS = 120_000;

function parseToolContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

/**
 * Execute `code` with the provided tool runner.
 * Throws on script errors (caller converts to a tool error result).
 */
export async function runWorkspaceScript(
  code: string,
  toolRunner: ScriptToolRunner,
  catalog: { name: string; description: string }[],
): Promise<ScriptRunResult> {
  const trimmed = String(code ?? "").trim();
  if (!trimmed) throw new Error("Script is empty.");
  if (trimmed.length > MAX_SCRIPT_CHARS) throw new Error(`Script exceeds ${MAX_SCRIPT_CHARS} characters.`);

  const calls: ScriptToolCall[] = [];
  let callCount = 0;

  const tools: Record<string, unknown> = {};
  for (const entry of catalog) {
    if (entry.name === "execute_workspace_tools") continue; // no recursive scripts
    tools[entry.name] = async (args: Record<string, unknown> = {}) => {
      callCount += 1;
      if (callCount > MAX_TOOL_CALLS) throw new Error(`Script exceeded ${MAX_TOOL_CALLS} tool calls.`);
      const result = await toolRunner(entry.name, args);
      calls.push({
        tool: entry.name,
        detail: result.detail,
        outputPreview: result.content.slice(0, 500),
      });
      return parseToolContent(result.content);
    };
  }
  tools.catalog = () => catalog.map((entry) => entry.name);
  tools.help = (toolName: string) => {
    const found = catalog.find((entry) => entry.name === toolName);
    return found ? `${found.name}: ${found.description}` : `Unknown tool: ${String(toolName)}`;
  };

  const sandbox: Record<string, unknown> = {
    tools,
    console: { log: () => {}, error: () => {}, warn: () => {} },
  };
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });
  // Wrap so the script can use await/return as an async function body.
  const wrapped = `(async () => {\n${trimmed}\n})()`;
  const script = new vm.Script(wrapped);
  const result = await script.runInContext(context, { timeout: SCRIPT_TIMEOUT_MS });
  // Serialize to prove the result is transferable and bounded.
  const serialized = JSON.stringify(result ?? null);
  if (serialized === undefined) throw new Error("Script must return a JSON-serializable value.");
  if (serialized.length > MAX_RESULT_CHARS) {
    throw new Error(`Script result exceeds ${MAX_RESULT_CHARS} characters; aggregate or paginate inside the script.`);
  }
  return { result: JSON.parse(serialized) as unknown, calls };
}
