import { createHmac, timingSafeEqual } from "node:crypto";
import { hasPermission, SETTINGS_CAPABILITIES, type SettingsCapabilityId } from "@workspace/api-zod";
import { getAssistantModel } from "./assistantModel";
import { teamAssistantAI } from "./teamAssistantAi";

const TEAM_CAPABILITIES = SETTINGS_CAPABILITIES.filter((capability) => capability.scope === "signed-in-team");
const CONFIRMATION_REQUIRED = new Set<SettingsCapabilityId>(["team.inbox"]);
const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const MAX_AGENT_ROUNDS = 6;

export type SettingsAgentIdentity = {
  accountId: string;
  teamId: string;
  role: string;
  permissions: readonly string[];
};

export type SettingsAgentAdapter = {
  validate: (settingId: SettingsCapabilityId, value: unknown) => unknown;
  read: (settingId: SettingsCapabilityId, identity: SettingsAgentIdentity) => Promise<unknown>;
  update: (settingId: SettingsCapabilityId, value: unknown, identity: SettingsAgentIdentity) => Promise<unknown>;
};

export type SettingsAgentConfirmation = {
  token: string;
  settingId: SettingsCapabilityId;
  summary: string;
  expiresAt: string;
};

type ConfirmationClaims = {
  accountId: string;
  teamId: string;
  settingId: SettingsCapabilityId;
  currentValue: unknown;
  proposedValue: unknown;
  expiresAt: number;
};

function visibleCapabilities(identity: SettingsAgentIdentity): SettingsCapabilityId[] {
  return TEAM_CAPABILITIES
    .filter((capability) =>
      !capability.requiredPermission || hasPermission(identity.permissions, capability.requiredPermission),
    )
    .map((capability) => capability.id);
}

function ensureVisible(settingId: string, identity: SettingsAgentIdentity): SettingsCapabilityId {
  if (!visibleCapabilities(identity).includes(settingId as SettingsCapabilityId)) {
    throw new Error("That setting is unavailable or you do not have permission to change it.");
  }
  return settingId as SettingsCapabilityId;
}

function jsonSchemaValue(settingId: SettingsCapabilityId): Record<string, unknown> {
  switch (settingId) {
    case "team.chat.slowmode":
      return { type: "object", properties: { slowmodeSeconds: { type: "integer", enum: [0, 5, 10, 30, 60] } }, required: ["slowmodeSeconds"], additionalProperties: false };
    case "team.inbox":
      return {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          allowedSenders: { type: "array", maxItems: 50, items: { type: "string", maxLength: 254 } },
        },
        required: ["enabled", "allowedSenders"],
        additionalProperties: false,
      };
    case "team.nameRules":
      return {
        type: "object",
        properties: {
          rules: {
            type: "array",
            maxItems: 50,
            items: {
              type: "object",
              properties: {
                matchType: { type: "string", enum: ["contains", "startsWith", "endsWith", "exact"] },
                text: { type: "string", minLength: 1, maxLength: 40 },
              },
              required: ["matchType", "text"],
              additionalProperties: false,
            },
          },
        },
        required: ["rules"],
        additionalProperties: false,
      };
    case "team.branding.primaryColor":
      return { type: "object", properties: { primaryColor: { type: ["string", "null"], pattern: "^#[0-9A-Fa-f]{6}$" } }, required: ["primaryColor"], additionalProperties: false };
    case "team.branding.backgroundOptions":
      return {
        type: "object",
        properties: {
          backgroundMode: { type: "string", enum: ["cover", "tile"] },
          backgroundOverlay: { type: "integer", minimum: 0, maximum: 80, multipleOf: 5 },
        },
        required: ["backgroundMode", "backgroundOverlay"],
        additionalProperties: false,
      };
    default:
      return { type: "object", additionalProperties: false };
  }
}

function settingIdSchema(ids: SettingsCapabilityId[]): Record<string, unknown> {
  return { type: "string", enum: ids };
}

