import { hasPermission, type PermissionId } from "@workspace/api-zod";
import { userCanSeeWorkspace, type WorkspaceKey, type WorkspaceVisibility } from "./workspaceVisibility.ts";

/**
 * Central route-to-capability inventory for custom roles. Exact subroute checks
 * come before broader workspace rules so writes and management actions cannot
 * inherit read access accidentally. Unmatched signed-in custom-role requests
 * are denied by the caller.
 */
export function permissionForRoute(method: string, rawPath: string): PermissionId | null {
  const path = rawPath.split("?", 1)[0].replace(/^\/api(?=\/|$)/, "") || "/";
  const verb = method.toUpperCase();
  const read = verb === "GET" || verb === "HEAD";

  if (path === "/auth/session" || path === "/auth/logout") return null;
  if (/^\/auth\/(?:login|verify-event-passcode|interviewers\/setup|interviewers\/?$|passkey\/(?:login|login\/options))/.test(path)) return null;
  if (/^\/auth\/(?:passkey\/(?:register|list)|personal-notepad)/.test(path)) {
    return path.includes("personal-notepad")
      ? (read ? "personal.notepad.read" : "personal.notepad.write")
      : "personal.notepad.read";
  }
  if (/^\/auth\/(?:roles|interviewers\/[^/]+\/custom-role|interviewers\/[^/]+\/role|interviewers\/[^/]+\/password|interviewers\/passwords|interviewers\/[^/]+$|teams\/)/.test(path)) return null;
  if (path.startsWith("/auth/name-rules")) return "team.nameRules.manage";
  if (path.startsWith("/auth/team-branding")) return "team.branding.manage";

  if (path === "/system/usage") return null;
  if (path.startsWith("/system/mailbox")) return "team.mailbox.manage";
  if (path === "/workspaces/visibility") return null;
  if (path === "/diagnostics") return null;

  if (path.startsWith("/applicants/search/ai")) return "applicants.search";
  if (path === "/applicants" || path.startsWith("/applicants/")) {
    if (/\/(?:imports|import-history)(?:\/|$)/.test(path)) return "applicants.manage";
    if (/\/regenerate(?:\/|$)/.test(path)) return "applicants.manage";
    if (verb === "PATCH") return "applicants.edit";
    if (verb === "DELETE" || verb === "POST") return "applicants.manage";
    return "applicants.view";
  }

  if (path.startsWith("/dashboard/summary")) return "dashboard.view";
  if (path === "/dashboard/workspace-usage") return "dashboard.view";
  if (path.startsWith("/dashboard/charts")) return read ? "dashboard.view" : "dashboard.manage";
  if (path.startsWith("/snapshots")) return read ? "snapshots.view" : "snapshots.manage";

  if (path.startsWith("/queue/chat")) {
    if (/\/(?:channels|settings|scheduled|custom-emojis)(?:\/|$)/.test(path)) {
      return read ? "chat.view" : "chat.manage";
    }
    if (/\/pin(?:\/|$)/.test(path)) return "chat.moderate";
    if (/\/poll(?:\/vote)?(?:\/|$)/.test(path)) return "chat.send";
    if (verb === "PATCH" || verb === "DELETE") return "chat.moderate";
    if (verb === "POST") return "chat.send";
    return "chat.view";
  }
  if (path.startsWith("/queue/custom-emojis")) return read ? "chat.view" : "chat.manage";
  if (path.startsWith("/queue")) {
    if (path.startsWith("/queue/labels") || path.startsWith("/queue/settings")) return read ? "queue.view" : "queue.manage";
    return read ? "queue.view" : "queue.manage";
  }

  if (path === "/presence/heartbeat") return "presence.heartbeat";
  if (path === "/presence/kick" || path === "/presence/stats") return "presence.manage";
  if (path === "/presence") return "presence.view";
  if (path.startsWith("/attendance")) {
    return read ? "attendance.view" : "attendance.manage";
  }
  if (path.startsWith("/display")) return read ? "display.view" : "display.manage";
  if (path.startsWith("/seating")) return read ? "attendance.view" : "attendance.manage";
  if (path.startsWith("/broadcasts")) {
    if (path.endsWith("/ack")) return "broadcasts.view";
    return read ? "broadcasts.view" : "broadcasts.send";
  }

  if (path.startsWith("/parts")) {
    if (path.includes("/vendors") || path.includes("/catalog/sync") || path.includes("/catalog/import")) {
      return read ? "parts.view" : "parts.manage";
    }
    if (path === "/parts/catalog" && !read) return "parts.manage";
    if (/\/catalog\/[^/]+\/details(?:\/|$)/.test(path) && !read) return "parts.manage";
    if (/\/(?:robots|catalog\/[^/]+\/details)(?:\/|$)/.test(path) && (verb === "DELETE" || verb === "POST")) return "parts.manage";
    return read ? "parts.view" : "parts.edit";
  }
  if (path.startsWith("/cad")) {
    if (path.startsWith("/cad/library") || path.startsWith("/cad/models") && read) return "cad.view";
    return verb === "DELETE" ? "cad.manage" : read ? "cad.view" : "cad.edit";
  }
  if (path.startsWith("/code")) {
    if (/\/(?:deploy|revisions)(?:\/|$)/.test(path) && !read) return "code.manage";
    if (verb === "DELETE") return "code.manage";
    return read ? "code.view" : "code.edit";
  }
  if (path.startsWith("/custom-workspaces")) {
    if (/\/(?:data|llm)(?:\/|$)/.test(path)) return "customWorkspaces.data";
    if (path.endsWith("/access") || path.includes("/team-members")) return "customWorkspaces.access";
    if (path.endsWith("/publish") || path.endsWith("/restore")) return "customWorkspaces.manage";
    if (read) return "customWorkspaces.view";
    return "customWorkspaces.manage";
  }
  if (path.startsWith("/storage")) {
    if (/\/cad|cad-models/.test(path)) return read ? "cad.view" : "cad.edit";
    if (/\/parts|robot-preview/.test(path)) return read ? "parts.view" : "parts.edit";
    if (/\/(?:chat|uploads|objects)/.test(path)) return read ? "chat.view" : "chat.send";
    return null;
  }

  if (path.startsWith("/assistant/providers") || path.startsWith("/assistant/provider-config") ||
      path.startsWith("/assistant/model-policy")) return read ? "assistant.view" : "assistant.manage";
  if (path.startsWith("/assistant/custom-mcp") || path.startsWith("/onshape-mcp")) return "assistant.manage";
  if (path.startsWith("/assistant/models") || path.startsWith("/assistant/tools") ||
      path.startsWith("/assistant/config")) return read ? "assistant.view" : "assistant.manage";
  if (path.startsWith("/assistant/skills")) return read ? "assistant.view" : "assistant.manage";
  if (path.startsWith("/assistant/conversations/") && path.includes("/share")) return "assistant.manage";
  if (path.startsWith("/assistant/custom-workspace-builder")) return "customWorkspaces.manage";
  if (path.startsWith("/assistant/questions")) return "assistant.manage";
  if (path.startsWith("/assistant/history")) return read ? "assistant.view" : "assistant.manage";
  if (path.startsWith("/assistant/scheduled-tasks")) return read ? "assistant.view" : "assistant.use";
  if (path.startsWith("/assistant")) {
    if (/\/(?:ask|images)(?:\/|$)/.test(path)) return "assistant.use";
    return read ? "assistant.view" : "assistant.use";
  }
  if (path.startsWith("/whiteboards") || path.startsWith("/boards") ||
      path.startsWith("/spreadsheets") || path.startsWith("/calendars")) {
    if (path.startsWith("/calendars") && !read) return "collaboration.manage";
    return read ? "collaboration.view" : "collaboration.edit";
  }
  if (path.startsWith("/feature-requests")) {
    if (path === "/feature-requests" && verb === "POST") return "featureRequests.create";
    return read ? "featureRequests.view" : "featureRequests.create";
  }
  if (path.startsWith("/events")) return "events.view";

  return null;
}

