import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BoardBriefEditor,
  BoardBriefPreview,
  boardBriefMentions,
  boardBriefPlainText,
  filterBoardBriefMentions,
  sanitizeBoardBriefHtml,
} from "./BoardBrief";

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
});

const teammates = boardBriefMentions(["Riley Chen", "Maksim"]);

describe("coordination board briefs", () => {
  it("keeps legacy plain text readable and escapes markup-looking text", () => {
    const legacy = "Old handoff\n<img src=x onerror=alert(1)>";
    expect(boardBriefPlainText(legacy)).toBe(legacy);
    expect(sanitizeBoardBriefHtml(legacy)).toContain("&lt;img");
    expect(sanitizeBoardBriefHtml(legacy)).not.toContain("<img");
  });

  it("extracts readable text from formatted content without exposing unsafe tags", () => {
    const brief = '<h2>Handoff</h2><p><strong>Ready</strong> for @Riley Chen</p><script>alert(1)</script><img src=x onerror=alert(1)>';
    expect(boardBriefPlainText(brief)).toBe("Handoff\nReady for @Riley Chen");
    const clean = sanitizeBoardBriefHtml(brief);
    expect(clean).toContain("<strong>Ready</strong>");
    expect(clean).not.toMatch(/script|img|onerror/i);
  });

  it("renders safe rich formatting and preserves legacy descriptions in previews", () => {
    const { rerender } = render(<BoardBriefPreview value={'<p><strong>Bold handoff</strong></p><img src=x onerror=alert(1)>'} />);
    expect(screen.getByTestId("board-brief-preview").querySelector("strong")).toHaveTextContent("Bold handoff");
    expect(screen.getByTestId("board-brief-preview").querySelector("img")).toBeNull();
    rerender(<BoardBriefPreview value={"Legacy handoff\nKeep the original wording"} />);
    expect(screen.getByText("Legacy handoff")).toBeInTheDocument();
    expect(screen.getByText("Keep the original wording")).toBeInTheDocument();
  });

  it("builds the same teammate and group identities used by chat", () => {
    expect(boardBriefMentions(["Riley Chen", "riley chen", "Maksim"])).toEqual([
      { token: "all", label: "All team members", detail: "Everyone in this space", initials: "∗" },
      { token: "Riley Chen", label: "Riley Chen", detail: "Interviewer · tryout team", initials: "RC" },
      { token: "Maksim", label: "Maksim", detail: "Interviewer · tryout team", initials: "M" },
    ]);
    expect(filterBoardBriefMentions(teammates, "rile")).toHaveLength(1);
    expect(filterBoardBriefMentions(teammates, "rile")[0].token).toBe("Riley Chen");
  });

  it("opens with formatted or legacy content and exposes keyboard-accessible formatting controls", () => {
    const onChange = vi.fn();
    const { rerender, unmount } = render(
      <BoardBriefEditor value="Legacy handoff" onChange={onChange} mentions={teammates} />,
    );
    expect(screen.getByTestId("input-card-description")).toHaveTextContent("Legacy handoff");
    expect(screen.getByRole("toolbar", { name: "Brief formatting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list" }));
    expect(screen.getByRole("button", { name: "Bulleted list" })).toHaveAttribute("aria-pressed", "true");
    rerender(
      <BoardBriefEditor value="<p><strong>Saved handoff</strong></p>" onChange={onChange} mentions={teammates} />,
    );
    expect(screen.getByTestId("input-card-description").querySelector("strong")).toHaveTextContent("Saved handoff");
    unmount();
    render(<BoardBriefEditor value="<p><strong>Saved handoff</strong></p>" onChange={onChange} mentions={teammates} />);
    expect(screen.getByTestId("input-card-description").querySelector("strong")).toHaveTextContent("Saved handoff");
  });

  it("shows searchable teammate suggestions and inserts the selected mention", async () => {
    const onChange = vi.fn();
    render(<BoardBriefEditor value="<p>@R</p>" onChange={onChange} mentions={teammates} />);
    const surface = screen.getByTestId("input-card-description");
    surface.focus();
    fireEvent.keyDown(surface, { key: "End" });

    await waitFor(() => expect(screen.getByTestId("board-brief-mention-picker")).toBeInTheDocument());
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.keyDown(surface, { key: "ArrowDown" });
    fireEvent.keyDown(surface, { key: "Enter" });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toContain("@Riley Chen");
  });

  it("allows pointer selection from the teammate picker", async () => {
    const onChange = vi.fn();
    render(<BoardBriefEditor value="<p>@M</p>" onChange={onChange} mentions={teammates} />);
    const surface = screen.getByTestId("input-card-description");
    surface.focus();
    fireEvent.keyDown(surface, { key: "End" });
    await waitFor(() => expect(screen.getByTestId("board-brief-mention-picker")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("board-brief-mention-2"));
    await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain("@Maksim"));
  });
});
