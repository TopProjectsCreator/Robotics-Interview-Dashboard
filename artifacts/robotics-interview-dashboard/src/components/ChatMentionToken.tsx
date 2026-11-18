import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMentionPerson } from "@/lib/chat-mentions";

export function ChatMentionToken({
  mentionText,
  person,
  onOpen,
}: {
  mentionText: string;
  person: ChatMentionPerson;
  onOpen?: (person: ChatMentionPerson) => void;
}) {
  const interactive = Boolean(onOpen) && person.kind === "interviewer";
  const ariaLabel = `${person.label}, ${person.detail}${interactive ? ", click to open direct message" : ""}`;
  const className = "chat-mention";
  const testId = `chat-mention-${person.token.toLowerCase().replaceAll(" ", "-")}`;
  const handleClick = () => {
    if (interactive && onOpen) onOpen(person);
  };
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        {interactive
          ? <button type="button" onClick={handleClick} aria-label={ariaLabel} className={className} data-testid={testId}>{mentionText}</button>
          : <span tabIndex={0} aria-label={ariaLabel} className={className} data-testid={testId}>{mentionText}</span>}
      </TooltipTrigger>
      <TooltipContent side="top" align="start" sideOffset={8} className="chat-mention-tooltip">
        <span className="chat-mention-avatar" aria-hidden="true">{person.initials}</span>
        <span className="min-w-0">
          <span className="chat-mention-tooltip-name block truncate">{person.label}</span>
          <span className="chat-mention-tooltip-detail block">{person.detail}{interactive ? " · Click to open DM" : ""}</span>
          <span className="chat-mention-tooltip-handle block">{mentionText}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