export function settingsAgentTools(identity: SettingsAgentIdentity) {
  const ids = visibleCapabilities(identity);
  if (ids.length === 0) return [];
  const valueSchemas = Object.fromEntries(ids.map((id) => [id, jsonSchemaValue(id)]));
  const valueSchema = {
    type: "object",
    oneOf: ids.map((id) => ({
      type: "object",
      properties: {
        settingId: { type: "string", const: id },
        value: valueSchemas[id],
      },
      required: ["settingId", "value"],
      additionalProperties: false,
    })),
  };
  const readSchema = {
    type: "object",
    properties: { settingId: settingIdSchema(ids) },
    required: ["settingId"],
    additionalProperties: false,
  };
  const makeTool = (name: string, description: string, parameters: Record<string, unknown>) => ({
    type: "function" as const,
    function: { name, description, parameters },
  });
  return [
    makeTool(
      "read_setting",
      "Read one visible setting before proposing or applying a change. Use the exact setting ID from the catalog.",
      readSchema,
    ),
    makeTool(
      "propose_setting_change",
      "Validate a proposed setting value and read its current value. This never writes. Use when you need to show the user a preview or resolve uncertainty.",
      valueSchema,
    ),
    makeTool(
      "update_setting",
      "Apply a clearly requested reversible change only after read_setting or propose_setting_change read that same setting in this turn. Sensitive inbox changes return a confirmation request instead of saving.",
      valueSchema,
    ),
  ];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function confirmationKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Settings confirmation is unavailable until session security is configured.");
  return secret;
}

function signConfirmation(claims: ConfirmationClaims): string {
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", confirmationKey()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readConfirmation(token: string, identity: SettingsAgentIdentity): ConfirmationClaims {
  const [encoded, supplied, extra] = token.split(".");
  if (!encoded || !supplied || extra) throw new Error("That settings confirmation is invalid or expired.");
  const expected = createHmac("sha256", confirmationKey()).update(encoded).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(supplied, "base64url");
  } catch {
    throw new Error("That settings confirmation is invalid or expired.");
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("That settings confirmation is invalid or expired.");
  }
  let claims: ConfirmationClaims;
  try {
    claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ConfirmationClaims;
  } catch {
    throw new Error("That settings confirmation is invalid or expired.");
  }
  if (
    claims.accountId !== identity.accountId ||
    claims.teamId !== identity.teamId ||
    !Number.isFinite(claims.expiresAt) ||
    claims.expiresAt <= Date.now() ||
    !CONFIRMATION_REQUIRED.has(claims.settingId)
  ) {
    throw new Error("That settings confirmation is invalid or expired.");
  }
  ensureVisible(claims.settingId, identity);
  return claims;
}

function parseToolArguments(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tool arguments must be an object.");
  return value as Record<string, unknown>;
}

function requireArgumentKeys(args: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(args).some((key) => !allowed.includes(key))) {
    throw new Error("The settings tool received unsupported arguments.");
  }
}

function summarizeChange(settingId: SettingsCapabilityId, value: unknown): string {
  if (settingId === "team.inbox") {
    const settings = value as { enabled: boolean; allowedSenders: string[] };
    return `Update team inbox settings: ${settings.enabled ? "enable" : "disable"} inbox and set ${settings.allowedSenders.length} approved sender${settings.allowedSenders.length === 1 ? "" : "s"}.`;
  }
  return `Update ${settingId}.`;
}

export type SettingsAgentRunOptions = {
  question: string;
  identity: SettingsAgentIdentity;
  adapter: SettingsAgentAdapter;
  confirmationToken?: string;
  model?: string;
  resolveModel?: (teamId: string) => Promise<string>;
  complete?: (input: Record<string, unknown>) => Promise<Record<string, any>>;
};

export type SettingsAgentRunResult = {
  answer: string;
  confirmations: SettingsAgentConfirmation[];
  model: string;
};

