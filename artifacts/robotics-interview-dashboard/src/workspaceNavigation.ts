export type WorkspaceArea = "overview" | "interview" | "chat";
export type WorkspaceNavIcon =
  | "interview"
  | "chat"
  | "applicants"
  | "queue"
  | "attendance"
  | "bigScreen"
  | "assistant";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  iconKey: WorkspaceNavIcon;
  kind: "workspace" | "section";
};

const WORKSPACE_LINKS: WorkspaceNavItem[] = [
  { href: "/interview", label: "Interview", iconKey: "interview", kind: "workspace" },
  { href: "/chat", label: "Chat", iconKey: "chat", kind: "workspace" },
];

const INTERVIEW_LINKS: WorkspaceNavItem[] = [
  { href: "/applicants", label: "Applicants", iconKey: "applicants", kind: "section" },
  { href: "/queue", label: "Interview queue", iconKey: "queue", kind: "section" },
  { href: "/attendance", label: "Attendance", iconKey: "attendance", kind: "section" },
  { href: "/big-screen", label: "Big screen", iconKey: "bigScreen", kind: "section" },
];

const CHAT_LINKS: WorkspaceNavItem[] = [
  { href: "/assistant", label: "AI assistant", iconKey: "assistant", kind: "section" },
];

export function workspaceAreaForPath(location: string): WorkspaceArea {
  const path = location.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";

  if (path === "/dashboard") return "overview";
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

export function getWorkspaceNavigation(area: WorkspaceArea): WorkspaceNavItem[] {
  if (area === "overview") return WORKSPACE_LINKS;
  if (area === "interview") return [...WORKSPACE_LINKS, ...INTERVIEW_LINKS];
  return [...WORKSPACE_LINKS, ...CHAT_LINKS];
}