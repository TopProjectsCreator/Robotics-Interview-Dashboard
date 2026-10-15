import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  useGetSession: vi.fn(),
  useListFeatureRequests: vi.fn(),
  useGetSiteStats: vi.fn(),
  useCreateFeatureRequest: vi.fn(),
  useUpdateFeatureRequest: vi.fn(),
  useEditOwnFeatureRequest: vi.fn(),
  useDeleteOwnFeatureRequest: vi.fn(),
  editMutation: vi.fn(),
  deleteMutation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-client-react")>();
  return {
    ...actual,
    useGetSession: apiMocks.useGetSession,
    useListFeatureRequests: apiMocks.useListFeatureRequests,
    useGetSiteStats: apiMocks.useGetSiteStats,
    useCreateFeatureRequest: apiMocks.useCreateFeatureRequest,
    useUpdateFeatureRequest: apiMocks.useUpdateFeatureRequest,
    useEditOwnFeatureRequest: apiMocks.useEditOwnFeatureRequest,
    useDeleteOwnFeatureRequest: apiMocks.useDeleteOwnFeatureRequest,
  };
});

import { FeatureRequestSection } from "./App";
import { DialogHost } from "@/lib/dialogs";

describe("Settings app adjustment requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.useGetSession.mockReturnValue({ data: { isSiteOwner: false } });
    apiMocks.useListFeatureRequests.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "own-request",
            authorName: "Interviewer",
            message: "Add a workspace switcher",
            status: "open",
            createdAt: "2026-10-01T12:00:00.000Z",
            isMine: true,
          },
          {
            id: "teammate-request",
            authorName: "Teammate",
            message: "Improve the seating chart",
            status: "open",
            createdAt: "2026-10-02T12:00:00.000Z",
            isMine: false,
          },
        ],
      },
    });
    apiMocks.useGetSiteStats.mockReturnValue({ data: undefined });
    apiMocks.useCreateFeatureRequest.mockReturnValue({ isPending: false, mutate: vi.fn() });
    apiMocks.useUpdateFeatureRequest.mockReturnValue({ isPending: false, mutate: vi.fn() });
    apiMocks.editMutation.mockImplementation((_input, options) => options?.onSuccess?.());
    apiMocks.deleteMutation.mockImplementation((_input, options) => options?.onSuccess?.());
    apiMocks.useEditOwnFeatureRequest.mockReturnValue({ isPending: false, mutate: apiMocks.editMutation });
    apiMocks.useDeleteOwnFeatureRequest.mockReturnValue({ isPending: false, mutate: apiMocks.deleteMutation });
  });

  function renderSection() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <FeatureRequestSection />
        <DialogHost />
      </QueryClientProvider>,
    );
  }

  it("lets the author edit and delete their own suggestion, but not a teammate's", async () => {
    renderSection();

    expect(screen.getByTestId("button-edit-feature-request-own-request")).toBeInTheDocument();
    expect(screen.getByTestId("button-delete-feature-request-own-request")).toBeInTheDocument();
    expect(screen.queryByTestId("button-edit-feature-request-teammate-request")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-delete-feature-request-teammate-request")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-edit-feature-request-own-request"));
    const editor = screen.getByRole("textbox", { name: "Edit app adjustment" });
    fireEvent.change(editor, { target: { value: "Add a better workspace switcher" } });
    fireEvent.click(screen.getByTestId("button-save-feature-request-own-request"));
    await waitFor(() => expect(apiMocks.editMutation).toHaveBeenCalledWith(
      { requestId: "own-request", data: { message: "Add a better workspace switcher" } },
      expect.any(Object),
    ));

    fireEvent.click(screen.getByTestId("button-delete-feature-request-own-request"));
    await screen.findByTestId("app-dialog");
    fireEvent.click(screen.getByTestId("app-dialog-confirm"));
    await waitFor(() => expect(apiMocks.deleteMutation).toHaveBeenCalledWith(
      { requestId: "own-request" },
      expect.any(Object),
    ));
  });
});
