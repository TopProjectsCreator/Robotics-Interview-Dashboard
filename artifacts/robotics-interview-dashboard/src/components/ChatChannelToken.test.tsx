import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatChannelToken } from "./ChatChannelToken";
import type { ChatChannelMention } from "@/lib/chat-mentions";

const channel: ChatChannelMention = {
  id: "chan-studio",
  token: "studio",
  name: "studio",
  emoji: null,
  memberCount: 2,
  kind: "channel",
};

const renderToken = (props: { onOpen?: (channelId: string) => void }) =>
  render(
    <TooltipProvider>
      <ChatChannelToken mentionText="#studio" channel={channel} {...props} />
    </TooltipProvider>,
  );

describe("ChatChannelToken", () => {
  it("renders a clickable button that reports the channel id", () => {
    const onOpen = vi.fn();
    renderToken({ onOpen });

    const token = screen.getByTestId("chat-channel-mention-studio");
    expect(token.tagName).toBe("BUTTON");
    expect(token).toHaveAccessibleName("studio channel, 2 members, click to open");
    fireEvent.click(token);
    expect(onOpen).toHaveBeenCalledWith("chan-studio");
  });

  it("renders an inert span when no open handler is provided", () => {
    renderToken({});

    const token = screen.getByTestId("chat-channel-mention-studio");
    expect(token.tagName).toBe("SPAN");
    expect(token).toHaveAttribute("tabindex", "0");
  });
});
