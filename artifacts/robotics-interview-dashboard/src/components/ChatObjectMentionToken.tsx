import { CalendarDays, ClipboardList, FilePenLine, FileSpreadsheet, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatObjectKind, ChatObjectMention } from "@/lib/chat-mentions";

const KIND_STYLE: Record<ChatObjectKind, { label: string; Icon: typeof FileText }> = {
  document: { label: "Document", Icon: FileText },
  whiteboard: { label: "Whiteboard", Icon: FilePenLine },
  board: { label: "Board", Icon: ClipboardList },
  spreadsheet: { label: "Spreadsheet", Icon: FileSpreadsheet },
  calendar: { label: "Calendar", Icon: CalendarDays },
};

/**
 * Renders an `@artifact-title` reference inside chat markdown as a button
 * that opens the referenced document, whiteboard, board, spreadsheet or
 * calendar. When
 * `onOpen` is omitted the token renders as an inert tooltip-only span (the
 * same treatment people mentions get outside the chat composer).
 */
export function ChatObjectMentionToken({
  mentionText,
  object,
  onOpen,
}: {
  mentionText: string;
  object: ChatObjectMention;
  onOpen?: (object: ChatObjectMention) => void;
}) {
  const { label, Icon } = KIND_STYLE[object.kind];
  const testId = `chat-object-mention-${object.id}`;
  const ariaLabel = `${label} ${object.title}${onOpen ? ", click to open" : ""}`;
  const className = "chat-object-mention";
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        {onOpen
          ? <button type="button" onClick={() => onOpen(object)} aria-label={ariaLabel} className={className} data-testid={testId}><Icon size={13} strokeWidth={2.4} aria-hidden="true" className="inline-block shrink-0 align-[-0.1em] mr-1" />{mentionText}</button>
          : <span tabIndex={0} aria-label={ariaLabel} className={className} data-testid={testId}><Icon size={13} strokeWidth={2.4} aria-hidden="true" className="inline-block shrink-0 align-[-0.1em] mr-1" />{mentionText}</span>}
      </TooltipTrigger>
      <TooltipContent side="top" align="start" sideOffset={8} className="chat-object-mention-tooltip">
        <span className="chat-object-mention-avatar" aria-hidden="true"><Icon size={15} /></span>
        <span className="min-w-0">
          <span className="chat-object-mention-tooltip-name block truncate">{object.title}</span>
          <span className="chat-object-mention-tooltip-detail block">{label}{onOpen ? " · Click to open" : ""}</span>
          <span className="chat-object-mention-tooltip-handle block">{mentionText}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
