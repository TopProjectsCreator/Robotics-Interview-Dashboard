/**
 * Shared catalog for team-level capabilities. Permission IDs are API-stable;
 * do not rename them without migrating saved role definitions.
 *
 * Only capabilities that are safe to delegate appear here. Account/role
 * administration, workspace visibility administration, and site-owner powers
 * remain separate Admin/system-owner checks and cannot be granted by a role.
 */
export const PERMISSION_CATEGORIES = [
  {
    id: "workspaces",
    label: "Workspaces",
    permissions: [
      { id: "interview.view", label: "Open Interview" },
      { id: "chat.view", label: "Open Chat" },
      { id: "parts.view", label: "Open Parts" },
      { id: "cad.view", label: "Open CAD" },
      { id: "code.view", label: "Open Code" },
    ],
  },
  {
    id: "interview",
    label: "Interview and applicants",
    permissions: [
      { id: "applicants.view", label: "View applicants" },
      { id: "applicants.search", label: "Search applicants with AI" },
      { id: "applicants.edit", label: "Edit applicant records" },
      { id: "applicants.manage", label: "Import, delete, or regenerate applicants" },
      { id: "queue.view", label: "View interview queue" },
      { id: "queue.manage", label: "Change queue order and settings" },
      { id: "attendance.view", label: "View attendance" },
      { id: "attendance.manage", label: "Manage attendance and seating" },
      { id: "display.view", label: "View display settings" },
      { id: "display.manage", label: "Manage announcements and display settings" },
      { id: "dashboard.view", label: "View dashboard and charts" },
      { id: "dashboard.manage", label: "Create and edit dashboard charts" },
      { id: "snapshots.view", label: "View data snapshots" },
      { id: "snapshots.manage", label: "Create and restore data snapshots" },
    ],
  },
  {
    id: "communication",
    label: "Chat and communication",
    permissions: [
      { id: "chat.send", label: "Send chat messages and reactions" },
      { id: "chat.moderate", label: "Edit, pin, or remove chat content" },
      { id: "chat.manage", label: "Manage channels, polls, and chat settings" },
      { id: "broadcasts.view", label: "View team broadcasts" },
      { id: "broadcasts.send", label: "Send team broadcasts" },
      { id: "broadcasts.manage", label: "Manage broadcast controls" },
      { id: "personal.notepad.read", label: "View personal notepad" },
      { id: "personal.notepad.write", label: "Edit personal notepad" },
    ],
  },
  {
    id: "tools",
    label: "Team tools",
    permissions: [
      { id: "assistant.view", label: "View assistant conversations and history" },
      { id: "assistant.use", label: "Use the AI assistant" },
      { id: "assistant.manage", label: "Manage assistant features and settings" },
      { id: "parts.edit", label: "Edit parts, stock, costs, and robot allocations" },
      { id: "parts.manage", label: "Manage parts catalog and supplier sync" },
      { id: "cad.edit", label: "Add and edit CAD files and folders" },
      { id: "cad.manage", label: "Delete and organize CAD library content" },
      { id: "code.edit", label: "Edit code projects and files" },
      { id: "code.manage", label: "Manage code projects, revisions, and deployment" },
      { id: "collaboration.view", label: "View shared boards, documents, and spreadsheets" },
      { id: "collaboration.edit", label: "Create and edit shared boards and documents" },
      { id: "collaboration.manage", label: "Manage shared calendar and collaboration settings" },
      { id: "customWorkspaces.view", label: "Open custom team workspaces" },
      { id: "customWorkspaces.manage", label: "Edit and publish custom workspaces" },
      { id: "customWorkspaces.access", label: "Manage custom workspace access" },
      { id: "customWorkspaces.data", label: "Read and change custom workspace data" },
    ],
  },
  {
    id: "team",
    label: "Team settings",
    permissions: [
      { id: "team.branding.manage", label: "Manage team branding" },
      { id: "team.mailbox.manage", label: "Manage the team inbox" },
      { id: "team.nameRules.manage", label: "Manage team name rules" },
      { id: "featureRequests.view", label: "View team app-adjustment requests" },
      { id: "featureRequests.create", label: "Submit app-adjustment requests" },
      { id: "events.view", label: "View team event information" },
      { id: "presence.view", label: "View team presence" },
      { id: "presence.heartbeat", label: "Appear as online while using the app" },
      { id: "presence.manage", label: "View presence details and end sessions" },
    ],
  },
] as const;

