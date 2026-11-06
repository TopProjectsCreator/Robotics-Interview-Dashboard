export type AssistantProviderProtocol =
  | "anthropic-messages"
  | "gemini-generate-content"
  | "openai-chat-completions"
  | "openai-responses"
  | "openai-compatible";

export type AssistantProviderModel = {
  id: string;
  name: string;
  description?: string;
  contextLength: number | null;
  inputModalities: string[];
  outputModalities: string[];
  toolCalling: boolean;
  reasoning: boolean;
};

export type AssistantProvider = {
  id: string;
  name: string;
  protocol: AssistantProviderProtocol;
  description: string;
  website: string;
  models: AssistantProviderModel[];
};

type CatalogCache = {
  expiresAt: number;
  refreshedAt: string;
  providers: AssistantProvider[];
};

const CATALOG_URL = "https://models.dev/api.json";
const CATALOG_TTL_MS = 15 * 60 * 1000;
let cache: CatalogCache | undefined;
let pendingRefresh: Promise<CatalogCache> | undefined;

const supportedNativeProviders: Record<string, {
  protocol: AssistantProviderProtocol;
  name?: string;
  website: string;
}> = {
  anthropic: { protocol: "anthropic-messages", website: "https://www.anthropic.com" },
  google: { protocol: "gemini-generate-content", name: "Google Gemini", website: "https://ai.google.dev" },
  openai: { protocol: "openai-chat-completions", website: "https://platform.openai.com" },
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeModels(value: unknown): AssistantProviderModel[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([rawId, rawModel]) => {
    if (!rawModel || typeof rawModel !== "object" || Array.isArray(rawModel)) return [];
    const model = rawModel as Record<string, unknown>;
    const id = text(model.id) ?? rawId;
    const modalities = model.modalities && typeof model.modalities === "object"
      ? model.modalities as Record<string, unknown>
      : {};
    const input = Array.isArray(modalities.input)
      ? modalities.input.filter((item): item is string => typeof item === "string")
      : ["text"];
    const output = Array.isArray(modalities.output)
      ? modalities.output.filter((item): item is string => typeof item === "string")
      : ["text"];
    const limit = model.limit && typeof model.limit === "object"
      ? (model.limit as Record<string, unknown>).context
      : undefined;
    return [{
      id,
      name: text(model.name) ?? id,
      ...(text(model.description) ? { description: text(model.description) } : {}),
      contextLength: typeof limit === "number" && Number.isSafeInteger(limit) ? limit : null,
      inputModalities: [...new Set(input)],
      outputModalities: [...new Set(output)],
      toolCalling: model.tool_call === true || model.toolCall === true,
      reasoning: model.reasoning === true,
    }];
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function parseProviderCatalog(value: unknown): AssistantProvider[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The provider catalog response is invalid.");
  }
  const raw = value as Record<string, unknown>;
  const providers: AssistantProvider[] = [];
  for (const [id, details] of Object.entries(supportedNativeProviders)) {
    const rawProvider = raw[id];
    if (!rawProvider || typeof rawProvider !== "object" || Array.isArray(rawProvider)) continue;
    const provider = rawProvider as Record<string, unknown>;
    const models = normalizeModels(provider.models);
    const name = details.name ?? text(provider.name) ?? id;
    providers.push({
      id,
      name,
      protocol: details.protocol,
      description: text(provider.description) ?? `${name} models`,
      website: details.website,
      models,
    });
    if (id === "openai") {
      providers.push({
        id: "openai-responses",
        name: "OpenAI (Responses API)",
        protocol: "openai-responses",
        description: "OpenAI models through the Responses API",
        website: details.website,
        models,
      });
    }
  }
  providers.push({
    id: "custom-openai-compatible",
    name: "Custom OpenAI-compatible endpoint",
    protocol: "openai-compatible",
    description: "Connect an OpenAI-compatible API endpoint",
    website: "",
    models: [],
  });
  return providers.sort((a, b) => a.name.localeCompare(b.name));
}

async function refreshCatalog(): Promise<CatalogCache> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = (async () => {
    const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Provider catalog responded with ${response.status}.`);
    const providers = parseProviderCatalog(await response.json());
    if (!providers.some((provider) => provider.id === "openai")) {
      throw new Error("The provider catalog does not include supported providers.");
    }
    const next: CatalogCache = {
      expiresAt: Date.now() + CATALOG_TTL_MS,
      refreshedAt: new Date().toISOString(),
      providers,
    };
    cache = next;
    return next;
  })().finally(() => {
    pendingRefresh = undefined;
  });
  return pendingRefresh;
}

async function currentCatalog(forceRefresh = false): Promise<CatalogCache> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) return cache;
  try {
    return await refreshCatalog();
  } catch (error) {
    if (cache) return cache;
    throw error;
  }
}

export async function listAssistantProviders(
  search = "",
  forceRefresh = false,
): Promise<{ items: (Omit<AssistantProvider, "models"> & { modelCount: number })[]; refreshedAt: string | null }> {
  const catalog = await currentCatalog(forceRefresh);
  const needle = search.trim().toLocaleLowerCase();
  const items = catalog.providers
    .filter((provider) => !needle ||
      provider.name.toLocaleLowerCase().includes(needle) ||
      provider.id.toLocaleLowerCase().includes(needle) ||
      provider.description.toLocaleLowerCase().includes(needle))
    .map(({ models, ...provider }) => ({ ...provider, modelCount: models.length }));
  return { items, refreshedAt: catalog.refreshedAt };
}

export async function getAssistantProvider(providerId: string): Promise<AssistantProvider | undefined> {
  const catalog = await currentCatalog();
  return catalog.providers.find((provider) => provider.id === providerId);
}

export async function listProviderModels(
  providerId: string,
  search = "",
): Promise<AssistantProviderModel[] | undefined> {
  const provider = await getAssistantProvider(providerId);
  if (!provider) return undefined;
  const needle = search.trim().toLocaleLowerCase();
  if (provider.protocol === "openai-compatible") {
    const customId = search.trim();
    return customId
      ? [{
          id: customId,
          name: customId,
          contextLength: null,
          inputModalities: ["text"],
          outputModalities: ["text"],
          toolCalling: true,
          reasoning: false,
        }]
      : [];
  }
  return provider.models.filter((model) =>
    !needle || model.name.toLocaleLowerCase().includes(needle) ||
      model.id.toLocaleLowerCase().includes(needle) ||
      model.description?.toLocaleLowerCase().includes(needle),
  );
}

export function clearAssistantProviderCatalogCacheForTests(): void {
  cache = undefined;
  pendingRefresh = undefined;
}
