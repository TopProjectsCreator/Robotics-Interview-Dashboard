import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatConversationDropdown, type ChatConversationGroup } from "./ChatConversationDropdown";

const groups: ChatConversationGroup[] = [
  { options: [{ value: "team", label: "Team conversation" }] },
  {
    label: "Direct messages",
    options: [
      { value: "direct:Leo Park", label: "To Leo Park", unread: true },
      { value: "direct:Avery Kim", label: "To Avery Kim" },
    ],
  },
  {
    label: "Channels",
    options: [{ value: "channel:pit-crew", label: "# pit-crew", unread: true }],
  },
];

function renderDropdown(onChange = vi.fn()) {
  render(<ChatConversationDropdown value="team" groups={groups} onChange={onChange} />);
  return { onChange, trigger: screen.getByTestId("select-chat-conversation") };
}

describe("ChatConversationDropdown", () => {
  it("is a hand-built listbox, not a native select, and opens on click", () => {
    const { trigger } = renderDropdown();
    expect(document.querySelector("select")).toBeNull();
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("data-value", "team");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByTestId("chat-conversation-menu")).toBeInTheDocument();
  });

  it("marks unread conversations red instead of writing a New label", () => {
    const { trigger } = renderDropdown();
    fireEvent.click(trigger);

    const unread = screen.getByTestId("chat-conversation-option-direct:Leo Park");
    expect(unread).toHaveClass("text-[#c9393a]");
    expect(screen.getByTestId("chat-unread-dot-direct:Leo Park")).toBeInTheDocument();
    expect(screen.getByTestId("chat-conversation-menu").textContent).not.toMatch(/new/i);

    const read = screen.getByTestId("chat-conversation-option-direct:Avery Kim");
    expect(read).not.toHaveClass("text-[#c9393a]");
    expect(screen.queryByTestId("chat-unread-dot-direct:Avery Kim")).toBeNull();
  });

  it("selects an option and closes the menu", () => {
    const { onChange, trigger } = renderDropdown();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("chat-conversation-option-channel:pit-crew"));

    expect(onChange).toHaveBeenCalledWith("channel:pit-crew");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports keyboard navigation and Escape to dismiss", () => {
    const { onChange, trigger } = renderDropdown();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const teamOption = screen.getByTestId("chat-conversation-option-team");
    fireEvent.keyDown(teamOption, { key: "ArrowDown" });
    const nextOption = screen.getByTestId("chat-conversation-option-direct:Leo Park");
    fireEvent.keyDown(nextOption, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("direct:Leo Park");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByTestId("chat-conversation-option-team"), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when clicking outside", () => {
    const { trigger } = renderDropdown();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
