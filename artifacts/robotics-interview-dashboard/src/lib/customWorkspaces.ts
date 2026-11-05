import { useQuery } from "@tanstack/react-query";
import type { CustomWorkspace } from "@workspace/api-client-react";
import { getStoredAuthToken } from "../authSession";

export type CustomWorkspaceTab = NonNullable<CustomWorkspace["tabs"]>[number];
export type AccessibleCustomWorkspace = Pick<CustomWorkspace, "id" | "title" | "description" | "status" | "iconDataUrl" | "tabs">;

export function useAccessibleCustomWorkspaces(
  enabled: boolean,
  teamId?: string | null,
  interviewerId?: string | null,
) {
  return useQuery({
    queryKey: ["/api/custom-workspaces", "accessible", teamId ?? "", interviewerId ?? ""],
    enabled,
    refetchOnMount: "always",
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<AccessibleCustomWorkspace[]> => {
      const headers = new Headers();
      const token = getStoredAuthToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch("/api/custom-workspaces", {
        credentials: "include",
        headers,
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: unknown;
        workspaces?: unknown;
      };
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Could not load custom apps.");
      }
      if (!Array.isArray(payload.workspaces)) {
        throw new Error("The custom app list response was invalid.");
      }
      return payload.workspaces.map((workspace) => {
        if (
          !workspace ||
          typeof workspace !== "object" ||
          typeof workspace.id !== "string" ||
          typeof workspace.title !== "string" ||
          typeof workspace.description !== "string" ||
          (workspace.status !== "draft" && workspace.status !== "published")
        ) {
          throw new Error("The custom app list response was invalid.");
        }
        const tabs = workspace.tabs;
        if (
          tabs !== undefined &&
          (!Array.isArray(tabs) ||
            tabs.some((tab) =>
              !tab ||
              typeof tab !== "object" ||
              typeof tab.id !== "string" ||
              !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tab.id) ||
              typeof tab.label !== "string",
            ))
        ) {
          throw new Error("The custom app list response was invalid.");
        }
        return {
          id: workspace.id,
          title: workspace.title,
          description: workspace.description,
          status: workspace.status,
          iconDataUrl: typeof workspace.iconDataUrl === "string" ? workspace.iconDataUrl : null,
          tabs: (tabs ?? []) as CustomWorkspaceTab[],
        };
      });
    },
  });
}
