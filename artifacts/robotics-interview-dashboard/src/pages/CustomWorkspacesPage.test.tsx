import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomWorkspacesPage } from "./CustomWorkspacesPage";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetSessionQueryKey: () => ["/api/auth/session"],
  useGetSession: mocks.getSession,
}));

const workspace = {
  id: "custom-app-1",
  title: "Team planner",
  description: "Plan the team schedule",
  capabilities: ["data", "llm"],
  status: "published",
  accessMode: "team",
  allowedInterviewerIds: [],
  html: "<main>Current app</main>",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockReturnValue({ data: { role: "coordinator" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("custom workspace access settings", () => {
  it("lets a coordinator choose teammates and saves the selected account IDs", async () => {
    const savedBodies: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/custom-workspaces/team-members") {
        return Response.json({ members: [{ id: "ada-id", displayName: "Ada" }, { id: "ben-id", displayName: "Ben" }] });
      }
      if (path === "/api/custom-workspaces/custom-app-1/versions") {
        return Response.json({ versions: [{
          id: "version-1",
          message: "Before revision",
          createdBy: "coordinator-1",
          createdAt: "2026-10-02T00:00:00.000Z",
        }] });
      }
      if (path === "/api/custom-workspaces/custom-app-1/access") {
        savedBodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          workspace: {
            ...workspace,
            accessMode: "selected",
            allowedInterviewerIds: ["ben-id"],
          },
        });
      }
      if (path === "/api/custom-workspaces") {
        return Response.json({
          workspaces: [{
            ...workspace,
            ...(savedBodies.length ? { accessMode: "selected", allowedInterviewerIds: ["ben-id"] } : {}),
          }],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);

    expect(await screen.findByRole("heading", { name: "Team planner" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Who can use this app?" })).toHaveValue("team"));
    fireEvent.change(screen.getByRole("combobox", { name: "Who can use this app?" }), {
      target: { value: "selected" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-workspaces/team-members",
      expect.any(Object),
    ));
    expect(await screen.findByText("Choose teammates", { selector: "legend" })).toBeInTheDocument();
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("checkbox-workspace-member-ben-id"));
    fireEvent.click(screen.getByRole("button", { name: "Save access" }));

    await waitFor(() => expect(savedBodies).toEqual([{
      accessMode: "selected",
      allowedInterviewerIds: ["ben-id"],
    }]));
    expect(fetchMock).toHaveBeenCalledWith("/api/custom-workspaces/custom-app-1/access", expect.objectContaining({
      method: "PATCH",
    }));
  });
});

describe("custom workspace version history", () => {
  it("previews and restores a saved version of a published app", async () => {
    const restoreRequests: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [workspace] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") {
        return Response.json({ versions: [{
          id: "version-1",
          message: "Before revision",
          createdBy: "coordinator-1",
          createdAt: "2026-10-02T00:00:00.000Z",
        }] });
      }
      if (path === "/api/custom-workspaces/custom-app-1/versions/version-1") {
        return Response.json({ version: {
          id: "version-1",
          message: "Before revision",
          createdBy: "coordinator-1",
          createdAt: "2026-10-02T00:00:00.000Z",
          html: "<main>Saved version preview</main>",
          capabilities: ["llm"],
        } });
      }
      if (path === "/api/custom-workspaces/custom-app-1/versions/version-1/restore") {
        restoreRequests.push(path);
        return Response.json({ workspace: { ...workspace, html: "<main>Saved version preview</main>" } });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);

    const previewButton = await screen.findByTestId("button-preview-version-version-1");
    fireEvent.click(previewButton);
    const savedPreview = await screen.findByTitle("Team planner saved version");
    expect(savedPreview.getAttribute("srcdoc")).toContain("Saved version preview");
    expect(screen.getByText(/capabilities at save: llm/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-restore-version-version-1"));
    await waitFor(() => expect(restoreRequests).toEqual([
      "/api/custom-workspaces/custom-app-1/versions/version-1/restore",
    ]));
    expect(await screen.findByTitle("Team planner preview")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("Saved version preview"),
    );
  });
});
