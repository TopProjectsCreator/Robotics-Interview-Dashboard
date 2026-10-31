import { randomUUID } from "node:crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { supportsAssistantModelImageInput } from "./partsVisionRouting";

export const DEFAULT_ASSISTANT_MODEL = "minimax/minimax-m3.1-flash:free";

async function defaultTeamId(): Promise<string> {
  return (await import("@workspace/db")).DEFAULT_TEAM_ID;
}

export type AssistantCatalogModel = {
  id: string;
  name?: string;
  isFree?: unknown;
  architecture?: unknown;
  input_modalities?: unknown;
  supported_parameters?: unknown;
  supportedParameters?: unknown;
  reasoning_levels?: unknown;
  reasoningLevels?: unknown;
  reasoning_efforts?: unknown;
  reasoningEfforts?: unknown;
};

export type AssistantModelListMode = "allow" | "block" | null;

export type AssistantModelPolicy = {
  defaultModel: string;
  locked: boolean;
  listMode: AssistantModelListMode;
  modelIds: string[];
};

export type AssistantModelPolicyInput = AssistantModelPolicy;

export class AssistantModelPolicyError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AssistantModelPolicyError";
  }
}

export const MAX_ASSISTANT_POLICY_MODELS = 100;

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

function validatePolicyShape(value: unknown): AssistantModelPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssistantModelPolicyError("The team model policy is invalid. Ask an admin to review its settings.", 503);
  }
  const input = value as Record<string, unknown>;
  const defaultModel = typeof input.defaultModel === "string" ? input.defaultModel.trim() : "";
  const locked = input.locked;
  const listMode = input.listMode;
  const modelIds = input.modelIds;
  if (
    !defaultModel ||
    typeof locked !== "boolean" ||
    !(listMode === null || listMode === "allow" || listMode === "block") ||
    !Array.isArray(modelIds) ||
    modelIds.length > MAX_ASSISTANT_POLICY_MODELS ||
    modelIds.some((id) => typeof id !== "string" || !id.trim() || id !== id.trim()) ||
    new Set(modelIds).size !== modelIds.length ||
    (listMode === null && modelIds.length !== 0) ||
    (listMode !== null && modelIds.length === 0)
  ) {
    throw new AssistantModelPolicyError("The team model policy is invalid. Ask an admin to review its settings.", 503);
  }
  return { defaultModel, locked, listMode, modelIds: [...modelIds] as string[] };
}

async function storedPolicy(teamId: string): Promise<AssistantModelPolicy | undefined> {
  const [{ assistantModelPoliciesTable, db }, { eq }] = await Promise.all([
    import("@workspace/db"),
    import("drizzle-orm"),
  ]);
  const [row] = await db.select().from(assistantModelPoliciesTable)
    .where(eq(assistantModelPoliciesTable.teamId, teamId))
    .limit(1);
  if (!row) return undefined;
  return validatePolicyShape({
    defaultModel: row.defaultModel,
    locked: row.locked,
    listMode: row.listMode,
    modelIds: row.modelIds,
  });
}

function validatePolicyAgainstCatalog(
  policy: AssistantModelPolicy,
  catalog: readonly AssistantCatalogModel[],
): AssistantModelPolicy {
  const availableIds = new Set(catalog.map((model) => model.id));
  if (!availableIds.has(policy.defaultModel)) {
    throw new AssistantModelPolicyError(
      `The configured default model "${policy.defaultModel}" is no longer available. Choose an available model in Assistant settings.`,
      503,
    );
  }
  const unavailable = policy.modelIds.filter((id) => !availableIds.has(id));
  if (unavailable.length) {
    throw new AssistantModelPolicyError(
      `The model policy references unavailable model${unavailable.length > 1 ? "s" : ""}: ${unavailable.join(", ")}. Update the team policy in Assistant settings.`,
      503,
    );
  }
  if (policy.listMode === "allow" && !policy.modelIds.includes(policy.defaultModel)) {
    throw new AssistantModelPolicyError("The default model must be included in the allow list.", 503);
  }
  if (policy.listMode === "block" && policy.modelIds.includes(policy.defaultModel)) {
    throw new AssistantModelPolicyError("The default model cannot also appear in the block list.", 503);
  }
  return policy;
}

