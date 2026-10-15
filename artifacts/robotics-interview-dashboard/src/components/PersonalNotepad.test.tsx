import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PersonalNotepad } from "./PersonalNotepad";

describe("PersonalNotepad", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads rich text for the signed-in account and exposes formatting controls", () => {
    localStorage.setItem("robotics-personal-notepad:interviewer-1", "<h2>Practice plan</h2><p><strong>Bring the robot.</strong></p>");
    render(<PersonalNotepad accountKey="interviewer-1" onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Personal notepad" })).toBeInTheDocument();
    expect(screen.getByTestId("personal-notepad-editor")).toHaveTextContent("Practice plan");
    expect(screen.getByTestId("personal-notepad-editor").querySelector("strong")).toHaveTextContent("Bring the robot.");
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulleted list" })).toBeInTheDocument();
  });

  it("saves edited content locally and closes from the dialog button", async () => {
    const onClose = vi.fn();
    render(<PersonalNotepad accountKey="interviewer-2" onClose={onClose} />);
    const editor = screen.getByTestId("personal-notepad-editor");
    editor.innerHTML = "<p>Remember to update the build log.</p>";
    fireEvent.input(editor);

    await waitFor(() => {
      expect(localStorage.getItem("robotics-personal-notepad:interviewer-2")).toContain("update the build log");
    });
    fireEvent.click(screen.getByTestId("button-close-notepad"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
