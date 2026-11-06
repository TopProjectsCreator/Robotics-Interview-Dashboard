import { eq } from "drizzle-orm";
import {
  decryptAssistantProviderCredential,
  encryptAssistantProviderCredential,
  validateCompatibleEndpoint,
} from "./assistantProviderSecurity";
import {
  getAssistantProvider,
  listProviderModels,
  type AssistantProviderModel,
  type AssistantProvider,
  type AssistantProviderProtocol,
} from "./assistantProviderCatalog";

export type ActiveAssistantProvider = {
  teamId: string;
  providerId: string;
  providerName: string;
  modelId: string;
  protocol: AssistantProviderProtocol;
  endpointUrl?: string;
  model: AssistantProviderModel;
  apiKey: string;
};

export type AssistantProviderInput = {
  providerId: string;
  modelId: string;
  apiKey: string;
  endpointUrl?: string;
};

export type SafeAssistantProviderStatus = {
  configured: boolean;
  providerId: string | null;
  providerName: string | null;
  modelId: string | null;
  protocol: AssistantProviderProtocol | null;
  endpointUrl: string | null;
  updatedAt: string | null;
};

export async function resolveAssistantProviderInput(
  input: AssistantProviderInput,
): Promise<{ provider: AssistantProvider; endpointUrl?: string }> {
  const provider = await getAssistantProvider(input.providerId);
  if (!provider) throw new Error("Choose a supported provider from the catalog.");
  const modelId = input.modelId.trim();
  if (!modelId || modelId.length > 255 || /[\u0000-\u001f]/.test(modelId)) {
    throw new Error("Choose a valid model.");
  }
  const models = await listProviderModels(provider.id, provider.protocol === "openai-compatible" ? modelId : "");
  if (!models?.some((model) => model.id === modelId)) {
    throw new Error("Choose a model listed for this provider.");
  }
  if (provider.protocol === "openai-compatible") {
    if (!input.endpointUrl?.trim()) throw new Error("Enter the compatible provider's HTTPS endpoint.");
    return { provider, endpointUrl: await validateCompatibleEndpoint(input.endpointUrl) };
  }
  if (input.endpointUrl?.trim()) {
    throw new Error("A custom endpoint is available only for compatible providers.");
  }
  return { provider };
}

export async function getTeamAssistantProvider(teamId: string): Promise<ActiveAssistantProvider | undefined> {
  const database = await import("@workspace/db");
  const db = database.db;
  const teamAssistantProvidersTable = database.teamAssistantProvidersTable;
  if (!db || !teamAssistantProvidersTable) return undefined;
  const [row] = await db.select().from(teamAssistantProvidersTable)
    .where(eq(teamAssistantProvidersTable.teamId, teamId))
    .limit(1);
  if (!row) return undefined;
  const metadata = row.modelMetadata as Partial<AssistantProviderModel>;
  if (
    typeof metadata.id !== "string" || metadata.id !== row.modelId ||
    !Array.isArray(metadata.inputModalities) || !Array.isArray(metadata.outputModalities)
  ) {
    throw new Error("The saved team provider model details are invalid. Reconnect the provider in Assistant settings.");
  }
  return {
    teamId,
    providerId: row.providerId,
    providerName: row.providerName,
    modelId: row.modelId,
    protocol: row.protocol as AssistantProviderProtocol,
    ...(row.endpointUrl ? { endpointUrl: row.endpointUrl } : {}),
    model: metadata as AssistantProviderModel,
    apiKey: decryptAssistantProviderCredential(row.encryptedCredential),
  };
}

export async function getSafeTeamAssistantProviderStatus(teamId: string): Promise<SafeAssistantProviderStatus> {
  const database = await import("@workspace/db");
  const db = database.db;
  const teamAssistantProvidersTable = database.teamAssistantProvidersTable;
  if (!db || !teamAssistantProvidersTable) {
    return {
      configured: false,
      providerId: null,
      providerName: null,
      modelId: null,
      protocol: null,
      endpointUrl: null,
      updatedAt: null,
    };
  }
  const [row] = await db.select({
    providerId: teamAssistantProvidersTable.providerId,
    providerName: teamAssistantProvidersTable.providerName,
    modelId: teamAssistantProvidersTable.modelId,
    protocol: teamAssistantProvidersTable.protocol,
    endpointUrl: teamAssistantProvidersTable.endpointUrl,
    updatedAt: teamAssistantProvidersTable.updatedAt,
  }).from(teamAssistantProvidersTable)
    .where(eq(teamAssistantProvidersTable.teamId, teamId))
    .limit(1);
  if (!row) {
    return {
      configured: false,
      providerId: null,
      providerName: null,
      modelId: null,
      protocol: null,
      endpointUrl: null,
      updatedAt: null,
    };
  }
  return {
    configured: true,
    providerId: row.providerId,
    providerName: row.providerName,
    modelId: row.modelId,
    protocol: row.protocol as AssistantProviderProtocol,
    endpointUrl: row.endpointUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveTeamAssistantProvider(
  teamId: string,
  input: AssistantProviderInput,
  provider: AssistantProvider,
  model: AssistantProviderModel,
  endpointUrl?: string,
): Promise<void> {
  const database = await import("@workspace/db");
  const db = database.db;
  const teamAssistantProvidersTable = database.teamAssistantProvidersTable;
  if (!db || !teamAssistantProvidersTable) {
    throw new Error("Team AI provider storage is unavailable.");
  }
  const encryptedCredential = encryptAssistantProviderCredential(input.apiKey);
  await db.insert(teamAssistantProvidersTable).values({
    teamId,
    providerId: provider.id,
    providerName: provider.name,
    modelId: input.modelId.trim(),
    protocol: provider.protocol,
    endpointUrl: endpointUrl ?? null,
    modelMetadata: model,
    encryptedCredential,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: teamAssistantProvidersTable.teamId,
    set: {
      providerId: provider.id,
      providerName: provider.name,
      modelId: input.modelId.trim(),
      protocol: provider.protocol,
      endpointUrl: endpointUrl ?? null,
      modelMetadata: model,
      encryptedCredential,
      updatedAt: new Date(),
    },
  });
}

export async function removeTeamAssistantProvider(teamId: string): Promise<void> {
  const database = await import("@workspace/db");
  const db = database.db;
  const teamAssistantProvidersTable = database.teamAssistantProvidersTable;
  if (!db || !teamAssistantProvidersTable) {
    throw new Error("Team AI provider storage is unavailable.");
  }
  await db.delete(teamAssistantProvidersTable)
    .where(eq(teamAssistantProvidersTable.teamId, teamId));
}
