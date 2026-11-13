import { randomUUID } from "node:crypto";
import {
  GetChatSettingsResponse,
  GetTeamBrandingResponse,
  GetTeamMailboxSettingsResponse,
  GetTeamNameRulesResponse,
  UpdateTeamBrandingBody,
  UpdateTeamMailboxSettingsBody,
  UpdateTeamNameRulesBody,
} from "@workspace/api-zod";
import type { SettingsCapabilityId } from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import { chatSettingsTable, db, DEFAULT_TEAM_ID, teamNameRulesTable, teamsTable } from "@workspace/db";
import { getTeamMailboxSettings, forwardingAddress, saveTeamMailboxSettings } from "./maildrop";
import { teamFilter } from "./teams";
import { pushRealtimeHint } from "./realtime";
import type { SettingsAgentAdapter, SettingsAgentIdentity } from "./assistantSettingsAgent";

const SLOWMODE_OPTIONS = new Set([0, 5, 10, 30, 60]);

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Setting value must be an object.");
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("That setting contains fields the settings agent cannot change.");
  }
}

function normalizedTeamId(teamId: string): string {
  return teamId.trim() || DEFAULT_TEAM_ID;
}

function mailboxView(settings: Awaited<ReturnType<typeof getTeamMailboxSettings>>) {
  const parsed = GetTeamMailboxSettingsResponse.parse({
    ...settings,
    forwardingAddress: settings.mailbox ? forwardingAddress(settings.mailbox) : null,
    configured: settings.enabled && settings.apiKeyConfigured && settings.allowedSenders.length > 0,
  });
  return {
    enabled: parsed.enabled,
    apiKeyConfigured: parsed.apiKeyConfigured,
    allowedSenders: parsed.allowedSenders,
    forwardingAddress: parsed.forwardingAddress,
  };
}

function brandingView(value: unknown) {
  const parsed = GetTeamBrandingResponse.parse(value);
  return {
    primaryColor: parsed.primaryColor,
    hasLogo: parsed.logoPath !== null,
    hasBackground: parsed.backgroundPath !== null,
    backgroundOptions: parsed.backgroundPath === null
      ? null
      : { backgroundMode: parsed.backgroundMode, backgroundOverlay: parsed.backgroundOverlay },
  };
}

export function validateSettingsCapabilityValue(settingId: SettingsCapabilityId, value: unknown): unknown {
  const input = objectValue(value);
  switch (settingId) {
    case "team.chat.slowmode": {
      exactKeys(input, ["slowmodeSeconds"]);
      if (typeof input.slowmodeSeconds !== "number" || !SLOWMODE_OPTIONS.has(input.slowmodeSeconds)) {
        throw new Error("Choose a slow-mode interval shown in Settings.");
      }
      return GetChatSettingsResponse.parse({ slowmodeSeconds: input.slowmodeSeconds });
    }
    case "team.inbox": {
      exactKeys(input, ["enabled", "allowedSenders"]);
      const parsed = UpdateTeamMailboxSettingsBody.safeParse(input);
      if (!parsed.success || parsed.data.apiKey !== undefined || parsed.data.removeApiKey !== undefined) {
        throw new Error("Inbox changes through the settings agent cannot change or remove API keys.");
      }
      return { enabled: parsed.data.enabled, allowedSenders: parsed.data.allowedSenders };
    }
    case "team.nameRules": {
      exactKeys(input, ["rules"]);
      const parsed = UpdateTeamNameRulesBody.safeParse(input);
      if (!parsed.success || parsed.data.rules.some((rule) => !rule.text.trim())) {
        throw new Error("Enter up to 50 name rules, each with non-empty text up to 40 characters.");
      }
      return { rules: parsed.data.rules.map((rule) => ({ matchType: rule.matchType, text: rule.text.trim().replace(/\s+/g, " ") })) };
    }
    case "team.branding.primaryColor": {
      exactKeys(input, ["primaryColor"]);
      const parsed = UpdateTeamBrandingBody.safeParse({ primaryColor: input.primaryColor });
      if (!parsed.success) throw new Error("Choose a six-digit color or null to reset it.");
      return { primaryColor: parsed.data.primaryColor };
    }
    case "team.branding.backgroundOptions": {
      exactKeys(input, ["backgroundMode", "backgroundOverlay"]);
      const mode = input.backgroundMode;
      const overlay = input.backgroundOverlay;
      if ((mode !== "cover" && mode !== "tile") ||
          typeof overlay !== "number" || !Number.isInteger(overlay) || overlay < 0 || overlay > 80 || overlay % 5 !== 0) {
        throw new Error("Choose a supported background fit and overlay from 0 to 80 in steps of 5.");
      }
      return { backgroundMode: mode, backgroundOverlay: overlay };
    }
    default:
      throw new Error("Unsupported setting identifier.");
  }
}

async function readBranding(teamId: string) {
  const [team] = await db.select({
    logoPath: teamsTable.logoPath,
    primaryColor: teamsTable.primaryColor,
    backgroundPath: teamsTable.backgroundPath,
    backgroundMode: teamsTable.backgroundMode,
    backgroundOverlay: teamsTable.backgroundOverlay,
  }).from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) throw new Error("Team not found.");
  return brandingView(team);
}

