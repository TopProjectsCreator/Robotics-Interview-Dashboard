import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTeamAssessmentBody } from "@workspace/api-zod";

const mocks = vi.hoisted(() => ({
  useGetSession: vi.fn(),
  useListTeamAssessments: vi.fn(),
  useGetRequiredTeamAssessments: vi.fn(),
  useGetTeamAssessment: vi.fn(),
  useGetTeamAssessmentResults: vi.fn(),
  useCreateTeamAssessment: vi.fn(),
  useUpdateTeamAssessment: vi.fn(),
  usePublishTeamAssessment: vi.fn(),
  usePauseTeamAssessment: vi.fn(),
  useSubmitTeamAssessment: vi.fn(),
  useRequestTeamAssessmentUploadUrl: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  publishMutate: vi.fn(),
  pauseMutate: vi.fn(),
  submitMutate: vi.fn(),
  uploadMutateAsync: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetRequiredTeamAssessmentsQueryKey: () => ["/api/team-assessments/required"],
  getGetTeamAssessmentQueryKey: (id: string) => ["/api/team-assessments", id],
  getGetTeamAssessmentResultsQueryKey: (id: string) => ["/api/team-assessments", id, "results"],
  getListTeamAssessmentsQueryKey: () => ["/api/team-assessments"],
  useGetSession: mocks.useGetSession,
  useListTeamAssessments: mocks.useListTeamAssessments,
  useGetRequiredTeamAssessments: mocks.useGetRequiredTeamAssessments,
  useGetTeamAssessment: mocks.useGetTeamAssessment,
  useGetTeamAssessmentResults: mocks.useGetTeamAssessmentResults,
  useCreateTeamAssessment: mocks.useCreateTeamAssessment,
  useUpdateTeamAssessment: mocks.useUpdateTeamAssessment,
  usePublishTeamAssessment: mocks.usePublishTeamAssessment,
  usePauseTeamAssessment: mocks.usePauseTeamAssessment,
  useSubmitTeamAssessment: mocks.useSubmitTeamAssessment,
  useRequestTeamAssessmentUploadUrl: mocks.useRequestTeamAssessmentUploadUrl,
}));

import {
  RequiredAssessmentFlow,
  TeamAssessmentEditorPage,
  TeamAssessmentResultsPage,
  TeamAssessmentsPage,
} from "./TeamAssessmentsPage";
import type { TeamAssessment, TeamAssessmentResults } from "@workspace/api-client-react";

const questions: TeamAssessment["questions"] = [
  { id: "single", type: "single_choice", prompt: "Choose one", required: true, options: ["Red", "Blue"], correctAnswers: ["Blue"] },
  { id: "multiple", type: "multiple_choice", prompt: "Choose all", required: true, options: ["One", "Two", "Three"], correctAnswers: ["One"] },
  { id: "text", type: "long_answer", prompt: "Explain your plan", required: true },
  { id: "likert", type: "likert", prompt: "Rate confidence", required: true, options: ["Low", "Medium", "High"] },
  { id: "ranking", type: "ranking", prompt: "Rank priorities", required: true, options: ["Safety", "Speed", "Cost"] },
  { id: "upload", type: "file_upload", prompt: "Attach a file", required: true, fileLimit: 2 },
  { id: "slider", type: "slider", prompt: "Set confidence", required: true, min: 0, max: 10, step: 1 },
  { id: "theme", type: "style_picker", prompt: "Choose a style", required: true, options: ["robotics", "ocean"] },
];

const assessment: TeamAssessment = {
  id: "assessment-1",
  title: "Robot readiness",
  description: "Complete this before entering the workspace.",
  kind: "quiz",
  status: "draft",
  required: true,
  stylePreset: "robotics",
  questions,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderWithRouter(ui: ReactNode, initialLocation = "/") {
  window.history.replaceState({}, "", initialLocation);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}><Router>{ui}</Router></QueryClientProvider>);
}

function nativeFileDrop(files: File[]) {
  return { dataTransfer: { files, types: ["Files"], dropEffect: "none" } };
}

