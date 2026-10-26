import type { AssistantCatalogModel } from "./assistantModel";

function includesImageModality(value: unknown): boolean {
  return Array.isArray(value) && value.some((modality) => modality === "image");
}

export function supportsAssistantModelImageInput(model: AssistantCatalogModel): boolean {
  const architecture = model.architecture;
  const architectureInput =
    architecture && typeof architecture === "object" && !Array.isArray(architecture)
      ? (architecture as Record<string, unknown>).input_modalities
      : undefined;
  return includesImageModality(architectureInput) || includesImageModality(model.input_modalities);
}

export function resolveFreeVisionFallback(
  excludedModels: readonly string[],
  catalog: readonly AssistantCatalogModel[],
): string | undefined {
  const excluded = new Set(excludedModels);
  return catalog.find(
    (model) =>
      typeof model.id === "string" &&
      model.id.trim() !== "" &&
      model.isFree === true &&
      !excluded.has(model.id) &&
      supportsAssistantModelImageInput(model),
  )?.id.trim();
}
