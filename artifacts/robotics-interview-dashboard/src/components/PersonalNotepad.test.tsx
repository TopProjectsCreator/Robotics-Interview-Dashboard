import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  noteData: { content: "", updatedAt: null as string | null },
  mutateAsync: vi.fn(),
  queryArgs: [] as unknown[],
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetPersonalNotepadQueryKey: () => ["/api/auth/personal-notepad"],
  useGetPersonalNotepad: (options: unknown) => {
    mocks.queryArgs.push(options);
    return {
      data: mocks.noteData,
      isSuccess: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
  useUpdatePersonalNotepad: () => ({ mutateAsync: mocks.mutateAsync }),
}));

import { PersonalNotepad } from "./PersonalNotepad";

describe("PersonalNotepad", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.noteData = { content: "<h2>Practice plan</h2><p><strong>Bring the robot.</strong></p>", updatedAt: null };
    mocks.mutateAsync.mockReset().mockImplementation(async ({ data }: { data: { content: string } }) => ({
      content: data.content,
      updatedAt: new Date().toISOString(),
    }));
    mocks.queryArgs.length = 0;
  });

  it("loads rich text from the account's cloud note and exposes formatting controls", async () => {
    render(<PersonalNotepad accountKey="interviewer-1" onClose={vi.fn()} />);

    expect(await screen.findByRole("dialog", { name: "Personal notepad" })).toBeInTheDocument();
    expect(await screen.findByText("Practice plan")).toBeInTheDocument();
    expect(screen.getByTestId("personal-notepad-editor").querySelector("strong")).toHaveTextContent("Bring the robot.");
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulleted list" })).toBeInTheDocument();
    expect(mocks.queryArgs[0]).toEqual({ query: { queryKey: ["/api/auth/personal-notepad", "interviewer-1"], enabled: true } });
    expect(screen.getByText("Private to your account · saved to the cloud")).toBeInTheDocument();
  });

  it("autosaves edits to the cloud and waits for a pending save before closing", async () => {
    const onClose = vi.fn();
    render(<PersonalNotepad accountKey="interviewer-2" onClose={onClose} />);
    const editor = await screen.findByTestId("personal-notepad-editor");
    editor.innerHTML = "<p>Remember to update the build log.</p>";
    fireEvent.input(editor);

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        data: { content: "<p>Remember to update the build log.</p>" },
      });
    }, { timeout: 2500 });
    await waitFor(() => expect(screen.getByText("Saved to your account in the cloud.")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("button-close-notepad"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("migrates an existing device note into cloud storage", async () => {
    localStorage.setItem("robotics-personal-notepad:interviewer-3", "<p>Older device note</p>");
    mocks.noteData = { content: "", updatedAt: null };
    render(<PersonalNotepad accountKey="interviewer-3" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ data: { content: "<p>Older device note</p>" } });
      expect(localStorage.getItem("robotics-personal-notepad:interviewer-3")).toBeNull();
    }, { timeout: 2500 });
  });
});