export function permissionIsGranted(
  permissions: readonly string[],
  permission: PermissionId | null,
): boolean {
  return permission !== null && hasPermission(permissions, permission);
}

/**
 * Read-level (plus CAD/Code editing) permissions a Settings → Workspace
 * access grant implies for that workspace. The matrix is an explicit
 * per-person grant from an admin, so a granted treasurer or team member must
 * be able to use the workspace — otherwise the toggle in Settings does
 * nothing. Administration permissions (*.manage, imports, deletes) are
 * deliberately absent: those stay gated by the account's (custom) role.
 */
const WORKSPACE_PERMISSION_FALLBACK: Partial<Record<PermissionId, WorkspaceKey>> = {
  "interview.view": "interview",
  "applicants.view": "interview",
  "applicants.search": "interview",
  "queue.view": "interview",
  "attendance.view": "interview",
  "display.view": "interview",
  "dashboard.view": "interview",
  "chat.view": "chat",
  "chat.send": "chat",
  "chat.moderate": "chat",
  "parts.view": "parts",
  "parts.edit": "parts",
  "cad.view": "cad",
  "cad.edit": "cad",
  "code.view": "code",
  "code.edit": "code",
};

/**
 * Workspace whose access grant is enough for this request, "any" when any
 * granted workspace is enough, or null when the fallback does not apply.
 * Only single-permission routes qualify (the compound rules of
 * routePermissionIsGranted keep their usual meaning). Callers check the
 * caller's visibility grant for the returned workspace.
 */
