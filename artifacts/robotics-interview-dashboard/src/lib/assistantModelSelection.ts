export const DEFAULT_ASSISTANT_MODEL = "minimax/minimax-m3.1-flash:free";
export const LEGACY_IMPLICIT_ASSISTANT_MODEL = "openrouter/free";

export type AssistantModelSelectionOption = { id: string };

export function resolveAssistantModelSelection(
  savedModel: string,
  configuredModel: string | undefined,
  models: readonly AssistantModelSelectionOption[],
): string {
  const available = new Set(models.map((model) => model.id));
  if (
    savedModel &&
    savedModel !== LEGACY_IMPLICIT_ASSISTANT_MODEL &&
    available.has(savedModel)
  ) return savedModel;
  if (configuredModel && available.has(configuredModel)) return configuredModel;
  if (available.has(DEFAULT_ASSISTANT_MODEL)) return DEFAULT_ASSISTANT_MODEL;
  return models[0]?.id ?? configuredModel ?? DEFAULT_ASSISTANT_MODEL;
}
