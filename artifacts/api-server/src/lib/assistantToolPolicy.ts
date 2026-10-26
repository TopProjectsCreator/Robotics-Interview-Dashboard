const DYNAMIC_ASSISTANT_TOOL_PATTERNS = [
  /^onshape_[a-zA-Z0-9_-]{1,55}$/,
  /^custom_mcp_[a-zA-Z0-9_-]{0,54}$/,
];

export function parseDisabledAssistantTools(value: unknown, knownTools: ReadonlySet<string>): Set<string> {
  if (!Array.isArray(value)) return new Set();
  const disabled = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const name = entry.trim();
    if (
      name &&
      (knownTools.has(name) || DYNAMIC_ASSISTANT_TOOL_PATTERNS.some((pattern) => pattern.test(name)))
    ) {
      disabled.add(name);
    }
  }
  return disabled;
}

export function isAssistantToolDisabled(name: string | undefined, disabled: ReadonlySet<string>): boolean {
  if (!name || disabled.size === 0) return false;
  if (disabled.has(name)) return true;
  if ((name === "python" && disabled.has("python_exec")) || (name === "python_exec" && disabled.has("python"))) return true;
  if ((name === "rename" && disabled.has("rename_conversation")) || (name === "rename_conversation" && disabled.has("rename"))) return true;
  if ((name === "web_fetch" || name === "fetch_url") && disabled.has("web_search")) return true;
  return false;
}

export function filterDisabledAssistantTools<T extends { function: { name: string } }>(
  tools: T[],
  disabled: ReadonlySet<string>,
): T[] {
  return tools.filter((tool) => !isAssistantToolDisabled(tool.function.name, disabled));
}
