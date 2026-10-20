import { openai } from "@workspace/integrations-openai-ai-server";

export const DEFAULT_ASSISTANT_MODEL = "minimax/minimax-m3.1-flash:free";

export type AssistantCatalogModel = {
  id: string;
  name?: string;
  isFree?: unknown;
  supported_parameters?: unknown;
  supportedParameters?: unknown;
  reasoning_levels?: unknown;
  reasoningLevels?: unknown;
  reasoning_efforts?: unknown;
  reasoningEfforts?: unknown;
};

const MODEL_CATALOG_CACHE_MS = 5 * 60 * 1000;
let cachedCatalog: { expiresAt: number; models: AssistantCatalogModel[] } | undefined;
let catalogRequest: Promise<AssistantCatalogModel[]> | undefined;

export function configuredAssistantModel(): string {
  return process.env.AI_ASSISTANT_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL;
}

export async function listAssistantProviderModels(): Promise<AssistantCatalogModel[]> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.models;
  if (catalogRequest) return catalogRequest;

  catalogRequest = openai.models.list().then((result) => {
    const models = result.data.filter(
      (model) => typeof model.id === "string" && model.id.trim(),
    ) as AssistantCatalogModel[];
    cachedCatalog = { expiresAt: Date.now() + MODEL_CATALOG_CACHE_MS, models };
    return models;
  }).finally(() => {
    catalogRequest = undefined;
  });
  return catalogRequest;
}

export function resolveAssistantModel(
  preferredModel: string,
  catalog: readonly AssistantCatalogModel[],
): string {
  if (catalog.some((model) => model.id === preferredModel)) return preferredModel;
  if (catalog.some((model) => model.id === DEFAULT_ASSISTANT_MODEL)) return DEFAULT_ASSISTANT_MODEL;
  return catalog.find((model) => model.isFree === true)?.id ?? DEFAULT_ASSISTANT_MODEL;
}

export async function getAssistantModel(): Promise<string> {
  const preferred = configuredAssistantModel();
  try {
    return resolveAssistantModel(preferred, await listAssistantProviderModels());
  } catch {
    // A catalog outage must not break requests; keep the explicit setting (or
    // the verified default) and let the provider report an actual request error.
    return preferred;
  }
}
