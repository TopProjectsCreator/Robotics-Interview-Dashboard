import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  useListTinyUrls: vi.fn(),
  useCreateTinyUrl: vi.fn(),
  useDeleteTinyUrl: vi.fn(),
  createMutation: vi.fn(),
  deleteMutation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-client-react")>();
  return {
    ...actual,
    useListTinyUrls: apiMocks.useListTinyUrls,
    useCreateTinyUrl: apiMocks.useCreateTinyUrl,
    useDeleteTinyUrl: apiMocks.useDeleteTinyUrl,
  };
});

import { TinyUrlsSettings } from "./TinyUrlsSettings";

const sampleItems = [
  {
    id: "id-tryouts",
    alias: "tryouts",
    path: "/t/tryouts",
    targetUrl: "https://forms.example.com/tryouts",
    clickCount: 12,
    createdByName: "Ishaan",
    createdAt: "2026-11-01T12:00:00.000Z",
  },
];

function mockList(overrides: Record<string, unknown> = {}) {
  apiMocks.useListTinyUrls.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { items: sampleItems },
    refetch: vi.fn(),
    ...overrides,
  });
}

function renderTool() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TinyUrlsSettings />
    </QueryClientProvider>,
  );
}

describe("TinyUrlsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList();
    apiMocks.createMutation.mockImplementation((_input, options) => options?.onSuccess?.({
      id: "id-new",
      alias: "tryouts",
      path: "/t/tryouts",
      targetUrl: "https://forms.example.com/tryouts",
      clickCount: 0,
      createdAt: "2026-11-14T12:00:00.000Z",
    }));
    apiMocks.deleteMutation.mockImplementation((_input, options) => options?.onSuccess?.());
    apiMocks.useCreateTinyUrl.mockReturnValue({ isPending: false, mutate: apiMocks.createMutation });
    apiMocks.useDeleteTinyUrl.mockReturnValue({ isPending: false, mutate: apiMocks.deleteMutation });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("lists existing links with aliases, click counts, and copy actions", () => {
    renderTool();
    expect(screen.getByText("/t/tryouts")).toBeInTheDocument();
    expect(screen.getByText("https://forms.example.com/tryouts")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("by Ishaan")).toBeInTheDocument();
  });

  it("copies the short link with the auto-detected domain", async () => {
    renderTool();
    fireEvent.click(screen.getByTestId("button-copy-tinyurl-tryouts"));
    await waitFor(() => expect(navigator.clipboard.writeText)
      .toHaveBeenCalledWith(`${window.location.origin}/t/tryouts`));
  });

  it("creates a link, reducing a pasted short link to its alias and upgrading a bare domain", async () => {
    renderTool();
    fireEvent.change(screen.getByTestId("input-tinyurl-target"), { target: { value: "forms.example.com/tryouts?form=2026" } });
    fireEvent.change(screen.getByTestId("input-tinyurl-alias"), { target: { value: "https://team.example.com/t/TryOuts" } });
    fireEvent.click(screen.getByTestId("button-create-tinyurl"));
    await waitFor(() => expect(apiMocks.createMutation).toHaveBeenCalledWith(
      { data: { alias: "tryouts", targetUrl: "https://forms.example.com/tryouts?form=2026" } },
      expect.any(Object),
    ));
  });

  it("shows the live preview with the detected domain", () => {
    renderTool();
    fireEvent.change(screen.getByTestId("input-tinyurl-alias"), { target: { value: "TryOuts" } });
    expect(screen.getByTestId("tinyurl-preview"))
      .toHaveTextContent(`${window.location.origin}/t/tryouts`);
  });

  it("rejects an invalid alias without calling the API", () => {
    renderTool();
    fireEvent.change(screen.getByTestId("input-tinyurl-target"), { target: { value: "https://example.com" } });
    fireEvent.change(screen.getByTestId("input-tinyurl-alias"), { target: { value: "-nope" } });
    fireEvent.click(screen.getByTestId("button-create-tinyurl"));
    expect(screen.getByTestId("tinyurl-error")).toHaveTextContent(/Aliases use letters, numbers/);
    expect(apiMocks.createMutation).not.toHaveBeenCalled();
  });

  it("rejects non-http(s) targets without calling the API", () => {
    renderTool();
    fireEvent.change(screen.getByTestId("input-tinyurl-target"), { target: { value: "javascript:alert(1)" } });
    fireEvent.change(screen.getByTestId("input-tinyurl-alias"), { target: { value: "evil" } });
    fireEvent.click(screen.getByTestId("button-create-tinyurl"));
    expect(screen.getByTestId("tinyurl-error")).toHaveTextContent(/Only http and https/);
    expect(apiMocks.createMutation).not.toHaveBeenCalled();
  });

  it("rejects targets with embedded credentials", () => {
    renderTool();
    fireEvent.change(screen.getByTestId("input-tinyurl-target"), { target: { value: "https://user:pass@example.com/" } });
    fireEvent.change(screen.getByTestId("input-tinyurl-alias"), { target: { value: "phish" } });
    fireEvent.click(screen.getByTestId("button-create-tinyurl"));
    expect(apiMocks.createMutation).not.toHaveBeenCalled();
  });

  it("deletes a link by id", async () => {
    renderTool();
    fireEvent.click(screen.getByTestId("button-delete-tinyurl-tryouts"));
    await waitFor(() => expect(apiMocks.deleteMutation).toHaveBeenCalledWith(
      { tinyUrlId: "id-tryouts" },
      expect.any(Object),
    ));
  });

  it("renders the empty state", () => {
    mockList({ data: { items: [] } });
    renderTool();
    expect(screen.getByTestId("tinyurl-empty")).toHaveTextContent("No tinyurls yet");
  });

  it("surfaces a server alias-taken error on the form", async () => {
    apiMocks.createMutation.mockImplementation((_input, options) => options?.onError?.({
      data: { error: "/t/tryouts is already taken. Choose another alias." },
    }));
    renderTool();
    fireEvent.change(screen.getByTestId("input-tinyurl-target"), { target: { value: "https://example.com" } });
    fireEvent.change(screen.getByTestId("input-tinyurl-alias"), { target: { value: "tryouts" } });
    fireEvent.click(screen.getByTestId("button-create-tinyurl"));
    await waitFor(() => expect(screen.getByTestId("tinyurl-error"))
      .toHaveTextContent("/t/tryouts is already taken."));
  });
});