function modelIsAllowed(modelId: string, policy: AssistantModelPolicy): boolean {
  if (policy.listMode === "allow") return policy.modelIds.includes(modelId);
  if (policy.listMode === "block") return !policy.modelIds.includes(modelId);
  return true;
}

export function effectiveAssistantModels(
  policy: AssistantModelPolicy,
  catalog: readonly AssistantCatalogModel[],
): AssistantCatalogModel[] {
  validatePolicyAgainstCatalog(policy, catalog);
  return catalog.filter((model) => modelIsAllowed(model.id, policy));
}

export async function getAssistantModelPolicy(teamId?: string): Promise<AssistantModelPolicy> {
  const activeTeamId = teamId ?? await defaultTeamId();
  const stored = await storedPolicy(activeTeamId);
  if (stored) return stored;
  try {
    const catalog = await listAssistantProviderModels();
    return { defaultModel: resolveAssistantModel(configuredAssistantModel(), catalog), locked: false, listMode: null, modelIds: [] };
  } catch {
    // Safe legacy default: the provider validates it on use. Explicit policy
    // rows and explicit overrides never use this fallback.
    return { defaultModel: configuredAssistantModel(), locked: false, listMode: null, modelIds: [] };
  }
}

export async function getAssistantModelPolicyWithCatalog(teamId?: string): Promise<{
  policy: AssistantModelPolicy;
  catalog: AssistantCatalogModel[];
  effectiveModels: AssistantCatalogModel[];
  policyError?: string;
}>;
export async function getAssistantModelPolicyWithCatalog(
  teamId: string,
  tolerateInvalidStoredPolicy: true,
): Promise<{
  policy: AssistantModelPolicy;
  catalog: AssistantCatalogModel[];
  effectiveModels: AssistantCatalogModel[];
  policyError?: string;
}>;
export async function getAssistantModelPolicyWithCatalog(
  teamId: string | undefined,
  tolerateInvalidStoredPolicy = false,
): Promise<{
  policy: AssistantModelPolicy;
  catalog: AssistantCatalogModel[];
  effectiveModels: AssistantCatalogModel[];
  policyError?: string;
}> {
  const activeTeamId = teamId ?? await defaultTeamId();
  let catalog: AssistantCatalogModel[];
  try {
    catalog = await listAssistantProviderModels();
  } catch {
    throw new AssistantModelPolicyError("The model catalog is unavailable right now. Try again.", 503);
  }
  let stored: AssistantModelPolicy | undefined;
  let policyError: string | undefined;
  let storedPolicyInvalid = false;
  try {
    stored = await storedPolicy(activeTeamId);
  } catch (error) {
    if (!tolerateInvalidStoredPolicy) throw error;
    storedPolicyInvalid = true;
    policyError = error instanceof Error ? error.message : "The team model policy is invalid.";
  }
  const policy = stored ?? {
      defaultModel: resolveAssistantModel(configuredAssistantModel(), catalog),
      locked: false,
      listMode: null,
      modelIds: [],
    };
  if (storedPolicyInvalid) return { policy, catalog, effectiveModels: [], policyError };
  try {
    validatePolicyAgainstCatalog(policy, catalog);
    return { policy, catalog, effectiveModels: effectiveAssistantModels(policy, catalog), ...(policyError ? { policyError } : {}) };
  } catch (error) {
    if (!tolerateInvalidStoredPolicy) throw error;
    return {
      policy,
      catalog,
      effectiveModels: [],
      policyError: error instanceof Error ? error.message : "The team model policy is invalid.",
    };
  }
}