export async function runSettingsAgent(options: SettingsAgentRunOptions): Promise<SettingsAgentRunResult> {
  const { identity, adapter } = options;
  const capabilities = visibleCapabilities(identity);
  const confirmations: SettingsAgentConfirmation[] = [];
  const reads = new Map<SettingsCapabilityId, unknown>();
  let model = options.model ?? await (options.resolveModel ?? getAssistantModel)(identity.teamId);
  const complete = options.complete ?? (async (input) =>
    await teamAssistantAI(identity.teamId).chat.completions.create(input as any) as unknown as Record<string, any>);

  if (options.confirmationToken) {
    if (options.question.trim().toLocaleLowerCase() !== "confirm") {
      throw new Error('To approve the pending inbox change, send "confirm" with its confirmation token.');
    }
    const claims = readConfirmation(options.confirmationToken, identity);
    const proposedValue = adapter.validate(claims.settingId, claims.proposedValue);
    const current = await adapter.read(claims.settingId, identity);
    if (stableJson(current) !== stableJson(claims.currentValue)) {
      throw new Error("The setting changed since you reviewed it. Read the current value and propose the change again.");
    }
    const saved = await adapter.update(claims.settingId, proposedValue, identity);
    reads.set(claims.settingId, saved);
    const completion = await complete({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Report only the confirmed settings update shown below. Do not claim any other changes." },
        { role: "user", content: `The user confirmed this settings change: ${summarizeChange(claims.settingId, proposedValue)} Result: ${JSON.stringify(saved)}` },
      ],
    });
    return {
      answer: typeof completion.choices?.[0]?.message?.content === "string"
        ? completion.choices[0].message.content
        : "The confirmed setting was updated.",
      confirmations,
      model,
    };
  }

  const messages: Record<string, unknown>[] = [
    {
      role: "system",
      content: [
        "You are a settings-only assistant for the signed-in user's current team.",
        "You may use only the provided read_setting, propose_setting_change, and update_setting tools.",
        "Do not infer values that were not returned by a read. Always read the exact setting before updating it.",
        "If a target or requested value is ambiguous, ask a concise clarification and do not update.",
        "Reversible changes may be applied directly only when the user clearly requested the exact change.",
        'Team inbox changes require confirmation. When the tool returns confirmationRequired, ask the user to reply exactly "confirm" and include the returned confirmation token in the follow-up request.',
        "Never request, reveal, or process stored API keys, passwords, tokens, or other secret values. Do not call tools for unsupported settings.",
        `Visible setting catalog: ${capabilities.join(", ") || "none"}.`,
      ].join("\n"),
    },
    { role: "user", content: options.question },
  ];

  for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
    const completion = await complete({
      model,
      temperature: 0.2,
      messages,
      tools: settingsAgentTools(identity),
      tool_choice: "auto",
    });
    const message = completion.choices?.[0]?.message ?? {};
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) {
      return {
        answer: typeof message.content === "string" ? message.content : "I couldn't produce a settings response.",
        confirmations,
        model,
      };
    }
    messages.push({
      role: "assistant",
      content: typeof message.content === "string" ? message.content : null,
      tool_calls: calls,
    });
    for (const call of calls) {
      const callId = typeof call.id === "string" ? call.id : `settings_call_${round}`;
      let result: unknown;
      try {
        if (call.type !== "function" || !call.function || typeof call.function.name !== "string") {
          throw new Error("Unsupported settings tool call.");
        }
        const args = parseToolArguments(String(call.function.arguments ?? "{}"));
        if (call.function.name === "read_setting") {
          requireArgumentKeys(args, ["settingId"]);
        } else {
          requireArgumentKeys(args, ["settingId", "value"]);
        }
        const settingId = ensureVisible(String(args.settingId ?? ""), identity);
        if (call.function.name === "read_setting") {
          result = await adapter.read(settingId, identity);
          reads.set(settingId, result);
        } else if (call.function.name === "propose_setting_change") {
          if (!("value" in args)) throw new Error("A proposed value is required.");
          const proposedValue = adapter.validate(settingId, args.value);
          const currentValue = await adapter.read(settingId, identity);
          reads.set(settingId, currentValue);
          result = { settingId, currentValue, proposedValue, confirmationRequired: CONFIRMATION_REQUIRED.has(settingId) };
        } else if (call.function.name === "update_setting") {
          if (!("value" in args)) throw new Error("A setting value is required.");
          const proposedValue = adapter.validate(settingId, args.value);
          if (!reads.has(settingId)) throw new Error("Read the current setting before updating it.");
          const currentValue = await adapter.read(settingId, identity);
          if (stableJson(currentValue) !== stableJson(reads.get(settingId))) {
            reads.set(settingId, currentValue);
            throw new Error("The setting changed since it was read. Review the current value before trying again.");
          }
          if (CONFIRMATION_REQUIRED.has(settingId)) {
            const claims: ConfirmationClaims = {
              accountId: identity.accountId,
              teamId: identity.teamId,
              settingId,
              currentValue,
              proposedValue,
              expiresAt: Date.now() + CONFIRMATION_TTL_MS,
            };
            const token = signConfirmation(claims);
            const expiresAt = new Date(claims.expiresAt).toISOString();
            const confirmation = { token, settingId, summary: summarizeChange(settingId, proposedValue), expiresAt };
            confirmations.push(confirmation);
            result = { confirmationRequired: true, ...confirmation };
          } else {
            result = await adapter.update(settingId, proposedValue, identity);
            reads.set(settingId, result);
          }
        } else {
          throw new Error("Unsupported settings tool.");
        }
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "The setting action failed." };
      }
      messages.push({ role: "tool", tool_call_id: callId, content: JSON.stringify(result) });
    }
  }
  return { answer: "I couldn't complete that settings request in one pass. Please restate the requested change.", confirmations, model };
}
