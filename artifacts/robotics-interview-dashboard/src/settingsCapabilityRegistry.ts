import {
  GetChatSettingsResponse,
  GetTeamBrandingResponse,
  GetTeamMailboxSettingsResponse,
  GetTeamNameRulesResponse,
  UpdateTeamBrandingBody,
  UpdateTeamMailboxSettingsBody,
  UpdateTeamNameRulesBody,
  hasPermission,
  permissionsForBuiltInRole,
} from "@workspace/api-zod";
import type { AuthSession } from "@workspace/api-client-react";
import { getStoredAuthToken } from "./authSession";
import type { WorkspaceSettings } from "./workspaceSettings";

export type SettingsCapabilityId =
  | "profile.displayName"
  | "profile.initials"
  | "appearance.theme"
  | "appearance.density"
  | "appearance.showPhotos"
  | "appearance.reduceMotion"
  | "applicants.defaultSort"
  | "live.autoRefresh"
  | "live.realtime"
  | "live.refreshMs"
  | "team.chat.slowmode"
  | "team.inbox"
  | "team.nameRules"
  | "team.branding.primaryColor"
  | "team.branding.backgroundOptions";

export type SettingsCapability = {
  id: SettingsCapabilityId;
  scope: "browser-local" | "signed-in-team";
  readOperation: string;
  updateOperation: string;
  requiredPermission?: string;
};

const LOCAL_CAPABILITIES: SettingsCapability[] = [
  { id: "profile.displayName", scope: "browser-local", readOperation: "readLocalDisplayName", updateOperation: "updateLocalDisplayName" },
  { id: "profile.initials", scope: "browser-local", readOperation: "readLocalInitials", updateOperation: "updateLocalInitials" },
  { id: "appearance.theme", scope: "browser-local", readOperation: "readBrowserTheme", updateOperation: "updateBrowserTheme" },
  { id: "appearance.density", scope: "browser-local", readOperation: "readLocalDensity", updateOperation: "updateLocalDensity" },
  { id: "appearance.showPhotos", scope: "browser-local", readOperation: "readLocalShowPhotos", updateOperation: "updateLocalShowPhotos" },
  { id: "appearance.reduceMotion", scope: "browser-local", readOperation: "readLocalReduceMotion", updateOperation: "updateLocalReduceMotion" },
  { id: "applicants.defaultSort", scope: "browser-local", readOperation: "readLocalDefaultSort", updateOperation: "updateLocalDefaultSort" },
  { id: "live.autoRefresh", scope: "browser-local", readOperation: "readLocalAutoRefresh", updateOperation: "updateLocalAutoRefresh" },
  { id: "live.realtime", scope: "browser-local", readOperation: "readLocalRealtime", updateOperation: "updateLocalRealtime" },
  { id: "live.refreshMs", scope: "browser-local", readOperation: "readLocalRefreshInterval", updateOperation: "updateLocalRefreshInterval" },
];

const TEAM_CAPABILITIES: SettingsCapability[] = [
  { id: "team.chat.slowmode", scope: "signed-in-team", readOperation: "GET /api/chat/settings", updateOperation: "POST /api/chat/settings", requiredPermission: "chat.manage" },
  { id: "team.inbox", scope: "signed-in-team", readOperation: "GET /api/system/mailbox", updateOperation: "PUT /api/system/mailbox", requiredPermission: "team.mailbox.manage" },
  { id: "team.nameRules", scope: "signed-in-team", readOperation: "GET /api/auth/name-rules", updateOperation: "PUT /api/auth/name-rules", requiredPermission: "team.nameRules.manage" },
  { id: "team.branding.primaryColor", scope: "signed-in-team", readOperation: "GET /api/auth/team-branding", updateOperation: "PATCH /api/auth/team-branding", requiredPermission: "team.branding.manage" },
  { id: "team.branding.backgroundOptions", scope: "signed-in-team", readOperation: "GET /api/auth/team-branding", updateOperation: "PATCH /api/auth/team-branding", requiredPermission: "team.branding.manage" },
];

const CAPABILITIES = new Map<SettingsCapabilityId, SettingsCapability>(
  [...LOCAL_CAPABILITIES, ...TEAM_CAPABILITIES].map((capability) => [capability.id, capability]),
);
const SORT_OPTIONS = new Set(["rank", "queue", "score", "name", "grade", "skill", "gender", "newest", "oldest"]);
const REFRESH_INTERVALS = new Set([3000, 10000, 30000]);
const SLOWMODE_OPTIONS = new Set([0, 5, 10, 30, 60]);

export interface SettingsCapabilityContext {
  session: AuthSession | null | undefined;
  local: {
    settings: WorkspaceSettings;
    theme: string | undefined;
    updateSettings: (patch: Partial<WorkspaceSettings>) => void;
    setTheme: (theme: string) => void;
  };
  fetcher?: typeof fetch;
}

