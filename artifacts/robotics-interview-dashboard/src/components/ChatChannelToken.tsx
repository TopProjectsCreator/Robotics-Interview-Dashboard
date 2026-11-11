import { Hash } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatChannelMention } from "@/lib/chat-mentions";

function channelAvatar(channel: ChatChannelMention) {
  const emoji = channel.emoji?.trim() ?? "";
  if (emoji && !emoji.startsWith(":")) return <span aria-hidden="true">{emoji}</span>;
  return <Hash size={16} strokeWidth={2.5} aria-hidden="true" />;
}

/**
 * Renders a `#channel-name` reference inside chat markdown. When `onOpen` is
 * provided the token is a button that jumps the chat to the referenced
 * channel; otherwise it renders as an inert tooltip-only span (the same
 * treatment people mentions get outside the chat composer).
 */
export function ChatChannelToken({
  mentionText,
  channel,
  onOpen,
}: {
  mentionText: string;
  channel: ChatChannelMention;
  onOpen?: (channelId: string) => void;
}) {
  const testId = `chat-channel-mention-${channel.name.toLowerCase().replaceAll(" ", "-")}`;
  const memberLabel = `${channel.memberCount} ${channel.memberCount === 1 ? "member" : "members"}`;
  const ariaLabel = `${channel.name} channel, ${memberLabel}${onOpen ? ", click to open" : ""}`;
  const className = "chat-channel-mention";
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        {onOpen
          ? <button type="button" onClick={() => onOpen(channel.id)} aria-label={ariaLabel} className={className} data-testid={testId}>{mentionText}</button>
          : <span tabIndex={0} aria-label={ariaLabel} className={className} data-testid={testId}>{mentionText}</span>}
      </TooltipTrigger>
      <TooltipContent side="top" align="start" sideOffset={8} className="chat-channel-tooltip">
        <span className="chat-channel-avatar" aria-hidden="true">{channelAvatar(channel)}</span>
        <span className="min-w-0">
          <span className="chat-channel-tooltip-name block truncate">{channel.name}</span>
          <span className="chat-channel-tooltip-detail block">Channel · {memberLabel}{onOpen ? " · Click to open" : ""}</span>
          <span className="chat-channel-tooltip-handle block">{mentionText}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
