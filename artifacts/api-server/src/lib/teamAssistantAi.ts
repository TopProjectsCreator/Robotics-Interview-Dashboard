import { openai } from "@workspace/integrations-openai-ai-server";
import {
  getTeamAssistantProvider,
} from "./assistantProviderConfiguration";
import { validateCompatibleEndpoint } from "./assistantProviderSecurity";
import {
  invokeAssistantProvider,
  type ChatRequest,
} from "./assistantProviderAdapters";

type CompletionCreate = typeof openai.chat.completions.create;

/**
 * Returns the shared server client for teams without BYOK. A saved team
 * configuration is authoritative: its failures are surfaced, never retried
 * through the shared credential.
 */
export function teamAssistantAI(teamId: string): typeof openai {
  const create: CompletionCreate = (async (request, options) => {
    const provider = await getTeamAssistantProvider(teamId);
    if (!provider) return openai.chat.completions.create(request, options);

    if (provider.protocol === "openai-compatible" && provider.endpointUrl) {
      provider.endpointUrl = await validateCompatibleEndpoint(provider.endpointUrl);
    }
    const compatibleRequest = {
      ...(request as unknown as ChatRequest),
      model: provider.modelId,
    };
    return await invokeAssistantProvider(provider, provider.model, compatibleRequest, {
      signal: options?.signal ?? undefined,
    }) as Awaited<ReturnType<CompletionCreate>>;
  }) as CompletionCreate;
  return {
    chat: { completions: { create } },
  } as typeof openai;
}

export async function getConfiguredTeamProviderModel(teamId: string) {
  const provider = await getTeamAssistantProvider(teamId);
  return provider?.model;
}
