import { randomUUID } from "node:crypto";

export const BUILT_IN_WORKSPACE_KEYS = ["interview", "chat", "parts", "cad", "code"] as const;
export type BuiltInWorkspaceKey = (typeof BUILT_IN_WORKSPACE_KEYS)[number];

export type WorkspaceIdentity =
  | { workspaceKey: BuiltInWorkspaceKey; customWorkspaceId: null }
  | { workspaceKey: "custom"; customWorkspaceId: string };

const BUILT_IN_PATHS: Array<[BuiltInWorkspaceKey, (path: string) => boolean]> = [
  ["interview", (path) => path === "/interview" || path.startsWith("/interview/") ||
    path === "/applicants" || path.startsWith("/applicants/") ||
    path === "/queue" || path.startsWith("/queue/") ||
    path === "/attendance" || path.startsWith("/attendance/") ||
    path === "/big-screen" || path.startsWith("/big-screen/")],
  ["chat", (path) => path === "/chat" || path.startsWith("/chat/") ||
    path === "/assistant" || path.startsWith("/assistant/") ||
    path.startsWith("/spreadsheets/")],
  ["parts", (path) => path === "/parts" || path.startsWith("/parts/")],
  ["cad", (path) => path === "/cad" || path.startsWith("/cad/")],
  ["code", (path) => path === "/code" || path.startsWith("/code/")],
];

export function workspaceIdentityForPath(rawPath: string): WorkspaceIdentity | null {
  if (typeof rawPath !== "string" || rawPath.length > 512) return null;
  const path = rawPath.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const custom = path.match(/^\/custom-workspaces\/([A-Za-z0-9_-]{1,128})(?:\/[^?]*)?$/);
  if (custom) return { workspaceKey: "custom", customWorkspaceId: custom[1] };
  for (const [workspaceKey, matches] of BUILT_IN_PATHS) {
    if (matches(path)) return { workspaceKey, customWorkspaceId: null };
  }
  return null;
}

export type ActiveInterval = { activityDate: string; activeSeconds: number };

/** Limit any interval to the first 45 seconds and split it at UTC day boundaries. */
export function splitForegroundInterval(startAt: Date, endAt: Date, maxSeconds = 45): ActiveInterval[] {
  const start = startAt.getTime();
  const durationMs = Math.min(Math.max(endAt.getTime() - start, 0), maxSeconds * 1000);
  const boundedEnd = start + durationMs;
  const intervals: ActiveInterval[] = [];
  let cursor = start;
  while (cursor < boundedEnd) {
    const dayEnd = Date.UTC(
      new Date(cursor).getUTCFullYear(),
      new Date(cursor).getUTCMonth(),
      new Date(cursor).getUTCDate() + 1,
    );
    const segmentEnd = Math.min(boundedEnd, dayEnd);
    const activeSeconds = Math.floor(segmentEnd / 1000) - Math.floor(cursor / 1000);
    if (activeSeconds > 0) {
      intervals.push({
        activityDate: new Date(cursor).toISOString().slice(0, 10),
        activeSeconds,
      });
    }
    cursor = segmentEnd;
  }
  return intervals;
}

export function safeWorkspaceName(value: unknown): string {
  if (typeof value !== "string") return "Untitled workspace";
  const name = value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim()
    .slice(0, 120);
  return name || "Untitled workspace";
}

export function newWorkspaceUsageId(): string {
  return randomUUID();
}