export type PermissionId = (typeof PERMISSION_CATEGORIES)[number]["permissions"][number]["id"];

export const PERMISSION_IDS: readonly PermissionId[] = PERMISSION_CATEGORIES.flatMap((category) =>
  category.permissions.map((permission) => permission.id),
);

const PERMISSION_ID_SET = new Set<string>(PERMISSION_IDS);
const PERMISSION_IMPLICATIONS: Partial<Record<PermissionId, readonly PermissionId[]>> = {
  "applicants.manage": ["applicants.view", "applicants.edit"],
  "applicants.edit": ["applicants.view"],
  "queue.manage": ["queue.view"],
  "attendance.manage": ["attendance.view"],
  "featureRequests.create": ["featureRequests.view"],
  "display.manage": ["display.view"],
  "dashboard.manage": ["dashboard.view"],
  "snapshots.manage": ["snapshots.view"],
  "chat.manage": ["chat.view"],
  "chat.send": ["chat.view"],
  "chat.moderate": ["chat.view"],
  "parts.manage": ["parts.view", "parts.edit"],
  "parts.edit": ["parts.view"],
  "cad.manage": ["cad.view", "cad.edit"],
  "cad.edit": ["cad.view"],
  "code.manage": ["code.view", "code.edit"],
  "code.edit": ["code.view"],
  "collaboration.manage": ["collaboration.view", "collaboration.edit"],
  "collaboration.edit": ["collaboration.view"],
  "customWorkspaces.manage": ["customWorkspaces.view"],
  "customWorkspaces.access": ["customWorkspaces.view"],
  "assistant.manage": ["assistant.view", "assistant.use"],
  "assistant.use": ["assistant.view"],
  "broadcasts.manage": ["broadcasts.view", "broadcasts.send"],
  "broadcasts.send": ["broadcasts.view"],
  "personal.notepad.write": ["personal.notepad.read"],
};

export function isPermissionId(value: unknown): value is PermissionId {
  return typeof value === "string" && PERMISSION_ID_SET.has(value);
}

/** Unknown or malformed entries never become capabilities. */
export function normalizePermissions(value: unknown): PermissionId[] {
  if (!Array.isArray(value)) return [];
  const selected = new Set(value.filter(isPermissionId));
  return PERMISSION_IDS.filter((permission) => selected.has(permission));
}

export function hasPermission(
  permissions: readonly string[] | null | undefined,
  permission: PermissionId | string,
): boolean {
  if (!isPermissionId(permission) || !Array.isArray(permissions)) return false;
  if (permissions.includes(permission)) return true;
  return permissions.some((candidate) => isPermissionId(candidate) &&
    PERMISSION_IMPLICATIONS[candidate]?.includes(permission));
}

export const BUILT_IN_PERMISSIONS: Record<"coordinator" | "admin" | "treasurer" | "interviewer", PermissionId[]> = {
  coordinator: [...PERMISSION_IDS],
  admin: [...PERMISSION_IDS],
  treasurer: [
    "chat.view", "chat.send", "chat.moderate", "parts.view", "parts.edit", "applicants.view",
    "dashboard.view", "collaboration.edit", "customWorkspaces.view", "assistant.view", "assistant.use", "broadcasts.view",
    "personal.notepad.read", "personal.notepad.write", "featureRequests.view", "featureRequests.create", "events.view",
    "presence.view", "presence.heartbeat",
  ],
  interviewer: [
    "chat.view", "chat.send", "chat.moderate", "parts.view", "parts.edit",
    "collaboration.edit", "customWorkspaces.view", "assistant.view", "assistant.use",
    "dashboard.view", "broadcasts.view", "personal.notepad.read", "personal.notepad.write",
    "featureRequests.view", "featureRequests.create", "events.view", "presence.view", "presence.heartbeat",
  ],
};

export function permissionsForBuiltInRole(role: string | null | undefined): PermissionId[] {
  if (role === "coordinator" || role === "admin") return [...BUILT_IN_PERMISSIONS[role]];
  if (role === "treasurer") return [...BUILT_IN_PERMISSIONS.treasurer];
  if (role === "interviewer") return [...BUILT_IN_PERMISSIONS.interviewer];
  return [];
}
