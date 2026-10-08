import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CodeWorkspacePage } from "./CodeWorkspacePage";

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listFiles: vi.fn(),
  listRevisions: vi.fn(),
  askAssistant: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getListCodeProjectsQueryKey: () => ["/api/code/projects"],
  getListCodeFilesQueryKey: (projectId: string) => ["/api/code/files", projectId],
  getListCodeRevisionsQueryKey: (projectId: string) => ["/api/code/revisions", projectId],
  getListCodePresenceQueryKey: (projectId: string) => ["/api/code/presence", projectId],
  getGetSessionQueryKey: () => ["/api/auth/session"],
  useListCodeProjects: mocks.listProjects,
  useListCodeFiles: mocks.listFiles,
  useListCodeRevisions: mocks.listRevisions,
  useCreateCodeProject: () => ({ mutate: vi.fn() }),
  useUpdateCodeProject: () => ({ mutate: vi.fn() }),
  useDeleteCodeProject: () => ({ mutate: vi.fn() }),
  useCreateCodeFile: () => ({ mutate: vi.fn() }),
  useUpdateCodeFile: () => ({ mutate: vi.fn() }),
  useDeleteCodeFile: () => ({ mutate: vi.fn() }),
  useCreateCodeRevision: () => ({ mutate: vi.fn() }),
  useListCodePresence: () => ({ data: { presence: [] } }),
  useUpdateCodePresence: () => ({ mutate: vi.fn() }),
  useAskAssistant: mocks.askAssistant,
  useGetSession: mocks.getSession,
  createCodeProject: vi.fn(),
  updateCodeProject: vi.fn(),
  deleteCodeProject: vi.fn(),
  createCodeFile: vi.fn(),
  updateCodeFile: vi.fn(),
  deleteCodeFile: vi.fn(),
  createCodeRevision: vi.fn(),
  deployCodeProject: vi.fn(),
  listCodeFiles: vi.fn(),
  listCodePresence: vi.fn().mockResolvedValue({ presence: [] }),
  listCodeRevisions: vi.fn(),
  updateCodePresence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/dialogs", () => ({
  askValue: vi.fn(),
  confirmAction: vi.fn(),
}));

const project = {
  id: "project-1",
  name: "BioBuzz Bot",
  sdkVersion: "v12.0",
  gitConfig: {},
  fileCount: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const file = {
  id: "file-1",
  projectId: "project-1",
  path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/BioBuzzTankTeleOp.java",
  content: "public class BioBuzzTankTeleOp extends LinearOpMode {}",
  sizeBytes: 10,
  updatedBy: "Ada",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function renderPage(withProject: typeof project | null) {
  mocks.listProjects.mockReturnValue({
    data: { projects: withProject ? [withProject] : [] },
    isLoading: false,
  });
  mocks.listFiles.mockReturnValue({
    data: { files: withProject ? [file] : [] },
    isLoading: false,
  });
  mocks.listRevisions.mockReturnValue({ data: { revisions: [] } });
  mocks.askAssistant.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mocks.getSession.mockReturnValue({ data: { label: "Ada", role: "coordinator" } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CodeWorkspacePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("code workspace", () => {
  it("prompts for a first project when none exists", () => {
    renderPage(null);
    expect(screen.getByTestId("code-new-project-empty")).toBeInTheDocument();
  });

  it("shows the file tree, side tabs, and deploy actions", () => {
    renderPage(project);
    expect(screen.getByTestId("code-project-name")).toHaveTextContent("BioBuzz Bot");
    expect(screen.getByTestId("code-file-TeamCode/src/main/java/org/firstinspires/ftc/teamcode/BioBuzzTankTeleOp.java")).toBeInTheDocument();
    for (const tab of ["explorer", "git", "ai", "deploy"]) {
      expect(screen.getByTestId(`code-side-${tab}`)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByTestId("code-side-deploy"));
    expect(screen.getByTestId("code-deploy-zip")).toBeInTheDocument();
    expect(screen.getByTestId("code-usb-connect")).toBeInTheDocument();
    expect(screen.getByTestId("code-serial-toggle")).toBeInTheDocument();
  });

  it("opens the git pane with endpoint, history, and commit controls", () => {
    renderPage(project);
    fireEvent.click(screen.getByTestId("code-side-git"));
    expect(screen.getByTestId("code-git-url")).toBeInTheDocument();
    expect(screen.getByTestId("code-git-clone")).toBeInTheDocument();
    expect(screen.getByTestId("code-git-commit-push")).toBeInTheDocument();
  });

  it("opens the AI pane with prompt and line-range editing", () => {
    renderPage(project);
    fireEvent.click(screen.getByTestId("code-side-ai"));
    expect(screen.getByTestId("code-ai-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("code-ai-ask")).toBeInTheDocument();
  });

  it("uploads straight from the dashboard without opening the hub site", () => {
    renderPage(project);
    fireEvent.click(screen.getByTestId("code-side-deploy"));
    expect(screen.getByTestId("code-hub-url")).toBeInTheDocument();
    expect(screen.getByTestId("code-deploy-upload")).toBeInTheDocument();
    expect(screen.getByTestId("code-deploy-browser")).toBeInTheDocument();
    expect(screen.queryByTestId("code-deploy-manage")).not.toBeInTheDocument();
  });

  it("keeps JDK 21 and Java 8 visible in the status bar", () => {
    renderPage(project);
    expect(screen.getByTestId("code-statusbar")).toHaveTextContent("JDK 21");
    expect(screen.getByTestId("code-statusbar")).toHaveTextContent("Java 8");
  });
});