function sessionPermissions(session: AuthSession): readonly string[] {
  if (session.customRoleId) return session.permissions ?? [];
  return session.permissions ?? permissionsForBuiltInRole(session.role);
}

function capabilityVisible(capability: SettingsCapability, session: AuthSession | null | undefined): boolean {
  if (session?.authenticated !== true) return false;
  if (!capability.requiredPermission) return true;
  return hasPermission(sessionPermissions(session), capability.requiredPermission);
}

/** Returns only capabilities the signed-in person can see in Settings. */
export function listSettingsCapabilities(session: AuthSession | null | undefined): SettingsCapability[] {
  return [...LOCAL_CAPABILITIES, ...TEAM_CAPABILITIES]
    .filter((capability) => capabilityVisible(capability, session))
    .map((capability) => ({ ...capability }));
}

function getVisibleCapability(id: string, context: SettingsCapabilityContext): SettingsCapability {
  const capability = CAPABILITIES.get(id as SettingsCapabilityId);
  // Use the same result for unknown and hidden IDs so callers cannot probe
  // the catalog by guessing identifiers.
  if (!capability || !capabilityVisible(capability, context.session)) {
    throw new Error("Unsupported setting identifier.");
  }
  return capability;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Setting value must be an object.");
  return value as Record<string, unknown>;
}

function validateLocalValue(id: SettingsCapabilityId, value: unknown): unknown {
  switch (id) {
    case "profile.displayName":
      if (typeof value !== "string" || value.length > 120) throw new Error("Display name must be text up to 120 characters.");
      return value;
    case "profile.initials":
      if (typeof value !== "string" || value.length > 2 || !/^[a-zA-Z]*$/.test(value)) throw new Error("Avatar initials must contain up to two letters.");
      return value.toUpperCase();
    case "appearance.theme":
      if (value !== "light" && value !== "dark") throw new Error("Theme must be light or dark.");
      return value;
    case "appearance.density":
      if (value !== "comfortable" && value !== "compact") throw new Error("Density must be comfortable or compact.");
      return value;
    case "appearance.showPhotos":
    case "appearance.reduceMotion":
    case "live.autoRefresh":
    case "live.realtime":
      if (typeof value !== "boolean") throw new Error("Setting value must be true or false.");
      return value;
    case "applicants.defaultSort":
      if (typeof value !== "string" || !SORT_OPTIONS.has(value)) throw new Error("Choose a supported applicant sort.");
      return value;
    case "live.refreshMs":
      if (typeof value !== "number" || !REFRESH_INTERVALS.has(value)) throw new Error("Choose a supported refresh interval.");
      return value;
    default:
      return undefined;
  }
}

function localValue(id: SettingsCapabilityId, context: SettingsCapabilityContext): unknown {
  switch (id) {
    case "profile.displayName": return context.local.settings.displayName;
    case "profile.initials": return context.local.settings.initials;
    case "appearance.theme": return context.local.theme === "dark" ? "dark" : "light";
    case "appearance.density": return context.local.settings.density;
    case "appearance.showPhotos": return context.local.settings.showPhotos;
    case "appearance.reduceMotion": return context.local.settings.reduceMotion;
    case "applicants.defaultSort": return context.local.settings.defaultSort;
    case "live.autoRefresh": return context.local.settings.autoRefresh;
    case "live.realtime": return context.local.settings.realtime;
    case "live.refreshMs": return context.local.settings.refreshMs;
    default: return undefined;
  }
}

function applyLocalValue(id: SettingsCapabilityId, value: unknown, context: SettingsCapabilityContext): unknown {
  const validated = validateLocalValue(id, value);
  if (id === "appearance.theme") {
    context.local.setTheme(validated as string);
    return validated;
  }
  const fieldById: Partial<Record<SettingsCapabilityId, keyof WorkspaceSettings>> = {
    "profile.displayName": "displayName",
    "profile.initials": "initials",
    "appearance.density": "density",
    "appearance.showPhotos": "showPhotos",
    "appearance.reduceMotion": "reduceMotion",
    "applicants.defaultSort": "defaultSort",
    "live.autoRefresh": "autoRefresh",
    "live.realtime": "realtime",
    "live.refreshMs": "refreshMs",
  };
  const field = fieldById[id];
  if (!field) throw new Error("Unsupported setting identifier.");
  context.local.updateSettings({ [field]: validated } as Partial<WorkspaceSettings>);
  return validated;
}

function apiUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}api/${path.replace(/^\/+/, "")}`;
}

async function apiRequest(path: string, context: SettingsCapabilityContext, init?: RequestInit): Promise<unknown> {
  const fetcher = context.fetcher ?? fetch;
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getStoredAuthToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetcher(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) throw new Error("The setting could not be read or saved.");
  return body;
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

function safeMailboxView(value: unknown) {
  const parsed = GetTeamMailboxSettingsResponse.parse(value);
  // Never return the team identifier or any unexpected secret-like fields.
  return {
    enabled: parsed.enabled,
    apiKeyConfigured: parsed.apiKeyConfigured,
    allowedSenders: parsed.allowedSenders,
    forwardingAddress: parsed.forwardingAddress,
  };
}

function safeBrandingView(value: unknown) {
  const parsed = GetTeamBrandingResponse.parse(value);
  // Object-storage paths are private implementation details; the human UI
  // only needs the configured state and non-secret visual options.
  return {
    primaryColor: parsed.primaryColor,
    hasLogo: parsed.logoPath !== null,
    hasBackground: parsed.backgroundPath !== null,
    backgroundOptions: parsed.backgroundPath === null
      ? null
      : { backgroundMode: parsed.backgroundMode, backgroundOverlay: parsed.backgroundOverlay },
  };
}

/** Read one known setting through its browser-local or existing team API adapter. */
export async function readSettingsCapability(id: string, context: SettingsCapabilityContext): Promise<unknown> {
  const capability = getVisibleCapability(id, context);
  switch (capability.id) {
    case "team.chat.slowmode": {
      return GetChatSettingsResponse.parse(await apiRequest("chat/settings", context));
    }
    case "team.inbox":
      return safeMailboxView(await apiRequest("system/mailbox", context));
    case "team.nameRules": {
      const value = GetTeamNameRulesResponse.parse(await apiRequest("auth/name-rules", context));
      return { rules: value.rules };
    }
    case "team.branding.primaryColor":
    case "team.branding.backgroundOptions":
      return safeBrandingView(await apiRequest("auth/team-branding", context));
    default:
      return localValue(capability.id, context);
  }
}

/** Update a known setting using only its narrow adapter and existing server validation. */
export async function updateSettingsCapability(id: string, input: unknown, context: SettingsCapabilityContext): Promise<unknown> {
  const capability = getVisibleCapability(id, context);
  if (capability.scope === "browser-local") return applyLocalValue(capability.id, input, context);

  switch (capability.id) {
    case "team.chat.slowmode": {
      const seconds = requireObject(input).slowmodeSeconds;
      if (typeof seconds !== "number" || !SLOWMODE_OPTIONS.has(seconds)) {
        throw new Error("Choose a slow-mode interval shown in Settings.");
      }
      const saved = requireObject(await apiRequest("chat/settings", context, jsonRequest("POST", { slowmodeSeconds: seconds })));
      return GetChatSettingsResponse.parse(saved);
    }
    case "team.inbox": {
      const parsed = UpdateTeamMailboxSettingsBody.safeParse(input);
      if (!parsed.success || parsed.data.removeApiKey === true ||
          (parsed.data.apiKey !== undefined && !parsed.data.apiKey.trim())) {
        throw new Error("Enter valid inbox settings. A saved key can only be replaced with a new key.");
      }
      return safeMailboxView(await apiRequest("system/mailbox", context, jsonRequest("PUT", {
        enabled: parsed.data.enabled,
        allowedSenders: parsed.data.allowedSenders,
        ...(parsed.data.apiKey === undefined ? {} : { apiKey: parsed.data.apiKey.trim() }),
      })));
    }
    case "team.nameRules": {
      const parsed = UpdateTeamNameRulesBody.safeParse(input);
      if (!parsed.success || parsed.data.rules.some((rule) => !rule.text.trim())) {
        throw new Error("Enter up to 50 name rules, each with non-empty text up to 40 characters.");
      }
      const saved = GetTeamNameRulesResponse.parse(await apiRequest("auth/name-rules", context, jsonRequest("PUT", parsed.data)));
      return { rules: saved.rules };
    }
    case "team.branding.primaryColor": {
      const parsed = UpdateTeamBrandingBody.safeParse({ primaryColor: requireObject(input).primaryColor });
      if (!parsed.success) throw new Error("Choose a six-digit color or null to reset it.");
      return safeBrandingView(await apiRequest("auth/team-branding", context, jsonRequest("PATCH", parsed.data)));
    }
    case "team.branding.backgroundOptions": {
      const inputObject = requireObject(input);
      const mode = inputObject.backgroundMode;
      const overlay = inputObject.backgroundOverlay;
      if ((mode !== "cover" && mode !== "tile") ||
          typeof overlay !== "number" || !Number.isInteger(overlay) || overlay < 0 || overlay > 80 || overlay % 5 !== 0) {
        throw new Error("Choose a supported background fit and overlay from 0 to 80 in steps of 5.");
      }
      const current = GetTeamBrandingResponse.parse(await apiRequest("auth/team-branding", context));
      const body = UpdateTeamBrandingBody.parse({
        primaryColor: current.primaryColor,
        backgroundMode: mode,
        backgroundOverlay: overlay,
      });
      return safeBrandingView(await apiRequest("auth/team-branding", context, jsonRequest("PATCH", body)));
    }
    default:
      throw new Error("Unsupported setting identifier.");
  }
}
