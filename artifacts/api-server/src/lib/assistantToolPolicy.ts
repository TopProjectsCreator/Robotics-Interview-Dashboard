const DYNAMIC_ASSISTANT_TOOL_PATTERNS = [
  /^onshape_[a-zA-Z0-9_-]{1,55}$/,
  /^custom_mcp_[a-zA-Z0-9_-]{0,54}$/,
  /^cw_[a-f0-9]{16}_[a-z][a-z0-9_]{0,31}$/,
];

export type AssistantToolPolicy = {
  teamDisabledTools: string[];
  roleDisabledTools: Record<string, string[]>;
};

export function assistantRolePolicyKey(role: string, customRoleId?: string | null): string {
  return customRoleId ? `custom:${customRoleId}` : `builtin:${role}`;
}

export function normalizeAssistantToolPolicy(
  value: unknown,
  knownTools: ReadonlySet<string>,
): AssistantToolPolicy {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const teamDisabledTools = [...parseDisabledAssistantTools(row.teamDisabledTools, knownTools)].sort();
  const roleDisabledTools: Record<string, string[]> = {};
  if (row.roleDisabledTools && typeof row.roleDisabledTools === "object" && !Array.isArray(row.roleDisabledTools)) {
    for (const [key, tools] of Object.entries(row.roleDisabledTools as Record<string, unknown>)) {
      if (!/^(?:builtin:(?:coordinator|admin|treasurer|interviewer)|custom:[A-Za-z0-9_-]{1,128})$/.test(key)) continue;
      const normalized = [...parseDisabledAssistantTools(tools, knownTools)].sort();
      if (normalized.length) roleDisabledTools[key] = normalized;
    }
  }
  return { teamDisabledTools, roleDisabledTools };
}

export function combineAssistantToolRestrictions(
  requestDisabled: unknown,
  policy: AssistantToolPolicy | undefined,
  roleKey: string,
  knownTools: ReadonlySet<string>,
): Set<string> {
  const combined = parseDisabledAssistantTools(requestDisabled, knownTools);
  for (const name of policy?.teamDisabledTools ?? []) combined.add(name);
  for (const name of policy?.roleDisabledTools[roleKey] ?? []) combined.add(name);
  return combined;
}

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
