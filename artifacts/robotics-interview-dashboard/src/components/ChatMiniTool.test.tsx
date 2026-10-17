import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMiniTool, InvalidChatMiniTool, parseChatMiniToolPayload } from "./ChatMiniTool";

describe("chat mini-tools", () => {
  it("runs a quiz locally and reports the answer", () => {
    render(<ChatMiniTool tool={{
      type: "quiz",
      title: "Safety check",
      prompt: "What should you wear?",
      options: ["Safety glasses", "Sandals"],
      answerIndex: 0,
    }} />);

    fireEvent.click(screen.getByRole("button", { name: "Safety glasses" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByRole("status")).toHaveTextContent("Correct.");
  });

  it("keeps checklist and counter interactions inside the rendered component", () => {
    const checklist = render(<ChatMiniTool tool={{
      type: "checklist",
      title: "Prep",
      items: ["Charge the battery"],
    }} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Charge the battery" }));
    expect(screen.getByRole("checkbox")).toBeChecked();

    checklist.unmount();
    const { container } = render(<ChatMiniTool tool={{
      type: "counter",
      title: "Parts",
      label: "Motors",
      initial: 1,
      step: 1,
      min: 0,
      max: 2,
    }} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Motors" }));
    expect(screen.getByTestId("chat-mini-tool-count")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Increase Motors" })).toBeDisabled();
    expect(container.querySelector("iframe, script, a, form")).not.toBeInTheDocument();
  });

  it("rejects invalid, unsupported, and oversized payloads with a safe fallback", () => {
    expect(parseChatMiniToolPayload(JSON.stringify({
      type: "quiz",
      title: "Broken",
      prompt: "Choose",
      options: ["A", "B"],
      answerIndex: 8,
    }))).toBeNull();
    expect(parseChatMiniToolPayload(JSON.stringify({
      type: "hosted-app",
      title: "External",
      html: "<script>fetch('/api/private')</script>",
    }))).toBeNull();
    expect(parseChatMiniToolPayload("x".repeat(6_001))).toBeNull();

    render(<InvalidChatMiniTool />);
    expect(screen.getByRole("status")).toHaveTextContent("This interactive preview is unavailable.");
  });
});