function resetHooks() {
  mocks.useGetSession.mockReturnValue({ data: { authenticated: true, role: "coordinator" } });
  mocks.useListTeamAssessments.mockReturnValue({ data: { items: [] }, isLoading: false, isError: false, refetch: vi.fn() });
  mocks.useGetRequiredTeamAssessments.mockReturnValue({ data: { items: [] }, isLoading: false });
  mocks.useGetTeamAssessment.mockReturnValue({ data: assessment, isLoading: false, isError: false, refetch: vi.fn() });
  mocks.useGetTeamAssessmentResults.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mocks.useCreateTeamAssessment.mockReturnValue({ mutate: mocks.createMutate, isPending: false });
  mocks.useUpdateTeamAssessment.mockReturnValue({ mutate: mocks.updateMutate, isPending: false });
  mocks.usePublishTeamAssessment.mockReturnValue({ mutate: mocks.publishMutate, isPending: false });
  mocks.usePauseTeamAssessment.mockReturnValue({ mutate: mocks.pauseMutate, isPending: false });
  mocks.useSubmitTeamAssessment.mockReturnValue({ mutate: mocks.submitMutate, isPending: false });
  mocks.useRequestTeamAssessmentUploadUrl.mockReturnValue({ mutateAsync: mocks.uploadMutateAsync });
  mocks.uploadMutateAsync.mockResolvedValue({
    uploadURL: "https://storage.example/upload",
    objectPath: "/objects/team-assessments/team-1/member-1/assessment-1/123e4567-e89b-12d3-a456-426614174000",
  });
}

