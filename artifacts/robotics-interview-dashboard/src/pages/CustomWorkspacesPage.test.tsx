import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomWorkspacesPage } from "./CustomWorkspacesPage";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getStoredAuthToken: vi.fn(() => "test-session-token"),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetSessionQueryKey: () => ["/api/auth/session"],
  useGetSession: mocks.getSession,
}));
vi.mock("../authSession", () => ({
  getStoredAuthToken: mocks.getStoredAuthToken,
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
  critiqueRounds: 5,
  verifiedCritiqueRounds: 5,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function builderRunFixture(
  id: string,
  status: string,
  prompt: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    status,
    prompt,
    question: null,
    answers: {},
    activities: [],
    result: "Builder run complete.",
    error: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:01:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.removeItem("robotics-assistant-model");
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
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/custom-workspaces/custom-app-1/assistant-tools") return Response.json({ tools: [] });
      if (path === "/api/custom-workspaces/custom-app-2/assistant-tools") return Response.json({ tools: [] });
      if (path === "/api/custom-workspaces/team-members") {
        return Response.json({ members: [{ id: "ada-id", displayName: "Ada" }, { id: "ben-id", displayName: "Ben" }] });
      }
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces/custom-app-2/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") {
        return Response.json({ versions: [{
          id: "version-1",
          message: "Before revision",
          createdBy: "coordinator-1",
          createdAt: "2026-10-02T00:00:00.000Z",
        }] });
      }
      if (path === "/api/custom-workspaces/custom-app-2/versions") return Response.json({ versions: [] });
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
            prompt: "Build a team planner.\nShow the schedule by week.",
            ...(savedBodies.length ? { accessMode: "selected", allowedInterviewerIds: ["ben-id"] } : {}),
          }, {
            ...workspace,
            id: "custom-app-2",
            title: "Tryout tracker",
            prompt: "Track tryout matches.\nSummarize scores by round.",
          }],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);

    expect(await screen.findByRole("heading", { name: "Team planner" })).toBeInTheDocument();
    const initialRequest = await screen.findByTestId("workspace-initial-request");
    expect(initialRequest.querySelector("h3")).toHaveTextContent("Initial request");
    expect(initialRequest.querySelector("p")?.textContent)
      .toBe("Build a team planner.\nShow the schedule by week.");
    expect(initialRequest.querySelector("p")).toHaveClass("whitespace-pre-wrap");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Who can use this app?" })).toHaveValue("team"));
    fireEvent.change(screen.getByRole("combobox", { name: "Who can use this app?" }), {
      target: { value: "selected" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-workspaces/team-members",
      expect.any(Object),
    ));
    const teamMembersRequest = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/custom-workspaces/team-members",
    );
    expect(new Headers(teamMembersRequest?.[1]?.headers).get("Authorization"))
      .toBe("Bearer test-session-token");
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

    fireEvent.click(screen.getByRole("button", { name: /Tryout tracker/ }));
    expect(await screen.findByRole("heading", { name: "Tryout tracker" })).toBeInTheDocument();
    expect(screen.getByTestId("workspace-initial-request").querySelector("p")?.textContent)
      .toBe("Track tryout matches.\nSummarize scores by round.");
  });
});

describe("custom workspace search", () => {
  it("filters by title, description, and initial request and opens older workspaces without a request", async () => {
    const originalWorkspace = {
      ...workspace,
      title: "Team overview",
      description: "A summary of team activity",
      prompt: "Build a dashboard for team activity.",
    };
    const requestMatchWorkspace = {
      ...workspace,
      id: "custom-app-request-match",
      title: "Family Meal Board",
      description: "Plan shared dinners",
      prompt: "Create a weekly recipe planner for meal prep.",
    };
    const legacyWorkspace = {
      ...workspace,
      id: "custom-app-legacy",
      title: "Tryout tracker",
      description: "Track robot match scores",
    };
    const workspaces = [originalWorkspace, requestMatchWorkspace, legacyWorkspace];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces });
      if (path.startsWith("/api/custom-workspaces/") && path.endsWith("/files")) return Response.json({ files: [] });
      if (path.startsWith("/api/custom-workspaces/") && path.endsWith("/versions")) return Response.json({ versions: [] });
      if (path.startsWith("/api/custom-workspaces/") && path.endsWith("/assistant-tools")) return Response.json({ tools: [] });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    const search = await screen.findByRole("searchbox", { name: "Search workspaces" });
    expect(await screen.findByText("A summary of team activity")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "family meal board" } });
    expect(screen.getByRole("button", { name: /Family Meal Board/ })).toBeInTheDocument();
    expect(screen.queryByText("A summary of team activity")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "shared dinners" } });
    expect(screen.getByRole("button", { name: /Family Meal Board/ })).toBeInTheDocument();
    expect(screen.queryByText("Tryout tracker")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "weekly recipe planner" } });
    fireEvent.click(screen.getByRole("button", { name: /Family Meal Board/ }));
    expect(await screen.findByRole("heading", { name: "Family Meal Board" })).toBeInTheDocument();
    expect(screen.getByTestId("workspace-initial-request").querySelector("p"))
      .toHaveTextContent("Create a weekly recipe planner for meal prep.");

    fireEvent.change(search, { target: { value: "robot match" } });
    fireEvent.click(screen.getByRole("button", { name: /Tryout tracker/ }));
    expect(await screen.findByRole("heading", { name: "Tryout tracker" })).toBeInTheDocument();
    expect(screen.getByTestId("workspace-initial-request"))
      .toHaveTextContent("No initial request was saved for this workspace.");
  });
});

