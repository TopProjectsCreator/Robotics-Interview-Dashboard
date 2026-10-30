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
      if (path === "/api/custom-workspaces/team-members") {
        return Response.json({ members: [{ id: "ada-id", displayName: "Ada" }, { id: "ben-id", displayName: "Ben" }] });
      }
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
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
