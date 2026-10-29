export type WorkspaceArea = "overview" | "interview" | "chat" | "parts" | "cad" | "code";
export type WorkspaceKey = Exclude<WorkspaceArea, "overview">;
export type WorkspaceNavIcon =
  | "interview"
  | "chat"
  | "applicants"
  | "queue"
  | "attendance"
  | "bigScreen"
  | "assistant"
  | "parts"
  | "cad"
  | "code";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  iconKey: WorkspaceNavIcon;
  kind: "workspace" | "section";
  /** Which workspace grants access to this link. */
  workspace: WorkspaceKey;
};

/**
 * Workspace links in sidebar order. Access is not encoded here: it comes from the
 * admin-configured visibility settings so opening a workspace up to another role
 * is a settings change rather than a code change.
 */
const WORKSPACE_LINKS: WorkspaceNavItem[] = [
  { href: "/interview", label: "Interview", iconKey: "interview", kind: "workspace", workspace: "interview" },
  { href: "/chat", label: "Chat", iconKey: "chat", kind: "workspace", workspace: "chat" },
  { href: "/parts", label: "Parts", iconKey: "parts", kind: "workspace", workspace: "parts" },
  { href: "/cad", label: "CAD", iconKey: "cad", kind: "workspace", workspace: "cad" },
  { href: "/code", label: "Code", iconKey: "code", kind: "workspace", workspace: "code" },
];

const INTERVIEW_LINKS: WorkspaceNavItem[] = [
  { href: "/applicants", label: "Applicants", iconKey: "applicants", kind: "section", workspace: "interview" },
  { href: "/queue", label: "Interview queue", iconKey: "queue", kind: "section", workspace: "interview" },
  { href: "/attendance", label: "Attendance", iconKey: "attendance", kind: "section", workspace: "interview" },
  { href: "/big-screen", label: "Big screen", iconKey: "bigScreen", kind: "section", workspace: "interview" },
  { href: "/interview/assistant", label: "AI assistant", iconKey: "assistant", kind: "section", workspace: "interview" },
];

const CHAT_LINKS: WorkspaceNavItem[] = [
  { href: "/assistant", label: "AI assistant", iconKey: "assistant", kind: "section", workspace: "chat" },
];

const PARTS_LINKS: WorkspaceNavItem[] = [
  { href: "/parts/assistant", label: "Parts assistant", iconKey: "assistant", kind: "section", workspace: "parts" },
];

/** Sections that live inside a workspace but are shared with other areas. */
const SECTION_LINKS: WorkspaceNavItem[] = [
  { href: "/applicants", label: "Applicants", iconKey: "applicants", kind: "section", workspace: "interview" },
];

export function workspaceAreaForPath(location: string): WorkspaceArea {
  const path = location.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";

  if (path === "/dashboard") return "overview";
  if (path === "/cad" || path.startsWith("/cad/")) return "cad";
  if (path === "/code" || path.startsWith("/code/")) return "code";
  if (path === "/custom-workspaces" || path.startsWith("/custom-workspaces/")) return "overview";
  if (path === "/parts" || path.startsWith("/parts/")) return "parts";
  if (
    path === "/chat" ||
    path.startsWith("/chat/") ||
    path === "/assistant" ||
    path.startsWith("/assistant/") ||
    path.startsWith("/spreadsheets/")
  ) {
    return "chat";
  }

  return "interview";
}

export function getWorkspaceLinks(): WorkspaceNavItem[] {
  return WORKSPACE_LINKS;
}

/**
 * Nav for a workspace area. Workspaces the viewer cannot open are dropped, and
 * a section is only offered when its own workspace is visible, so hiding a
 * workspace hides everything that depends on it.
 */
export function getWorkspaceNavigation(
  area: WorkspaceArea,
  visible?: ReadonlySet<WorkspaceKey>,
): WorkspaceNavItem[] {
  const workspaces = visible
    ? WORKSPACE_LINKS.filter((item) => visible.has(item.workspace))
    : WORKSPACE_LINKS;
  // Custom apps are appended from the server-filtered access list in Shell;
  // they are intentionally not part of the fixed workspace enum.
  if (area === "overview") return workspaces;
  const isVisible = (item: WorkspaceNavItem) => !visible || visible.has(item.workspace);
  if (area === "interview") {
    return [...workspaces, ...INTERVIEW_LINKS.filter(isVisible)];
  }
  if (area === "chat") return [...workspaces, ...CHAT_LINKS.filter(isVisible)];
  if (area === "parts") return [...workspaces, ...PARTS_LINKS.filter(isVisible)];
  if (area === "cad") return workspaces;
  if (area === "code") return workspaces;
  return workspaces;
}

/** Sections a role may reach that are not the workspace they are currently in. */
export function getCrossWorkspaceSections(visible?: ReadonlySet<WorkspaceKey>): WorkspaceNavItem[] {
  const isVisible = (item: WorkspaceNavItem) => !visible || visible.has(item.workspace);
  return SECTION_LINKS.filter(isVisible);
}
