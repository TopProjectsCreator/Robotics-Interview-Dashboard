import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMentionPerson } from "@/lib/chat-mentions";

export function ChatMentionToken({
  mentionText,
  person,
}: {
  mentionText: string;
  person: ChatMentionPerson;
}) {
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${person.label}, ${person.detail}`}
          className="chat-mention"
          data-testid={`chat-mention-${person.token.toLowerCase().replaceAll(" ", "-")}`}
        >
          {mentionText}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" sideOffset={8} className="chat-mention-tooltip">
        <span className="chat-mention-avatar" aria-hidden="true">{person.initials}</span>
        <span className="min-w-0">
          <span className="chat-mention-tooltip-name block truncate">{person.label}</span>
          <span className="chat-mention-tooltip-detail block">{person.detail}</span>
          <span className="chat-mention-tooltip-handle block">{mentionText}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}