beforeEach(() => {
  resetHooks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  vi.stubGlobal("confirm", vi.fn(() => true));
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("team assessment experiences", () => {
  it("lets coordinators start a team assessment draft", () => {
    mocks.createMutate.mockImplementation((_variables, callbacks) => {
      callbacks.onSuccess({ ...assessment, id: "created-assessment" });
    });
    renderWithRouter(<TeamAssessmentsPage embedded />);

    expect(screen.getByRole("heading", { name: "Team assessments" })).toBeInTheDocument();
    expect(screen.getByTestId("team-assessments-settings-content")).toBeInTheDocument();
    expect(screen.getByTestId("assessment-list-empty")).toHaveTextContent("No assessments yet");
    fireEvent.click(screen.getByTestId("button-create-assessment"));

    expect(mocks.createMutate).toHaveBeenCalledTimes(1);
    const payload = mocks.createMutate.mock.calls[0][0].data;
    expect(payload).toMatchObject({
      kind: "quiz",
      required: true,
      questions: [{
        type: "single_choice",
        prompt: "New question",
        options: ["Option 1", "Option 2"],
        correctAnswers: ["Option 1"],
      }],
    });
    expect(CreateTeamAssessmentBody.safeParse(payload).success).toBe(true);
    expect(screen.getByTestId("input-assessment-title")).toHaveValue("Robot readiness");
  });

  it("shows a recoverable list error and retries the team assessment request", async () => {
    let recovered = false;
    const refetch = vi.fn(() => {
      recovered = true;
    });
    mocks.useListTeamAssessments.mockImplementation(() => recovered
      ? { data: { items: [{ ...assessment, assignedCount: 0, responseCount: 0 }] }, isLoading: false, isError: false, refetch }
      : { data: undefined, error: new Error("The database is temporarily unavailable."), isLoading: false, isError: true, refetch });
    function RetryHarness() {
      const [, setRevision] = useState(0);
      return <div>
        <TeamAssessmentsPage embedded />
        <button type="button" onClick={() => setRevision((value) => value + 1)}>Refresh test view</button>
      </div>;
    }
    renderWithRouter(<RetryHarness />);

    expect(screen.getByText("The database is temporarily unavailable.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-retry-assessments"));
    expect(refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh test view" }));
    expect(screen.getByTestId("card-team-assessment-assessment-1")).toBeInTheDocument();
    expect(screen.queryByTestId("button-retry-assessments")).not.toBeInTheDocument();
  });

  it("shows draft creation failures and clears the pending button state", async () => {
    mocks.useCreateTeamAssessment.mockImplementation(() => {
      const [isPending, setIsPending] = useState(false);
      return {
        isPending,
        mutate: (_variables: unknown, callbacks: { onError: (error: Error) => void }) => {
          setIsPending(true);
          setTimeout(() => {
            callbacks.onError(new Error("The database is temporarily unavailable."));
            setIsPending(false);
          }, 0);
        },
      };
    });
    renderWithRouter(<TeamAssessmentsPage embedded />);

    fireEvent.click(screen.getByTestId("button-create-assessment"));

    await waitFor(() => expect(screen.getByTestId("assessment-action-error")).toHaveTextContent("The database is temporarily unavailable."));
    expect(screen.getByTestId("button-create-assessment")).toBeEnabled();
    expect(screen.queryByText("Creating assessment…")).not.toBeInTheDocument();
  });

  it("keeps edit and results flows inside Settings and returns to the assessment list", () => {
    const results: TeamAssessmentResults = {
      assessment: { ...assessment, status: "published" },
      assignedCount: 1,
      responseCount: 0,
      completions: [],
      summaries: [],
    };
    mocks.useListTeamAssessments.mockReturnValue({
      data: { items: [{ ...assessment, status: "draft" }] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useGetTeamAssessmentResults.mockReturnValue({ data: results, isLoading: false, isError: false, refetch: vi.fn() });
    renderWithRouter(<TeamAssessmentsPage embedded />);

    fireEvent.click(screen.getByTestId("button-edit-assessment-assessment-1"));
    expect(screen.getByTestId("input-assessment-title")).toHaveValue("Robot readiness");
    fireEvent.click(screen.getByTestId("button-back-assessments"));
    expect(screen.getByTestId("card-team-assessment-assessment-1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-results-assessment-assessment-1"));
    expect(screen.getByLabelText("Completion summary")).toHaveTextContent("0%");
    fireEvent.click(screen.getByTestId("button-results-back"));
    expect(screen.getByTestId("card-team-assessment-assessment-1")).toBeInTheDocument();
  });

  it("shows the required assessment flow without a workspace shell and returns to the interrupted route", async () => {
    const requiredAssessment: TeamAssessment = {
      ...assessment,
      status: "published",
      questions: [{ id: "response", type: "long_answer", prompt: "What is your plan?", required: true }],
    };
    let outstanding = [requiredAssessment];
    let refreshFlow: () => void = () => {};
    function CompletionHarness() {
      const [, setRevision] = useState(0);
      refreshFlow = () => setRevision((revision) => revision + 1);
      return <RequiredAssessmentFlow items={[requiredAssessment]} />;
    }
    mocks.useGetRequiredTeamAssessments.mockImplementation(() => ({
      data: { items: outstanding },
      isLoading: false,
    }));
    mocks.submitMutate.mockImplementation((_variables, callbacks) => {
      outstanding = [];
      callbacks.onSuccess();
      refreshFlow();
    });
    renderWithRouter(<CompletionHarness />, "/chat?tab=team");

    expect(screen.getByRole("main").className).toContain("min-h-[100dvh]");
    expect(screen.queryByTestId("workspace-header")).not.toBeInTheDocument();
    expect(document.querySelector("#workspace-sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("assessment-response-form-assessment-1")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("team-assessment-return-path")).toBe("/chat?tab=team");

    fireEvent.change(screen.getByTestId("input-assessment-answer-response"), {
      target: { value: "Check the robot before the match." },
    });
    fireEvent.click(screen.getByTestId("button-submit-assessment-assessment-1"));
    expect(mocks.submitMutate).toHaveBeenCalledTimes(1);

    expect(await screen.findByTestId("assessment-gate-complete")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-return-to-workspace"));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/chat");
      expect(window.location.search).toBe("?tab=team");
    });
    expect(window.sessionStorage.getItem("team-assessment-return-path")).toBeNull();
  });

  it.each([
    "/team-assessments",
    "/team-assessments/assessment-1/edit",
    "/team-assessments/assessment-1/results",
  ])("remembers a directly visited assessment URL for the completion gate: %s", (path) => {
    mocks.useGetRequiredTeamAssessments.mockReturnValue({
      data: { items: [assessment] },
      isLoading: false,
    });
    renderWithRouter(<RequiredAssessmentFlow items={[assessment]} />, path);

    expect(screen.getByTestId("assessment-response-form-assessment-1")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("team-assessment-return-path")).toBe(path);
  });

  it("renders all eight response formats with a safe theme picker", () => {
    const memberAssessment: TeamAssessment = {
      ...assessment,
      questions: questions.map(({ correctAnswers: _correctAnswers, ...question }) => question),
    };
    mocks.useGetRequiredTeamAssessments.mockReturnValue({
      data: { items: [memberAssessment] },
      isLoading: false,
    });
    renderWithRouter(<RequiredAssessmentFlow items={[memberAssessment]} />);

    for (const question of questions) {
      expect(screen.getByTestId(`fieldset-assessment-question-${question.id}`)).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Red" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Two" })).toBeInTheDocument();
    expect(screen.getByTestId("input-assessment-answer-text")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "High" })).toBeInTheDocument();
    expect(screen.getByTestId("button-rank-up-ranking-1")).toBeInTheDocument();
    expect(screen.getByTestId("input-assessment-file-upload")).toBeInTheDocument();
    expect(screen.getByTestId("input-assessment-slider-slider")).toBeInTheDocument();
    expect(screen.getByTestId("button-style-answer-theme-ocean")).toBeInTheDocument();
    expect(screen.queryByText(/correct choice/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-rank-up-ranking-1"));
    expect(screen.getByTestId("button-style-answer-theme-ocean")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByTestId("button-style-answer-theme-ocean"));
    expect(screen.getByTestId("button-style-answer-theme-ocean")).toHaveAttribute("aria-pressed", "true");
  });

  it("uploads supported member files privately and exposes removal", async () => {
    mocks.useGetRequiredTeamAssessments.mockReturnValue({
      data: { items: [assessment] },
      isLoading: false,
    });
    const fetchMock = vi.mocked(fetch);
    renderWithRouter(<RequiredAssessmentFlow items={[assessment]} />);
    const file = new File(["proof"], "proof.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("input-assessment-file-upload"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/proof.pdf/)).toBeInTheDocument());
    expect(mocks.uploadMutateAsync).toHaveBeenCalledWith({
      assessmentId: "assessment-1",
      data: { name: "proof.pdf", size: file.size, contentType: "application/pdf" },
    });
    expect(fetchMock).toHaveBeenCalledWith("https://storage.example/upload", expect.objectContaining({ method: "PUT" }));

    fireEvent.click(screen.getByTestId("button-remove-assessment-file-upload"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/storage/objects/team-assessments/"),
      expect.objectContaining({ method: "DELETE" }),
    ));
  });

  it("routes dropped assessment attachments through the existing count and upload validation", async () => {
    mocks.useGetRequiredTeamAssessments.mockReturnValue({
      data: { items: [assessment] },
      isLoading: false,
    });
    renderWithRouter(<RequiredAssessmentFlow items={[assessment]} />);
    const input = screen.getByTestId("input-assessment-file-upload");
    const dropTarget = input.parentElement!;

    fireEvent.drop(dropTarget, nativeFileDrop([
      new File(["one"], "one.pdf", { type: "application/pdf" }),
      new File(["two"], "two.pdf", { type: "application/pdf" }),
      new File(["three"], "three.pdf", { type: "application/pdf" }),
    ]));
    expect(await screen.findByTestId("assessment-upload-error")).toHaveTextContent("Choose no more than 2 file(s)");
    expect(mocks.uploadMutateAsync).not.toHaveBeenCalled();

    fireEvent.drop(dropTarget, nativeFileDrop([
      new File(["one"], "one.pdf", { type: "application/pdf" }),
      new File(["two"], "two.pdf", { type: "application/pdf" }),
    ]));
    await waitFor(() => expect(mocks.uploadMutateAsync).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/one\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/two\.pdf/)).toBeInTheDocument();
  });

  it("saves a readable draft and provides a respondent preview", () => {
    const editorAssessment = { ...assessment, status: "draft" as const };
    mocks.useGetTeamAssessment.mockReturnValue({ data: editorAssessment, isLoading: false, isError: false, refetch: vi.fn() });
    renderWithRouter(<TeamAssessmentEditorPage assessmentId={assessment.id} />);

    expect(screen.getByTestId("input-assessment-title")).toHaveValue("Robot readiness");
    expect(screen.getByTestId("select-assessment-kind")).toHaveValue("quiz");
    fireEvent.click(screen.getByTestId("button-toggle-assessment-preview"));
    expect(screen.getByTestId("assessment-preview")).toHaveTextContent("Robot readiness");
    expect(screen.getByTestId("assessment-preview-form")).toBeInTheDocument();
    expect(screen.getByTestId("input-assessment-answer-text")).not.toBeDisabled();
  });

  it("shows completion, score, and individual answers to the results viewer", () => {
    const results: TeamAssessmentResults = {
      assessment: { ...assessment, status: "published" },
      assignedCount: 2,
      responseCount: 1,
      completions: [
        { interviewerId: "member-1", memberName: "Member One", status: "submitted", score: 1, maxScore: 2, submittedAt: "2026-01-01T10:00:00.000Z", answers: { single: { value: "Blue" } } },
        { interviewerId: "member-2", memberName: "Member Two", status: "pending", score: null, maxScore: null, submittedAt: null, answers: null },
      ],
      summaries: [{ questionId: "single", answeredCount: 1, distribution: [{ value: "Blue", count: 1 }] }],
    };
    mocks.useGetTeamAssessmentResults.mockReturnValue({ data: results, isLoading: false, isError: false, refetch: vi.fn() });
    renderWithRouter(<TeamAssessmentResultsPage assessmentId={assessment.id} />);

    expect(screen.getByLabelText("Completion summary")).toHaveTextContent("50%");
    expect(screen.getByTestId("button-response-member-member-2")).toHaveTextContent("Pending");
    fireEvent.click(screen.getByTestId("button-response-member-member-1"));
    expect(screen.getByTestId("assessment-individual-response")).toHaveTextContent("Member One");
    expect(screen.getByTestId("assessment-individual-response")).toHaveTextContent("Blue");
    expect(screen.getByTestId("button-export-assessment-results")).toBeInTheDocument();
  });
});