export function workspaceVisibilityFallback(method: string, rawPath: string): WorkspaceKey | "any" | null {
  const path = rawPath.split("?", 1)[0].replace(/^\/api(?=\/|$)/, "") || "/";
  const verb = method.toUpperCase();
  const read = verb === "GET" || verb === "HEAD";
  // The shell cannot render at all without reading the matrix, even for a
  // custom role with no view permissions of its own.
  if (read && path === "/workspaces/visibility") return "any";
  const permission = permissionForRoute(method, rawPath);
  return permission ? WORKSPACE_PERMISSION_FALLBACK[permission] ?? null : null;
}

/**
 * Every read-level permission implied by the given visibility grant. Used to
 * augment effective permissions so custom-role capability checks agree with
 * the HTTP fallback.
 */
export function workspaceGrantedPermissions(
  visibility: WorkspaceVisibility,
  userId: string | undefined | null,
  role: string | undefined | null,
): PermissionId[] {
  const granted = new Set<PermissionId>();
  for (const [permission, workspace] of Object.entries(WORKSPACE_PERMISSION_FALLBACK) as [PermissionId, WorkspaceKey][]) {
    if (userCanSeeWorkspace(visibility, userId, role, workspace)) granted.add(permission);
  }
  return [...granted];
}

export function routePermissionIsGranted(permissions: readonly string[], method: string, rawPath: string, body?: unknown): boolean {
  const path = rawPath.split("?", 1)[0].replace(/^\/api(?=\/|$)/, "") || "/";
  const verb = method.toUpperCase();
  if (path === "/workspaces/visibility" && (verb === "GET" || verb === "HEAD")) {
    return ["interview.view", "chat.view", "parts.view", "cad.view", "code.view", "customWorkspaces.view"]
      .some((permission) => hasPermission(permissions, permission));
  }
  if (/^\/storage\/uploads(?:\/|$)/.test(path)) {
    const candidates: PermissionId[] = verb === "GET" || verb === "HEAD"
      ? ["chat.view", "applicants.manage", "parts.view", "cad.view"]
      : ["chat.send", "applicants.manage", "parts.edit", "cad.edit"];
    return candidates.some((permission) => hasPermission(permissions, permission));
  }
  if (verb === "PATCH" && /^\/applicants\/[^/]+$/.test(path)) {
    const fields = body && typeof body === "object" && !Array.isArray(body)
      ? Object.keys(body)
      : [];
    const required: PermissionId[] = [];
    if (fields.some((field) => ["attendance", "lateArrivalTime", "makeupDate", "attendanceExcused"].includes(field))) {
      required.push("attendance.manage");
    }
    if (fields.some((field) => ["category", "interviewStatus", "queuePosition", "callbackRequested"].includes(field))) {
      required.push("queue.manage");
    }
    if (fields.some((field) => ![
      "attendance", "lateArrivalTime", "makeupDate", "attendanceExcused",
      "category", "interviewStatus", "queuePosition", "callbackRequested",
    ].includes(field))) {
      required.push("applicants.edit");
    }
    return required.length > 0 && required.every((permission) => hasPermission(permissions, permission));
  }
  if (/^\/storage\/objects\//.test(path)) {
    const candidates: PermissionId[] = verb === "GET" || verb === "HEAD"
      ? ["chat.view", "applicants.view", "parts.view", "cad.view", "customWorkspaces.view"]
      : ["chat.send", "applicants.edit", "parts.edit", "cad.edit", "customWorkspaces.manage"];
    return candidates.some((permission) => hasPermission(permissions, permission));
  }
  if (verb === "GET" && /^\/assistant\/public-shares\/[^/]+$/.test(path)) return true;
  return permissionIsGranted(permissions, permissionForRoute(method, rawPath));
}

/** Public and self-service endpoints never gain administrative authority. */
export function isUnauthenticatedOrSelfServiceRoute(method: string, rawPath: string): boolean {
  const path = rawPath.split("?", 1)[0].replace(/^\/api(?=\/|$)/, "") || "/";
  const verb = method.toUpperCase();
  return path === "/healthz" || path === "/display/state" || path === "/display/announcement" ||
    path === "/auth/session" || path === "/auth/logout" ||
    path === "/auth/login" || path === "/auth/verify-event-passcode" ||
    path === "/auth/interviewers" && (verb === "GET" || verb === "POST") ||
    path === "/auth/interviewers/setup" ||
    path === "/auth/teams" && verb === "POST" ||
    path === "/auth/teams/random-code" && verb === "GET" ||
    /^\/auth\/passkey\/(?:login|login\/options|register|register\/options|list|[^/]+)$/.test(path);
}
