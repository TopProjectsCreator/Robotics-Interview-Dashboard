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
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

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

describe("custom workspace visual publish review", () => {
  it("shows live agent actions and the screenshot reviewed before publishing", async () => {
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
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [published ? publishedWorkspace : draft] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1/publish") {
        published = true;
        return new Response(`${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`, {
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomWorkspacesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Builder agent activity")).toBeInTheDocument();
    expect(await screen.findByText("Capture light theme screenshot")).toBeInTheDocument();
    expect(await screen.findByText("Capture dark theme screenshot")).toBeInTheDocument();
    expect(await screen.findByText("Check browser runtime")).toBeInTheDocument();
    expect(await screen.findByText("Review dark theme contrast and layout")).toBeInTheDocument();
    expect(await screen.findByText("No JavaScript errors or failed resource loads.")).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Latest screenshot reviewed by the builder agent" }))
      .toHaveAttribute("src", "data:image/png;base64,bGlnaHQ=");
    expect(await screen.findByRole("img", { name: "Latest dark-theme screenshot reviewed by the builder agent" }))
      .toHaveAttribute("src", "data:image/png;base64,ZGFyaw==");
    expect(await screen.findByText("Publish workspace")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/custom-workspaces/custom-app-1/publish", expect.objectContaining({
      method: "POST",
      credentials: "include",
    }));
  });

  it("shows runtime failures as failed activity and keeps the draft unpublished", async () => {
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
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces/custom-app-1/files") return Response.json({ files: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [draft] });
      if (path === "/api/custom-workspaces/custom-app-1/versions") return Response.json({ versions: [] });
      if (path === "/api/custom-workspaces/custom-app-1/publish") {
        return new Response(`${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`, {
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CustomWorkspacesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(await screen.findByText(/JavaScript exception: render failed/)).toBeInTheDocument();
    expect(await screen.findByText(/Browser runtime checks still found errors/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(screen.queryByText("Publish workspace")).not.toBeInTheDocument();
  });

  it("builds through the streamed assistant tool loop and displays the saved file tree", async () => {
    const draft = { ...workspace, id: "new-workspace", title: "Parts tracker", status: "draft" };
    window.localStorage.setItem("robotics-assistant-model", "openrouter/free");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/assistant/questions/pending") return Response.json({ questions: [] });
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
        return Response.json({ files: [{ path: "index.html", content: "<main>Parts tracker</main>", updatedAt: "2026-10-01T00:00:00.000Z" }] });
      }
      if (path === "/api/assistant/ask/stream") {
        const body = JSON.parse(String(init?.body));
        expect(body.question).toContain("Build a custom workspace app");
        expect(body.model).toBe("model-selected");
        return new Response([
          `data: ${JSON.stringify({ activity: { tool: "create_custom_workspace", detail: "created custom workspace draft", input: "{\"title\":\"Parts tracker\"}", output: "{\"id\":\"new-workspace\"}" } })}\n\n`,
          `data: ${JSON.stringify({ activity: { tool: "create_custom_workspace_file", detail: "created index.html", input: "{\"path\":\"index.html\"}", output: "Created index.html." } })}\n\n`,
          `data: ${JSON.stringify({ done: true, answer: "Draft saved." })}\n\n`,
        ].join(""), { headers: { "Content-Type": "text/event-stream" } });
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
    fireEvent.click(screen.getAllByText("Tool call details")[1]);
    expect(await screen.findByText('{"path":"index.html"}')).toBeInTheDocument();
    expect(screen.getByText("Created index.html.")).toBeInTheDocument();
  });

  it("collects a batch of agent questions and lets the coordinator inspect and remove an uploaded file", async () => {
    let finishAnswer = () => {};
    const answersSubmitted = new Promise<void>((resolve) => { finishAnswer = resolve; });
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
      if (path === "/api/assistant/models") return Response.json({ items: [{ id: "model-selected", name: "Selected model" }] });
      if (path === "/api/assistant/config") return Response.json({ textModel: "model-selected", visionModel: "vision" });
      if (path === "/api/assistant/history") return Response.json({ items: [] });
      if (path === "/api/custom-workspaces/team-members") return Response.json({ members: [] });
      if (path === "/api/custom-workspaces") return Response.json({ workspaces: [] });
      if (path === "/api/assistant/questions/pending-question-1/answer") {
        submittedAnswers = JSON.parse(String(init?.body)).answers;
        finishAnswer();
        return Response.json({ submitted: true });
      }
      if (path === "/api/assistant/ask/stream") {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ question: questions })}\n\n`));
            void answersSubmitted.then(() => {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, answer: "Draft complete." })}\n\n`));
              controller.close();
            });
          },
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
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
        target: { files: [new File(["updated reference"], "replacement.txt", { type: "text/plain" })] },
      });
      fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

      await waitFor(() => expect(submittedAnswers).toBeDefined());
      expect(submittedAnswers).toMatchObject({
        purpose: { value: "Projects and owners" },
        layout: { value: "Cards" },
        features: { value: ["Search"] },
        approved: { value: "yes" },
        reference: [{ name: "replacement.txt", type: "text/plain", textContent: "updated reference" }],
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
      if (path === "/api/assistant/ask/stream") {
        submittedModel = JSON.parse(String(init?.body)).model;
        return new Response(`data: ${JSON.stringify({ done: true, answer: "Draft saved." })}\n\n`, {
          headers: { "Content-Type": "text/event-stream" },
        });
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
});