export async function saveAssistantModelPolicy(
  teamId: string,
  input: AssistantModelPolicyInput,
  actor: { id: string; name: string },
): Promise<AssistantModelPolicy> {
  const policy = validatePolicyShape(input);
  let catalog: AssistantCatalogModel[];
  try {
    catalog = await listAssistantProviderModels();
  } catch {
    throw new AssistantModelPolicyError("The model catalog is unavailable. The policy was not saved.", 503);
  }
  validatePolicyAgainstCatalog(policy, catalog);
  const [{ assistantModelPoliciesTable, assistantModelPolicyHistoryTable, db }, { desc, eq, sql }] = await Promise.all([
    import("@workspace/db"),
    import("drizzle-orm"),
  ]);
  await db.transaction(async (tx) => {
    // Serialize policy writes even before the team's first policy row exists.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${teamId}))`);
    const [stored] = await tx.select().from(assistantModelPoliciesTable)
      .where(eq(assistantModelPoliciesTable.teamId, teamId))
      .limit(1)
      .for("update");
    const previousPolicy: AssistantModelPolicy = stored
      ? {
          defaultModel: stored.defaultModel,
          locked: stored.locked,
          listMode: stored.listMode as AssistantModelListMode,
          modelIds: stored.modelIds,
        }
      : {
          defaultModel: resolveAssistantModel(configuredAssistantModel(), catalog),
          locked: false,
          listMode: null,
          modelIds: [],
        };
    await tx.insert(assistantModelPoliciesTable).values({
      teamId,
      defaultModel: policy.defaultModel,
      locked: policy.locked,
      listMode: policy.listMode,
      modelIds: policy.modelIds,
    }).onConflictDoUpdate({
      target: assistantModelPoliciesTable.teamId,
      set: {
        defaultModel: policy.defaultModel,
        locked: policy.locked,
        listMode: policy.listMode,
        modelIds: policy.modelIds,
        updatedAt: new Date(),
      },
    });
    if (JSON.stringify(previousPolicy) !== JSON.stringify(policy)) {
      await tx.insert(assistantModelPolicyHistoryTable).values({
        id: randomUUID(),
        teamId,
        coordinatorId: actor.id,
        coordinatorName: actor.name,
        previousPolicy,
        newPolicy: policy,
      });
    }
  });
  return policy;
}

export async function listAssistantModelPolicyHistory(teamId: string, limit = 50) {
  const [{ assistantModelPolicyHistoryTable, db }, { desc, eq }] = await Promise.all([
    import("@workspace/db"),
    import("drizzle-orm"),
  ]);
  return db.select().from(assistantModelPolicyHistoryTable)
    .where(eq(assistantModelPolicyHistoryTable.teamId, teamId))
    .orderBy(desc(assistantModelPolicyHistoryTable.createdAt))
    .limit(limit);
}

export async function resolveTeamAssistantModel(
  teamId: string | undefined,
  requestedModel?: string,
  modality: "text" | "image" = "text",
): Promise<string> {
  const { policy, catalog, effectiveModels } = await getAssistantModelPolicyWithCatalog(teamId);
  const compatibleModels = modality === "image"
    ? effectiveModels.filter(supportsAssistantModelImageInput)
    : effectiveModels;
  if (compatibleModels.length === 0) {
    throw new AssistantModelPolicyError(
      modality === "image"
        ? "No image-capable model is permitted by the team model policy."
        : "No models are permitted by the team model policy.",
      503,
    );
  }
  if (modality === "image") {
    if (policy.locked) {
      const defaultModel = catalog.find((model) => model.id === policy.defaultModel);
      if (defaultModel && supportsAssistantModelImageInput(defaultModel)) return policy.defaultModel;
      // A locked text-only default cannot process an image. In that case, use
      // the configured image model (or another policy-permitted image model)
      // without allowing a browser override to change the team's text model.
      if (requestedModel && compatibleModels.some((model) => model.id === requestedModel)) return requestedModel;
      return compatibleModels[0]!.id;
    }
    if (requestedModel && compatibleModels.some((model) => model.id === requestedModel)) return requestedModel;
    return compatibleModels.find((model) => model.id === policy.defaultModel)?.id ?? compatibleModels[0]!.id;
  }
  if (requestedModel) {
    if (policy.locked && requestedModel !== policy.defaultModel) {
      throw new AssistantModelPolicyError("Model choice is locked by your team admin.", 400);
    }
    if (!modelIsAllowed(requestedModel, policy)) {
      throw new AssistantModelPolicyError("That model is not permitted by your team model policy.", 400);
    }
    if (!catalog.some((model) => model.id === requestedModel)) {
      throw new AssistantModelPolicyError("That model is no longer available in the provider catalog.", 400);
    }
    return requestedModel;
  }
  if (!modelIsAllowed(policy.defaultModel, policy)) {
    throw new AssistantModelPolicyError("The team default model conflicts with its model list.", 503);
  }
  return policy.defaultModel;
}

export async function getAssistantModel(
  teamId?: string,
  requestedModel?: string,
): Promise<string> {
  return resolveTeamAssistantModel(teamId, requestedModel);
}
