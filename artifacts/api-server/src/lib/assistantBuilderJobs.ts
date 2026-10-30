export const CUSTOM_WORKSPACE_BUILDER_RUN_KEY = "__customWorkspaceBuilderRunId";
export const CUSTOM_WORKSPACE_BUILDER_ATTEMPT_KEY = "__customWorkspaceBuilderAttempt";
export const CUSTOM_WORKSPACE_BUILDER_CONTINUATION_KEY = "__customWorkspaceBuilderContinuation";
export const CUSTOM_WORKSPACE_BUILDER_MAX_ATTEMPTS = 3;
export const CUSTOM_WORKSPACE_BUILDER_MAX_CONTINUATIONS = 8;

export function customWorkspaceBuilderRunId(payload: Record<string, unknown>): string | undefined {
  const value = payload[CUSTOM_WORKSPACE_BUILDER_RUN_KEY];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function customWorkspaceBuilderAttempt(payload: Record<string, unknown>): number {
  const value = payload[CUSTOM_WORKSPACE_BUILDER_ATTEMPT_KEY];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function customWorkspaceBuilderContinuation(payload: Record<string, unknown>): number {
  const value = payload[CUSTOM_WORKSPACE_BUILDER_CONTINUATION_KEY];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function customWorkspaceBuilderRequestPayload(
  payload: Record<string, unknown>,
  builderRunId: string,
  options: { attempt?: number; continuation?: number } = {},
): Record<string, unknown> {
  return {
    ...payload,
    [CUSTOM_WORKSPACE_BUILDER_RUN_KEY]: builderRunId,
    [CUSTOM_WORKSPACE_BUILDER_ATTEMPT_KEY]: options.attempt ?? 0,
    [CUSTOM_WORKSPACE_BUILDER_CONTINUATION_KEY]: options.continuation ?? 0,
  };
}

export function assistantRequestPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result = { ...payload };
  delete result[CUSTOM_WORKSPACE_BUILDER_RUN_KEY];
  delete result[CUSTOM_WORKSPACE_BUILDER_ATTEMPT_KEY];
  delete result[CUSTOM_WORKSPACE_BUILDER_CONTINUATION_KEY];
  return result;
}

export function isCustomWorkspaceBuilderPrompt(question: string): boolean {
  return /^(Build a custom workspace app for the team\.|Revise custom workspace draft )/i.test(question);
}

export function customWorkspaceDraftId(builderRunId: string): string {
  return `builder-${builderRunId}`;
}

export function customWorkspaceDraftIdFromPrompt(question: string, builderRunId: string): string {
  const directMatch = question.match(/(?:revise|continue)\s+custom workspace draft\s+([^\s.]+)/i);
  const explicitMatch = question.match(/existing draft id\s*[:=]\s*([A-Za-z0-9_-]+)/i);
  return directMatch?.[1] ?? explicitMatch?.[1] ?? customWorkspaceDraftId(builderRunId);
}

export function customWorkspaceRecoveryPrompt(
  originalPrompt: string,
  workspaceId: string,
  answers: Record<string, unknown> = {},
): string {
  const answerSection = Object.keys(answers).length
    ? `\n\nCoordinator answers to the saved builder question (use these directly and do not ask the same questions again):\n${JSON.stringify(answers)}`
    : "";
  return `${originalPrompt}\n\nContinue this existing custom workspace build from its saved draft files. Existing draft ID: ${workspaceId}. Do not create a duplicate workspace. Continue all remaining critique and verification rounds until all five are complete.${answerSection}`;
}

export function customWorkspaceCritiqueContinuationPrompt(workspaceId: string): string {
  return `Revise custom workspace draft ${workspaceId}. The initial build is saved. Inspect its saved files and, if missing, create an original, app-specific assets/icon.svg under 20 KB plus any local SVG illustrations the app needs. Make the icon recognizable and readable against both light and dark host surfaces. Do not use generic sparkle marks, stock icons, fixed mock templates, lorem ipsum, or default test names. Use a clear empty state rather than invented records presented as real. Continue the mandatory five-round independent critique from the current persisted state; do not wait for Publish. Read the current saved source and critique/verification counts, then complete each remaining round in order. For every round, call critique_custom_workspace, fix the eligible findings in the saved source files, and call verify_custom_workspace_fixes before proceeding. Fix scores above 6 in every round and below 6 in rounds 1–4. If a critique or verification fails, reports invalid output, or reports unresolved findings, keep editing and retry until the round is independently verified. Do not create a new workspace.`;
}

