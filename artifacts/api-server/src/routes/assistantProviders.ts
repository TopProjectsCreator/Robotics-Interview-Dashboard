import { Router, type IRouter } from "express";
import {
  GetAssistantProviderConfigurationResponse,
  ListAssistantProviderCatalogQueryParams,
  ListAssistantProviderCatalogResponse,
  RemoveAssistantProviderConfigurationResponse,
  SaveAssistantProviderConfigurationBody,
  SaveAssistantProviderConfigurationResponse,
  SearchModelsByProviderParams,
  SearchModelsByProviderQueryParams,
  SearchModelsByProviderResponse,
  ValidateAssistantProviderConfigurationBody,
  ValidateAssistantProviderConfigurationResponse,
} from "@workspace/api-zod";
import {
  getAssistantProvider,
  listAssistantProviders,
  listProviderModels,
} from "../lib/assistantProviderCatalog";
import {
  getSafeTeamAssistantProviderStatus,
  resolveAssistantProviderInput,
  saveTeamAssistantProvider,
  removeTeamAssistantProvider,
  type AssistantProviderInput,
} from "../lib/assistantProviderConfiguration";
import {
  AssistantProviderRequestError,
  validateAssistantProviderConnection,
} from "../lib/assistantProviderAdapters";
import { requireCoordinator, requestTeamId } from "../middlewares/adminAuth";

const router: IRouter = Router();

async function prepareProviderTest(input: AssistantProviderInput) {
  const { provider, endpointUrl } = await resolveAssistantProviderInput(input);
  const models = await listProviderModels(provider.id, provider.protocol === "openai-compatible" ? input.modelId : "");
  const model = models?.find((item) => item.id === input.modelId.trim());
  if (!model) throw new Error("Choose a model listed for this provider.");
  return {
    provider,
    model,
    active: {
      teamId: "configuration-test",
      providerId: provider.id,
      providerName: provider.name,
      modelId: model.id,
      protocol: provider.protocol,
      ...(endpointUrl ? { endpointUrl } : {}),
      model,
      apiKey: input.apiKey,
    },
    endpointUrl,
  };
}

router.get("/assistant/providers", requireCoordinator, async (req, res): Promise<void> => {
  const query = ListAssistantProviderCatalogQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Provider search is invalid." });
    return;
  }
  try {
    const result = await listAssistantProviders(query.data.search ?? "", query.data.refresh === true);
    res.json(ListAssistantProviderCatalogResponse.parse(result));
  } catch {
    req.log.warn("AI provider catalog is unavailable");
    res.status(503).json({ error: "The provider catalog is temporarily unavailable. Try again." });
  }
});

router.get("/assistant/providers/:providerId/models", requireCoordinator, async (req, res): Promise<void> => {
  const params = SearchModelsByProviderParams.safeParse(req.params);
  const query = SearchModelsByProviderQueryParams.safeParse(req.query);
  if (!params.success || !query.success) {
    res.status(400).json({ error: "Provider model search is invalid." });
    return;
  }
  try {
    const items = await listProviderModels(params.data.providerId, query.data.search ?? "");
    if (!items) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    res.json(SearchModelsByProviderResponse.parse({ items }));
  } catch {
    req.log.warn({ providerId: params.data.providerId }, "AI provider model catalog is unavailable");
    res.status(503).json({ error: "The provider model catalog is temporarily unavailable. Try again." });
  }
});

router.get("/assistant/provider-config", requireCoordinator, async (req, res): Promise<void> => {
  try {
    const status = await getSafeTeamAssistantProviderStatus(await requestTeamId(req));
    res.json(GetAssistantProviderConfigurationResponse.parse(status));
  } catch {
    req.log.error("Could not read the team's AI provider status");
    res.status(503).json({ error: "Team AI provider settings are temporarily unavailable." });
  }
});

router.post("/assistant/provider-config/validate", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = ValidateAssistantProviderConfigurationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a provider, model, and credential." });
    return;
  }
  try {
    const prepared = await prepareProviderTest(parsed.data);
    await validateAssistantProviderConnection(prepared.active, prepared.model);
    res.json(ValidateAssistantProviderConfigurationResponse.parse({
      valid: true,
      message: "Connection verified. The configuration has not been saved yet.",
    }));
  } catch (error) {
    const message = error instanceof AssistantProviderRequestError
      ? error.message
      : error instanceof Error ? error.message : "The provider connection could not be verified.";
    res.json(ValidateAssistantProviderConfigurationResponse.parse({
      valid: false,
      message: message.slice(0, 300),
    }));
  }
});

router.put("/assistant/provider-config", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = SaveAssistantProviderConfigurationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a provider, model, and credential." });
    return;
  }
  try {
    const prepared = await prepareProviderTest(parsed.data);
    await validateAssistantProviderConnection(prepared.active, prepared.model);
    const teamId = await requestTeamId(req);
    await saveTeamAssistantProvider(teamId, parsed.data, prepared.provider, prepared.model, prepared.endpointUrl);
    res.json(SaveAssistantProviderConfigurationResponse.parse(
      await getSafeTeamAssistantProviderStatus(teamId),
    ));
  } catch (error) {
    const message = error instanceof AssistantProviderRequestError
      ? error.message
      : error instanceof Error ? error.message : "The provider configuration could not be saved.";
    req.log.warn({
      providerId: parsed.data.providerId,
      modelId: parsed.data.modelId,
      status: error instanceof AssistantProviderRequestError ? error.status : undefined,
    }, "Team AI provider configuration was not saved");
    res.status(error instanceof AssistantProviderRequestError ? error.status : 400).json({
      error: message.slice(0, 300),
    });
  }
});

router.delete("/assistant/provider-config", requireCoordinator, async (req, res): Promise<void> => {
  try {
    await removeTeamAssistantProvider(await requestTeamId(req));
    res.status(204).json(RemoveAssistantProviderConfigurationResponse.parse(undefined));
  } catch {
    req.log.error("Could not remove the team's AI provider configuration");
    res.status(503).json({ error: "Team AI provider settings could not be removed. Try again." });
  }
});

export default router;