describe("custom workspace sidebar tab settings", () => {
  it("renames, reorders, and removes tabs while saving the existing section IDs", async () => {
    const initialTabs = [
      { id: "planning", label: "Planning" },
      { id: "results", label: "Results" },
      { id: "archive", label: "Archive" },
    ];
    let savedTabs = initialTabs;
    const savedRequests: { tabs: typeof initialTabs; expectedTabs: typeof initialTabs }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces/custom-app-1/assistant-tools") return Response.json({ tools: [] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [{ ...workspace, tabs: savedTabs }] });
      if (path === "/api/custom-workspaces/custom-app-1/files") {
        return Response.json({ files: [
          {
            path: "index.html",
            content: '<main><section data-workspace-tab="planning">Planning</section><section data-workspace-tab="results">Results</section><section data-workspace-tab="archive">Archive</section></main>',
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
          {
            path: "workspace.tabs.json",
            content: JSON.stringify({ tabs: savedTabs }),
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        ] });
      }
      if (path === "/api/custom-workspaces/custom-app-1/tabs" && init?.method === "PUT") {
        const request = JSON.parse(String(init.body)) as { tabs: typeof initialTabs; expectedTabs: typeof initialTabs };
        savedRequests.push(request);
        savedTabs = request.tabs;
        return Response.json({ tabs: savedTabs });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    expect(await screen.findByTestId("workspace-tab-settings")).toBeInTheDocument();
    fireEvent.change(await screen.findByTestId("input-workspace-tab-label-planning"), {
      target: { value: "Schedule" },
    });
    fireEvent.click(screen.getByTestId("button-move-workspace-tab-down-planning"));
    fireEvent.click(screen.getByTestId("button-remove-workspace-tab-archive"));
    fireEvent.click(screen.getByTestId("button-save-workspace-tabs"));

    await waitFor(() => expect(savedRequests).toHaveLength(1));
    expect(savedRequests[0]).toEqual({
      expectedTabs: initialTabs,
      tabs: [
        { id: "results", label: "Results" },
        { id: "planning", label: "Schedule" },
      ],
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Sidebar tabs saved.");
    expect(screen.getByTestId("input-workspace-tab-label-planning")).toHaveValue("Schedule");
    fireEvent.click(screen.getByTestId("button-remove-workspace-tab-results"));
    expect(screen.getByTestId("button-remove-workspace-tab-planning")).toBeDisabled();
  });

  it("keeps the saved tabs unchanged when the server rejects a tab update", async () => {
    const tabs = [
      { id: "planning", label: "Planning" },
      { id: "results", label: "Results" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces/custom-app-1/assistant-tools") return Response.json({ tools: [] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [{ ...workspace, tabs }] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [
        { path: "index.html", content: '<section data-workspace-tab="planning">Planning</section><section data-workspace-tab="results">Results</section>', updatedAt: "2026-10-01T00:00:00.000Z" },
        { path: "workspace.tabs.json", content: JSON.stringify({ tabs }), updatedAt: "2026-10-01T00:00:00.000Z" },
      ] });
      if (path === "/api/custom-workspaces/custom-app-1/tabs" && init?.method === "PUT") {
        return Response.json({ error: "Tab IDs must be unique. The saved app was not changed." }, { status: 400 });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    fireEvent.change(await screen.findByTestId("input-workspace-tab-label-planning"), {
      target: { value: "Schedule" },
    });
    fireEvent.click(screen.getByTestId("button-save-workspace-tabs"));

    expect(await screen.findByTestId("workspace-tab-settings-error")).toHaveTextContent("The saved app was not changed.");
    expect(screen.getByTestId("input-workspace-tab-label-planning")).toHaveValue("Schedule");
    expect(fetchMock).toHaveBeenCalledWith("/api/custom-workspaces/custom-app-1/tabs", expect.objectContaining({
      method: "PUT",
    }));
  });
});

describe("custom workspace assistant actions", () => {
  it("creates a named action disabled, then enables it from the action list", async () => {
    const savedBodies: Record<string, unknown>[][] = [];
    let tools: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [workspace] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1/assistant-tools") {
        if (init?.method === "PUT") {
          tools = JSON.parse(String(init.body)).tools;
          savedBodies.push(structuredClone(tools));
        }
        return Response.json({ tools, status: "published", hasDataCapability: true });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    expect(await screen.findByTestId("workspace-assistant-tools")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No named actions yet\./)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Action name"), { target: { value: "lookup_item" } });
    fireEvent.change(screen.getByLabelText("Operation"), { target: { value: "get" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Read one item by its exact record ID." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));

    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(savedBodies[0][0]).toMatchObject({
      name: "lookup_item",
      description: "Read one item by its exact record ID.",
      enabled: false,
      intent: "read",
      operation: "get",
      recordIdArgument: "recordId",
    });
    const enableAction = await screen.findByRole("checkbox", { name: "Enable lookup_item" });
    expect(enableAction).not.toBeChecked();
    fireEvent.click(enableAction);
    await waitFor(() => expect(savedBodies).toHaveLength(2));
    expect(savedBodies[1][0].enabled).toBe(true);
  });
});

describe("custom workspace deletion", () => {
  const setup = (deleteFailure = false) => {
    let deleted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: deleted ? [] : [workspace] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces/custom-app-1/assistant-tools") return Response.json({ tools: [] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1" && init?.method === "DELETE") {
        if (deleteFailure) return Response.json({ error: "Could not delete the workspace. It has not been removed." }, { status: 500 });
        deleted = true;
        return Response.json({ deleted: true, workspace: { id: workspace.id, title: workspace.title } });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("names the app, warns about deleted data, and refreshes the list after confirmation", async () => {
    const fetchMock = setup();
    render(<CustomWorkspacesPage />);
    expect(await screen.findByRole("heading", { name: "Team planner" })).toBeInTheDocument();
    expect(await screen.findByTestId("workspace-initial-request"))
      .toHaveTextContent("No initial request was saved for this workspace.");

    fireEvent.click(screen.getByTestId("button-delete-workspace"));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delete “Team planner”?" })).toBeInTheDocument();
    expect(screen.getByText(/saved versions, source files, and workspace data/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalledWith("/api/custom-workspaces/custom-app-1", expect.objectContaining({ method: "DELETE" }));
    expect(screen.getByRole("heading", { name: "Team planner" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-delete-workspace"));
    fireEvent.click(await screen.findByTestId("button-confirm-delete-workspace"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-workspaces/custom-app-1",
      expect.objectContaining({ method: "DELETE" }),
    ));
    await waitFor(() => expect(screen.getByText("No custom workspaces yet.")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Team planner" })).not.toBeInTheDocument();
  });

  it("keeps the workspace selected and reports a clear error when deletion fails", async () => {
    const fetchMock = setup(true);
    render(<CustomWorkspacesPage />);
    expect(await screen.findByRole("heading", { name: "Team planner" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-delete-workspace"));
    fireEvent.click(await screen.findByTestId("button-confirm-delete-workspace"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete the workspace. It has not been removed.");
    expect(screen.getByRole("heading", { name: "Team planner" })).toBeInTheDocument();
    expect(screen.getByTestId("button-delete-workspace")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/custom-workspaces", expect.anything());
  });
});

describe("custom workspace builder controls", () => {
  const respondToManagerLoad = (path: string) => {
    if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
    if (path === "/api/assistant/models") return Response.json({ items: [] });
    if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
    if (path === "/api/assistant/history") return Response.json({ items: [] });
    if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
    if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
    if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
    return null;
  };

  it("pauses a run and lets the coordinator continue from its saved draft", async () => {
    const queuedPrompts: string[] = [];
    let run = builderRunFixture(
      "run-1",
      "running",
      "Build a custom workspace app for the team. Requirements: tryout schedule",
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const shared = respondToManagerLoad(path);
      if (shared) return shared;
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run });
      if (path === "/api/assistant/custom-workspace-builder/runs/run-1" && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ action: "pause" });
        run = builderRunFixture("run-1", "paused", run.prompt, {
          error: "Paused by the coordinator. Continue the builder when you're ready.",
        });
        return Response.json({ run });
      }
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { question: string };
        queuedPrompts.push(body.question);
        return Response.json({ run: builderRunFixture("run-2", "completed", body.question) }, { status: 201 });
      }
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [] });
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    expect(await screen.findByTestId("builder-run-status")).toHaveTextContent("Building");
    fireEvent.click(screen.getByTestId("button-pause-builder"));

    expect(await screen.findByTestId("builder-run-status")).toHaveTextContent("Paused — can continue");
    fireEvent.click(screen.getByTestId("button-continue-builder"));
    await waitFor(() => expect(queuedPrompts).toHaveLength(1));
    expect(queuedPrompts[0]).toContain("Existing draft ID: builder-run-1");
    expect(await screen.findByTestId("builder-run-status")).toHaveTextContent("Complete");
  });

  it("requires confirmation before stopping and does not offer the stopped run as resumable", async () => {
    let run = builderRunFixture(
      "run-stop",
      "running",
      "Build a custom workspace app for the team. Requirements: tryout schedule",
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const shared = respondToManagerLoad(path);
      if (shared) return shared;
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run });
      if (path === "/api/assistant/custom-workspace-builder/runs/run-stop" && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ action: "stop" });
        run = builderRunFixture("run-stop", "cancelled", run.prompt, {
          error: "Stopped by the coordinator. Saved workspace files were kept.",
        });
        return Response.json({ run });
      }
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [] });
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    await screen.findByTestId("builder-run-status");
    fireEvent.click(screen.getByTestId("button-stop-builder"));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("cannot be continued as the same run");
    fireEvent.click(screen.getByTestId("button-confirm-stop-builder"));

    expect(await screen.findByTestId("builder-run-status")).toHaveTextContent("Stopped — saved files kept");
    expect(screen.queryByTestId("button-continue-builder")).not.toBeInTheDocument();
  });

  it("keeps workspace deletion available while a revision is running", async () => {
    let deleted = false;
    let runStatus = "running";
    const draft = { ...workspace, status: "draft", critiqueRounds: 2, verifiedCritiqueRounds: 1 };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const shared = respondToManagerLoad(path);
      if (shared) return shared;
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { question: string };
        return Response.json({ run: builderRunFixture("revision-run", runStatus, body.question) }, { status: 201 });
      }
      if (path === "/api/assistant/custom-workspace-builder/runs/revision-run") {
        return Response.json({ run: builderRunFixture("revision-run", runStatus, "Revise custom workspace draft custom-app-1.") });
      }
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: deleted ? [] : [draft] });
      if (path === "/api/custom-workspaces/custom-app-1" && init?.method === "DELETE") {
        deleted = true;
        runStatus = "cancelled";
        return Response.json({ deleted: true, workspace: { id: draft.id, title: draft.title } });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = render(<CustomWorkspacesPage />);
    expect(await screen.findByRole("heading", { name: "Team planner" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Revise this draft"), { target: { value: "Update the schedule view" } });
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    await screen.findByText("Building");

    expect(screen.getByTestId("button-delete-workspace")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-delete-workspace"));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Its active builder will be stopped first");
    fireEvent.click(screen.getByTestId("button-confirm-delete-workspace"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-workspaces/custom-app-1",
      expect.objectContaining({ method: "DELETE" }),
    ));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Team planner" })).not.toBeInTheDocument());
    await new Promise((resolve) => window.setTimeout(resolve, 2600));
    page.unmount();
  }, 10000);
});

describe("custom workspace version history", () => {
  it("previews and restores a saved version of a published app", async () => {
    const restoreRequests: string[] = [];
    let restored = false;
    const savedFiles = [
      { path: "index.html", content: '<!doctype html><html><head><link rel="stylesheet" href="styles.css"><script src="app.js"></script></head><body><main>Saved version preview</main></body></html>', updatedAt: "2026-10-02T00:00:00.000Z" },
      { path: "styles.css", content: ".saved-preview { color: rgb(1, 2, 3); }", updatedAt: "2026-10-02T00:00:00.000Z" },
      { path: "app.js", content: "window.savedVersionPreview = true;", updatedAt: "2026-10-02T00:00:00.000Z" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: restored ? savedFiles : [] });
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
          html: savedFiles[0].content,
          capabilities: ["llm"],
          sourceFiles: savedFiles,
        } });
      }
      if (path === "/api/custom-workspaces/custom-app-1/versions/version-1/restore") {
        restoreRequests.push(path);
        restored = true;
        return Response.json({ workspace: { ...workspace, html: savedFiles[0].content } });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);

    const previewButton = await screen.findByTestId("button-preview-version-version-1");
    fireEvent.click(previewButton);
    const savedPreview = await screen.findByTitle("Team planner saved version");
    expect(savedPreview.getAttribute("srcdoc")).toContain("Saved version preview");
    expect(savedPreview.getAttribute("srcdoc")).toContain(".saved-preview { color: rgb(1, 2, 3); }");
    expect(savedPreview.getAttribute("srcdoc")).toContain("window.savedVersionPreview = true;");
    fireEvent.click(screen.getByRole("button", { name: "styles.css" }));
    expect(await screen.findByText(".saved-preview { color: rgb(1, 2, 3); }")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "app.js" }));
    expect(await screen.findByText("window.savedVersionPreview = true;")).toBeInTheDocument();
    expect(screen.getByText(/capabilities at save: llm/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-restore-version-version-1"));
    await waitFor(() => expect(restoreRequests).toEqual([
      "/api/custom-workspaces/custom-app-1/versions/version-1/restore",
    ]));
    expect(await screen.findByTitle("Team planner preview")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("Saved version preview"),
    );
    expect(await screen.findByText("window.savedVersionPreview = true;")).toBeInTheDocument();
  });
});

describe("automatic custom workspace critiques", () => {
  it("queues the full critique workflow on the server after generation", async () => {
    const draft = {
      ...workspace,
      status: "draft",
      critiqueRounds: 0,
      verifiedCritiqueRounds: 0,
    };
    let queueCalls = 0;
    let queuedPrompt = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [{ id: "model-selected", name: "Selected model" }] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") {
        return Response.json({
          workspaces: queueCalls > 0
            ? [{ ...draft, critiqueRounds: 5, verifiedCritiqueRounds: 5 }]
            : [],
        });
      }
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        queueCalls += 1;
        queuedPrompt = JSON.parse(String(init.body)).question;
        return Response.json({ run: builderRunFixture("server-run-1", "completed", queuedPrompt) }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    fireEvent.change(await screen.findByLabelText("What should this workspace do?"), {
      target: { value: "Create a team planner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }));

    await waitFor(() => expect(queueCalls).toBe(1));
    expect(queuedPrompt).toContain("Build a custom workspace app for the team");
    expect(queuedPrompt).toContain("assets/icon.svg");
    expect(queuedPrompt).toContain("20 KB");
    expect(queuedPrompt).toContain("five independently verified rounds");
    expect(queuedPrompt).toContain("without waiting for Publish");
    expect(queuedPrompt).toContain("critique or verification fails");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/assistant/ask/stream", expect.anything());
    expect(screen.getByTestId("publish-agent-activity")).toBeInTheDocument();
  });

  it("automatically starts review rounds on an existing draft without creating another workspace", async () => {
    const draft = {
      ...workspace,
      title: "Gothic Cathedral 3D Chess",
      status: "draft",
      critiqueRounds: 0,
      verifiedCritiqueRounds: 0,
    };
    let queueCalls = 0;
    let reviewPrompt = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [{ id: "model-selected", name: "Selected model" }] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") {
        return Response.json({
          workspaces: [{
            ...draft,
            critiqueRounds: queueCalls > 0 ? 5 : 0,
            verifiedCritiqueRounds: queueCalls > 0 ? 5 : 0,
          }],
        });
      }
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        reviewPrompt = JSON.parse(String(init?.body)).question;
        queueCalls += 1;
        return Response.json({ run: builderRunFixture("review-run-1", "completed", reviewPrompt) }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);

    await waitFor(() => expect(queueCalls).toBe(1));
    expect(reviewPrompt).toContain("Revise custom workspace draft custom-app-1");
    expect(reviewPrompt).toContain("do not wait for Publish");
    expect(reviewPrompt).toContain("verify_custom_workspace_fixes");
    expect(reviewPrompt).toContain("assets/icon.svg");
    expect(reviewPrompt).not.toContain("Build a custom workspace app for the team");
    expect(await screen.findByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getAllByText("Gothic Cathedral 3D Chess")).toHaveLength(2);
    expect(screen.queryByTestId("button-start-draft-reviews")).not.toBeInTheDocument();
  });

  it("does not start a duplicate review while the draft already has an active builder run", async () => {
    const draft = {
      ...workspace,
      title: "Gothic Cathedral 3D Chess",
      status: "draft",
      critiqueRounds: 0,
      verifiedCritiqueRounds: 0,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: {
        id: "active-review-run",
        status: "queued",
        prompt: "Revise custom workspace draft custom-app-1",
        question: null,
        answers: {},
        activities: [],
        result: null,
        error: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      } });
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [draft] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);

    expect(await screen.findByTestId("publish-readiness")).toHaveTextContent("0/5 complete");
    await waitFor(() => expect(screen.getByTestId("builder-run-status")).toHaveTextContent("Queued on server"));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/assistant/ask/stream", expect.anything());
  });
});

describe("custom workspace visual publish review", () => {
  it("keeps Publish unavailable until the builder verifies all five rounds", async () => {
    const draft = { ...workspace, status: "draft", critiqueRounds: 0, verifiedCritiqueRounds: 0 };
    const publishedWorkspace = { ...workspace, status: "published" };
    let publishAttempts = 0;
    let builderStarted = false;
    let queueCalls = 0;
    const visualFrames = [
      { type: "tool_start", id: "runtime-1", tool: "Check browser runtime", detail: "Opening the isolated draft." },
      { type: "complete", workspace: publishedWorkspace },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") {
        return Response.json({ run: builderStarted ? {
          id: "review-run-1",
          status: "completed",
          prompt: "Review custom workspace",
          question: null,
          answers: {},
          activities: [{ tool: "critique_custom_workspace", detail: "critique round 1: 10 ranked flaws" }],
          result: "All five rounds are verified.",
          error: null,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:01:00.000Z",
        } : null });
      }
      if (path === "/api/assistant/models") return Response.json({ items: [{ id: "model-selected", name: "Selected model" }] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected", visionModel: "vision" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [draft] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1/files") {
        return Response.json({ files: [{ path: "index.html", content: "<main>Current app</main>", updatedAt: "2026-10-01T00:00:00.000Z" }] });
      }
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        const { question } = JSON.parse(String(init?.body)) as { question: string };
        expect(question).toContain("Revise custom workspace draft custom-app-1");
        expect(question).toContain("five-round independent critique");
        expect(question).toContain("verify_custom_workspace_fixes");
        queueCalls += 1;
        builderStarted = true;
        return Response.json({
          run: builderRunFixture("review-run-1", "completed", question, {
            activities: [{ tool: "critique_custom_workspace", detail: "critique round 1: 10 ranked flaws" }],
          }),
        }, { status: 201 });
      }
      if (path === "/api/custom-workspaces/custom-app-1/publish") {
        publishAttempts += 1;
        if (publishAttempts === 1) {
          return Response.json({
            error: "Complete and independently verify all five critique rounds before publishing this workspace.",
          }, { status: 409 });
        }
        return new Response(`${visualFrames.map((frame) => JSON.stringify(frame)).join("\n")}\n`, {
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    expect(await screen.findByTestId("publish-readiness")).toHaveTextContent("0/5 complete");
    await waitFor(() => expect(queueCalls).toBe(1));
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(publishAttempts).toBe(0);
    expect(builderStarted).toBe(true);
  });

  it("publishes a completed draft without starting another agent", async () => {
    let published = false;
    const draft = { ...workspace, status: "draft" };
    const publishedWorkspace = { ...workspace, status: "published" };
    const frames = [
      { type: "tool_start", id: "runtime-1", tool: "Check browser runtime", detail: "Opening the isolated draft." },
      { type: "tool_start", id: "screenshot-light-1", tool: "Capture light theme screenshot", detail: "Rendering at 1280 × 900." },
      { type: "tool_start", id: "screenshot-dark-1", tool: "Capture dark theme screenshot", detail: "Rendering at 1280 × 900." },
      { type: "screenshot", id: "screenshot-light-1", theme: "light", image: "data:image/png;base64,bGlnaHQ=" },
      { type: "screenshot", id: "screenshot-dark-1", theme: "dark", image: "data:image/png;base64,ZGFyaw==" },
      { type: "tool_done", id: "runtime-1", passed: true, detail: "No JavaScript errors or failed resource loads." },
      { type: "tool_start", id: "review-light-1", tool: "Review light theme contrast and layout", detail: "Checking layout." },
      { type: "review", id: "review-light-1", theme: "light", passed: true, issues: [] },
      { type: "tool_start", id: "review-dark-1", tool: "Review dark theme contrast and layout", detail: "Checking layout and contrast." },
      { type: "review", id: "review-dark-1", theme: "dark", passed: true, issues: [] },
      { type: "complete", workspace: publishedWorkspace },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [published ? publishedWorkspace : draft] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1/publish") {
        published = true;
        return Response.json({ workspace: publishedWorkspace });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Publish workspace")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/custom-workspaces/custom-app-1/publish", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/assistant/ask/stream", expect.anything());
  });

  it("keeps the draft when the direct publish request fails", async () => {
    const draft = { ...workspace, status: "draft" };
    const frames = [
      { type: "tool_start", id: "runtime-1", tool: "Check browser runtime", detail: "Opening the isolated draft." },
      { type: "tool_start", id: "screenshot-light-1", tool: "Capture light theme screenshot", detail: "Rendering at 1280 × 900." },
      { type: "tool_start", id: "screenshot-dark-1", tool: "Capture dark theme screenshot", detail: "Rendering at 1280 × 900." },
      { type: "screenshot", id: "screenshot-light-1", theme: "light", image: "data:image/png;base64,bGlnaHQ=" },
      { type: "screenshot", id: "screenshot-dark-1", theme: "dark", image: "data:image/png;base64,ZGFyaw==" },
      { type: "tool_done", id: "runtime-1", passed: false, detail: "JavaScript exception: render failed · Asset load failure: img missing.png" },
      { type: "failed", message: "Browser runtime checks still found errors. The workspace remains a draft." },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces/custom-app-1/assistant-tools") return Response.json({ tools: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [draft] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1/publish") {
        return Response.json({ error: "Could not publish the workspace." }, { status: 500 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CustomWorkspacesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not publish the workspace.");
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(screen.queryByText("Publish workspace")).not.toBeInTheDocument();
  });

  it("enqueues a server-owned build and displays its saved file tree and activities", async () => {
    const draft = {
      id: "new-workspace",
      title: "Parts tracker",
      description: "Track parts and stock",
      capabilities: ["data", "llm"],
      status: "draft",
      accessMode: "team",
      allowedInterviewerIds: [],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const savedFiles = [
      {
        path: "index.html",
        content: '<!doctype html><html><head><link rel="stylesheet" href="./styles.css"><script src="./app.js"></script></head><body><main>Generated Parts tracker</main></body></html>',
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
      { path: "styles.css", content: ".generated-preview { color: rgb(1, 2, 3); }", updatedAt: "2026-10-01T00:00:00.000Z" },
      { path: "app.js", content: "window.generatedPreview = true;", updatedAt: "2026-10-01T00:00:00.000Z" },
    ];
    window.localStorage.setItem("robotics-assistant-model", "openrouter/free");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [
        { id: "minimax/minimax-m3.1-flash:free", name: "MiniMax: MiniMax M3.1 Flash (free)" },
        { id: "model-selected", name: "Selected model" },
      ] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "minimax/minimax-m3.1-flash:free", visionModel: "vision" });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({
        workspaces: [draft],
      });
      if (path === "/api/custom-workspaces/new-workspace/files") {
        return Response.json({ files: savedFiles });
      }
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        const body = JSON.parse(String(init?.body));
        expect(body.question).toContain("Build a custom workspace app");
        expect(body.model).toBe("model-selected");
        return Response.json({
          run: builderRunFixture("generated-run", "completed", body.question, {
            result: "Draft saved.",
            activities: [
              { tool: "create_custom_workspace", detail: "created custom workspace draft", input: "{\"title\":\"Parts tracker\"}", output: "{\"id\":\"new-workspace\"}" },
              { tool: "create_custom_workspace_file", detail: "created index.html", input: "{\"path\":\"index.html\"}", output: "Created index.html." },
              { tool: "assistant_progress", detail: "Reviewed the tool results and prepared the next action." },
            ],
          }),
        }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CustomWorkspacesPage />);
    const modelPicker = await screen.findByRole("combobox", { name: "Workspace builder model" });
    await waitFor(() => expect(modelPicker).toHaveValue("minimax/minimax-m3.1-flash:free"));
    expect(modelPicker).toHaveTextContent("MiniMax: MiniMax M3.1 Flash (free)");
    expect(window.localStorage.getItem("robotics-assistant-model"))
      .toBe("minimax/minimax-m3.1-flash:free");
    fireEvent.change(modelPicker, { target: { value: "model-selected" } });
    fireEvent.change(await screen.findByLabelText("What should this workspace do?"), {
      target: { value: "Track parts and stock" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(await screen.findByRole("heading", { name: "Parts tracker" })).toBeInTheDocument();
    expect(await screen.findByTestId("workspace-source-tree")).toHaveTextContent("index.html");
    expect(await screen.findByText("create custom workspace file")).toBeInTheDocument();
    const preview = await screen.findByTitle("Parts tracker preview");
    expect(preview.getAttribute("srcdoc")).toContain("--workspace-teal: #16869a");
    expect(preview.getAttribute("srcdoc")).toContain(":root.dark");
    expect(preview.getAttribute("srcdoc")).toContain("Generated Parts tracker");
    expect(preview.getAttribute("srcdoc")).toContain(".generated-preview { color: rgb(1, 2, 3); }");
    expect(preview.getAttribute("srcdoc")).toContain("window.generatedPreview = true;");
    expect(draft).not.toHaveProperty("html");
    expect(await screen.findByText('{"path":"index.html"}')).toBeInTheDocument();
    expect(screen.getByText("Created index.html.")).toBeInTheDocument();
    expect(screen.getByText("Progress update")).toBeInTheDocument();
    expect(screen.getByText("Reviewed the tool results and prepared the next action.")).toBeInTheDocument();
    expect(screen.getByText("Review progress and tool calls are shown here. Private internal reasoning is not displayed. Publishing is available after all five review rounds are independently verified.")).toBeInTheDocument();
  });

  it("clears the previous workspace preview and source files when the selected draft has no entry file", async () => {
    const firstWorkspace = {
      ...workspace,
      id: "workspace-with-files",
      title: "Workspace with files",
      status: "draft",
      critiqueRounds: 5,
      verifiedCritiqueRounds: 5,
    };
    const emptyWorkspace = {
      id: "empty-workspace",
      title: "Empty draft",
      description: "No saved entry file",
      capabilities: [],
      status: "draft",
      critiqueRounds: 5,
      verifiedCritiqueRounds: 5,
      accessMode: "team",
      allowedInterviewerIds: [],
      createdAt: "2026-10-02T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [firstWorkspace, emptyWorkspace] });
      if (path === "/api/custom-workspaces/workspace-with-files/versions" || path === "/api/custom-workspaces/empty-workspace/versions") {
        return Response.json({ versions: [] });
      }
      if (path === "/api/custom-workspaces/workspace-with-files/files") {
        return Response.json({ files: [{
          path: "index.html",
          content: "<main>First workspace preview</main>",
          updatedAt: "2026-10-01T00:00:00.000Z",
        }] });
      }
      if (path === "/api/custom-workspaces/empty-workspace/files") return Response.json({ files: [] });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);

    await waitFor(() => expect(screen.getByTitle("Workspace with files preview")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("First workspace preview"),
    ));
    fireEvent.click(screen.getByRole("button", { name: /Empty draftdraft/ }));

    expect(await screen.findByRole("heading", { name: "Empty draft" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTitle("Empty draft preview")).not.toBeInTheDocument();
      expect(screen.getByTestId("workspace-source-tree"))
        .toHaveTextContent("No source files have been saved for this workspace yet.");
    });
    expect(screen.getByText("This workspace has no previewable index.html yet.")).toBeInTheDocument();
    expect(screen.queryByText("First workspace preview")).not.toBeInTheDocument();
  });

  it("collects a batch of agent questions and lets the coordinator inspect and remove an uploaded file", async () => {
    let submittedAnswers: Record<string, unknown> | undefined;
    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:question-file" });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
    const questions = {
      id: "pending-question-1",
      questions: [
        { id: "purpose", type: "text", title: "What will the workspace track?", required: true },
        { id: "layout", type: "singleSelect", title: "Choose a layout", options: ["Table", "Cards"], required: true },
        { id: "features", type: "multiSelect", title: "Which features?", options: ["Search", "Export"] },
        { id: "approved", type: "boolean", title: "Should the team use it?", required: true },
        { id: "reference", type: "fileUpload", title: "Upload a reference", maxFiles: 2 },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") {
        return Response.json({ run: submittedAnswers ? builderRunFixture("question-run", "completed", "Build workspace", {
          answers: submittedAnswers,
          result: "Draft complete.",
        }) : null });
      }
      if (path === "/api/assistant/models") return Response.json({ items: [{ id: "model-selected", name: "Selected model" }] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected", visionModel: "vision" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [] });
      if (path === "/api/assistant/questions/pending-question-1/answer") {
        submittedAnswers = JSON.parse(String(init?.body)).answers;
        return Response.json({ submitted: true });
      }
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        const { question } = JSON.parse(String(init.body));
        return Response.json({
          run: builderRunFixture("question-run", "waiting_for_answer", question, {
            question: questions,
            result: null,
          }),
        }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<CustomWorkspacesPage />);
      fireEvent.change(await screen.findByLabelText("What should this workspace do?"), {
        target: { value: "Track team projects" },
      });
      await waitFor(() => expect(screen.getByRole("button", { name: "Generate draft" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Generate draft" }));
      expect(await screen.findByTestId("agent-question-form")).toBeInTheDocument();
      fireEvent.change(screen.getByTestId("input-question-purpose"), { target: { value: "Projects and owners" } });
      fireEvent.click(screen.getByLabelText("Cards"));
      fireEvent.click(screen.getByLabelText("Search"));
      fireEvent.click(screen.getByLabelText("Yes"));
      const reference = new File(["sample reference"], "reference.txt", { type: "text/plain" });
      fireEvent.change(screen.getByTestId("input-question-file-reference"), { target: { files: [reference] } });
      expect(await screen.findByText(/reference\.txt/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "blob:question-file");
      fireEvent.click(screen.getByRole("button", { name: "Remove reference.txt" }));
      expect(screen.queryByText(/reference\.txt/)).not.toBeInTheDocument();
      fireEvent.change(screen.getByTestId("input-question-file-reference"), {
        target: { files: [new File(["not supported"], "reference.bin", { type: "application/octet-stream" })] },
      });
      expect(await screen.findAllByText(/reference\.bin is not a supported attachment/)).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Submit answers" })).toBeDisabled();
      fireEvent.change(screen.getByTestId("input-question-file-reference"), {
        target: { files: [
          new File(["updated reference"], "replacement.txt", { type: "text/plain" }),
          new File(["%PDF-1.4 document"], "specification.pdf", { type: "application/pdf" }),
        ] },
      });
      fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

      await waitFor(() => expect(submittedAnswers).toBeDefined());
      expect(submittedAnswers).toMatchObject({
        purpose: { value: "Projects and owners" },
        layout: { value: "Cards" },
        features: { value: ["Search"] },
        approved: { value: "yes" },
        reference: [
          { name: "replacement.txt", type: "text/plain", textContent: "updated reference" },
          expect.objectContaining({ name: "specification.pdf", type: "application/pdf", dataUrl: expect.stringMatching(/^data:application\/pdf;base64,/) }),
        ],
      });
    } finally {
      if (originalCreateObjectURL) Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (originalRevokeObjectURL) Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  it("sends the catalog-backed MiniMax default with a new workspace request", async () => {
    let submittedModel = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [
        { id: "minimax/minimax-m3.1-flash:free", name: "MiniMax: MiniMax M3.1 Flash (free)" },
      ] });
      if (path === "/api/assistant/config") return Response.json({
        textModel: "minimax/minimax-m3.1-flash:free",
        visionModel: "vision",
      });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        submittedModel = JSON.parse(String(init?.body)).model;
        const { question } = JSON.parse(String(init.body));
        return Response.json({
          run: builderRunFixture("model-run", "completed", question, { result: "Draft saved." }),
        }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    const picker = await screen.findByRole("combobox", { name: "Workspace builder model" });
    await waitFor(() => expect(picker).toHaveValue("minimax/minimax-m3.1-flash:free"));
    fireEvent.change(await screen.findByLabelText("What should this workspace do?"), {
      target: { value: "Create a team parts tracker" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }));

    await waitFor(() => expect(submittedModel).toBe("minimax/minimax-m3.1-flash:free"));
  });

  it("reloads an interrupted question, saves its answer, and shows the recovered result", async () => {
    const question = {
      id: "persisted-question-1",
      questions: [{ id: "purpose", type: "text", title: "What should the workspace track?", required: true }],
    };
    const savedPrompt = "Build a custom workspace app for the team. Requirements: Tryout day schedule.";
    let answer: Record<string, unknown> | null = null;
    const interruptedRun = {
      id: "builder-run-1",
      status: "interrupted",
      prompt: savedPrompt,
      question,
      answers: {},
      activities: [{ tool: "create_custom_workspace", detail: "Saved a draft workspace." }],
      result: null,
      error: "This builder stopped before it could finish.",
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T10:01:00.000Z",
    };
    const completedRun = {
      ...interruptedRun,
      status: "completed",
      question: null,
      result: "The tryout schedule draft is ready for review.",
      error: null,
      updatedAt: "2026-10-20T10:02:00.000Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [question] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") {
        return Response.json({ run: answer ? { ...completedRun, answers: answer } : interruptedRun });
      }
      if (path === "/api/assistant/models") return Response.json({ items: [] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "default" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [] });
      if (path === "/api/assistant/questions/persisted-question-1/answer") {
        answer = JSON.parse(String(init?.body)).answers;
        return Response.json({ submitted: true, resumed: true, status: "queued" });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = render(<CustomWorkspacesPage />);
    expect(await screen.findByTestId("agent-question-form")).toBeInTheDocument();
    expect(screen.getByTestId("builder-run-status")).toHaveTextContent("Stopped — can continue");
    fireEvent.change(screen.getByTestId("input-question-purpose"), {
      target: { value: "Interview time slots and room assignments" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    await waitFor(() => expect(answer).toEqual({
      purpose: { value: "Interview time slots and room assignments" },
    }));
    expect(await screen.findByTestId("builder-run-result")).toHaveTextContent(
      "The tryout schedule draft is ready for review.",
    );
    expect(screen.queryByTestId("button-continue-builder")).not.toBeInTheDocument();
    expect(screen.getByTestId("builder-run-status")).toHaveTextContent("Complete");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/assistant/ask/stream", expect.anything());

    page.unmount();
    render(<CustomWorkspacesPage />);
    expect(await screen.findByTestId("builder-run-result")).toHaveTextContent(
      "The tryout schedule draft is ready for review.",
    );
  });
});

describe("legacy custom workspace tab upgrades", () => {
  it("keeps the live app unchanged while a coordinator reviews its tab-upgrade draft", async () => {
    const published = { ...workspace, tabs: [] };
    let reviewDraft: typeof workspace & { upgradeTargetId?: string | null; tabs?: { id: string; label: string }[] } | null = null;
    let queuedPrompt = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
      if (path === "/api/assistant/custom-workspace-builder/runs/latest") return Response.json({ run: null });
      if (path === "/api/assistant/models") return Response.json({ items: [{ id: "model-selected", name: "Selected model" }] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") {
        return Response.json({
          workspaces: reviewDraft
            ? [reviewDraft, published]
            : [published],
        });
      }
      if (path === "/api/custom-workspaces/custom-app-1/files") {
        return Response.json({ files: [{ path: "index.html", content: "<main>Published source</main>", updatedAt: published.updatedAt }] });
      }
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-app-review/files") {
        return Response.json({ files: [{ path: "index.html", content: "<main>Review source</main>", updatedAt: published.updatedAt }] });
      }
      if (path === "/api/custom-app-review/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1/upgrade-tabs" && init?.method === "POST") {
        reviewDraft = {
          ...published,
          id: "custom-app-review",
          title: "Team planner · Tab upgrade review",
          status: "draft",
          tabs: [],
          upgradeTargetId: published.id,
          critiqueRounds: 0,
          verifiedCritiqueRounds: 0,
        };
        return Response.json({ workspace: reviewDraft }, { status: 201 });
      }
      if (path === "/api/assistant/custom-workspace-builder/runs" && init?.method === "POST") {
        queuedPrompt = JSON.parse(String(init.body)).question;
        reviewDraft = {
          ...reviewDraft!,
          critiqueRounds: 5,
          verifiedCritiqueRounds: 5,
        };
        return Response.json({ run: builderRunFixture("tab-upgrade-review-run", "completed", queuedPrompt) }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    fireEvent.click(await screen.findByTestId("button-upgrade-workspace-tabs"));

    await waitFor(() => expect(queuedPrompt).toContain("Revise custom workspace draft custom-app-review"));
    expect(queuedPrompt).toContain("workspace.tabs.json");
    expect(queuedPrompt).toContain("data-workspace-tab");
    expect(queuedPrompt).toContain("five sequential critique rounds");
    expect(published.status).toBe("published");
    expect(published.tabs).toEqual([]);
    expect(await screen.findByText(/the published app remains unchanged until you publish/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Publish" })).toBeInTheDocument();
  });
});
