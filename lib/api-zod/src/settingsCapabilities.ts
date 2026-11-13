import { hasPermission } from "./permissions";

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

export const SETTINGS_CAPABILITIES: readonly SettingsCapability[] = [
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
  { id: "team.chat.slowmode", scope: "signed-in-team", readOperation: "GET /api/chat/settings", updateOperation: "POST /api/chat/settings", requiredPermission: "chat.manage" },
  { id: "team.inbox", scope: "signed-in-team", readOperation: "GET /api/system/mailbox", updateOperation: "PUT /api/system/mailbox", requiredPermission: "team.mailbox.manage" },
  { id: "team.nameRules", scope: "signed-in-team", readOperation: "GET /api/auth/name-rules", updateOperation: "PUT /api/auth/name-rules", requiredPermission: "team.nameRules.manage" },
  { id: "team.branding.primaryColor", scope: "signed-in-team", readOperation: "GET /api/auth/team-branding", updateOperation: "PATCH /api/auth/team-branding", requiredPermission: "team.branding.manage" },
  { id: "team.branding.backgroundOptions", scope: "signed-in-team", readOperation: "GET /api/auth/team-branding", updateOperation: "PATCH /api/auth/team-branding", requiredPermission: "team.branding.manage" },
];

export function settingsCapabilitiesForPermissions(permissions: readonly string[], authenticated: boolean): SettingsCapability[] {
  if (!authenticated) return [];
  return SETTINGS_CAPABILITIES
    .filter((capability) => !capability.requiredPermission || hasPermission(permissions, capability.requiredPermission))
    .map((capability) => ({ ...capability }));
}