export const settingsCapabilityOperations: SettingsAgentAdapter = {
  validate: validateSettingsCapabilityValue,
  async read(settingId, identity) {
    const teamId = normalizedTeamId(identity.teamId);
    switch (settingId) {
      case "team.chat.slowmode": {
        const [row] = await db.select({ slowmodeSeconds: chatSettingsTable.slowmodeSeconds })
          .from(chatSettingsTable).where(teamFilter(chatSettingsTable.teamId, teamId)).limit(1);
        return GetChatSettingsResponse.parse({ slowmodeSeconds: row?.slowmodeSeconds ?? 0 });
      }
      case "team.inbox":
        return mailboxView(await getTeamMailboxSettings(teamId));
      case "team.nameRules": {
        const [row] = await db.select({ rules: teamNameRulesTable.rules })
          .from(teamNameRulesTable).where(eq(teamNameRulesTable.teamId, teamId)).limit(1);
        return GetTeamNameRulesResponse.parse({ rules: row?.rules ?? [] });
      }
      case "team.branding.primaryColor":
      case "team.branding.backgroundOptions":
        return readBranding(teamId);
      default:
        throw new Error("Unsupported setting identifier.");
    }
  },
  async update(settingId, value, identity) {
    const teamId = normalizedTeamId(identity.teamId);
    const validated = validateSettingsCapabilityValue(settingId, value);
    switch (settingId) {
      case "team.chat.slowmode": {
        const seconds = (validated as { slowmodeSeconds: number }).slowmodeSeconds;
        const [existing] = await db.select({ id: chatSettingsTable.id }).from(chatSettingsTable)
          .where(teamFilter(chatSettingsTable.teamId, teamId)).limit(1);
        if (existing) {
          await db.update(chatSettingsTable).set({ slowmodeSeconds: seconds, updatedAt: new Date() })
            .where(and(eq(chatSettingsTable.id, existing.id), teamFilter(chatSettingsTable.teamId, teamId)));
        } else {
          await db.insert(chatSettingsTable).values({ id: randomUUID(), teamId, slowmodeSeconds: seconds }).onConflictDoNothing();
          const [created] = await db.select({ id: chatSettingsTable.id }).from(chatSettingsTable)
            .where(teamFilter(chatSettingsTable.teamId, teamId)).limit(1);
          if (created) {
            await db.update(chatSettingsTable).set({ slowmodeSeconds: seconds, updatedAt: new Date() })
              .where(and(eq(chatSettingsTable.id, created.id), teamFilter(chatSettingsTable.teamId, teamId)));
          }
        }
        pushRealtimeHint("chat_settings");
        return { slowmodeSeconds: seconds };
      }
      case "team.inbox": {
        const next = validated as { enabled: boolean; allowedSenders: string[] };
        return mailboxView(await saveTeamMailboxSettings(teamId, next.enabled, next.allowedSenders));
      }
      case "team.nameRules": {
        const next = validated as { rules: { matchType: "contains" | "startsWith" | "endsWith" | "exact"; text: string }[] };
        const [row] = await db.insert(teamNameRulesTable).values({ teamId, rules: next.rules })
          .onConflictDoUpdate({
            target: teamNameRulesTable.teamId,
            set: { rules: next.rules, updatedAt: new Date() },
          }).returning({ rules: teamNameRulesTable.rules });
        return GetTeamNameRulesResponse.parse({ rules: row?.rules ?? next.rules });
      }
      case "team.branding.primaryColor": {
        const next = validated as { primaryColor: string | null };
        const [team] = await db.update(teamsTable).set({ primaryColor: next.primaryColor })
          .where(eq(teamsTable.id, teamId)).returning({
            logoPath: teamsTable.logoPath,
            primaryColor: teamsTable.primaryColor,
            backgroundPath: teamsTable.backgroundPath,
            backgroundMode: teamsTable.backgroundMode,
            backgroundOverlay: teamsTable.backgroundOverlay,
          });
        if (!team) throw new Error("Team not found.");
        return brandingView(team);
      }
      case "team.branding.backgroundOptions": {
        const next = validated as { backgroundMode: "cover" | "tile"; backgroundOverlay: number };
        const [current] = await db.select({
          primaryColor: teamsTable.primaryColor,
          backgroundPath: teamsTable.backgroundPath,
        })
          .from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
        if (!current) throw new Error("Team not found.");
        if (!current.backgroundPath) throw new Error("Add a team background before changing its display options.");
        const parsed = UpdateTeamBrandingBody.parse({
          primaryColor: current.primaryColor,
          backgroundMode: next.backgroundMode,
          backgroundOverlay: next.backgroundOverlay,
        });
        const [team] = await db.update(teamsTable).set({
          backgroundMode: parsed.backgroundMode,
          backgroundOverlay: parsed.backgroundOverlay,
        }).where(eq(teamsTable.id, teamId)).returning({
          logoPath: teamsTable.logoPath,
          primaryColor: teamsTable.primaryColor,
          backgroundPath: teamsTable.backgroundPath,
          backgroundMode: teamsTable.backgroundMode,
          backgroundOverlay: teamsTable.backgroundOverlay,
        });
        if (!team) throw new Error("Team not found.");
        return brandingView(team);
      }
      default:
        throw new Error("Unsupported setting identifier.");
    }
  },
};
