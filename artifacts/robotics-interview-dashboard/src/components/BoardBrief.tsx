import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import DOMPurify from "dompurify";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { buildTeamMentionPeople } from "../lib/chat-mentions";
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";

const BRIEF_LIMIT = 12_000;
const SAFE_BRIEF_TAGS = [
  "blockquote", "br", "code", "em", "h1", "h2", "h3", "li", "ol",
  "p", "pre", "s", "strong", "u", "ul",
];
const RICH_BRIEF_START = /^\s*<(?:p|h[1-3]|ul|ol|blockquote|pre|div)(?:\s|>)/i;

export type BriefMention = { token: string; label: string; detail: string; initials: string };

export function filterBoardBriefMentions(mentions: BriefMention[], query: string): BriefMention[] {
  const normalizedQuery = query.trim().toLowerCase();
  return mentions.filter(person =>
    !normalizedQuery || `${person.label} ${person.token} ${person.detail}`.toLowerCase().includes(normalizedQuery),
  ).slice(0, 8);
}

function isRichBrief(value: string): boolean {
  return RICH_BRIEF_START.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeBoardBriefHtml(value: string): string {
  const source = isRichBrief(value)
    ? value
    : value.split(/\r?\n/).map(line => `<p>${line ? escapeHtml(line) : "<br>"}</p>`).join("");
  return DOMPurify.sanitize(source, { ALLOWED_TAGS: SAFE_BRIEF_TAGS, ALLOWED_ATTR: [] });
}

export function boardBriefPlainText(value: string): string {
  if (!isRichBrief(value)) return value;
  const safe = DOMPurify.sanitize(value, { ALLOWED_TAGS: SAFE_BRIEF_TAGS, ALLOWED_ATTR: [] })
    .replace(/<\/(?:p|h[1-3]|li|blockquote|pre)>/gi, "\n");
  const container = document.createElement("div");
  container.innerHTML = safe;
  return (container.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function editorContent(value: string): string {
  return sanitizeBoardBriefHtml(value);
}

function serializeBrief(editor: Editor): string {
  const doc = editor.getJSON();
  const isPlainParagraph = doc.content?.every(node =>
    node.type === "paragraph" &&
    (node.content ?? []).every(child => child.type === "text" && !child.marks?.length),
  );
  if (isPlainParagraph) return editor.getText({ blockSeparator: "\n" });
  return DOMPurify.sanitize(editor.getHTML(), { ALLOWED_TAGS: SAFE_BRIEF_TAGS, ALLOWED_ATTR: [] });
}

function BriefToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      className={`board-brief-toolbar-button ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

export function BoardBriefEditor({
  value,
  onChange,
  mentions,
}: {
  value: string;
  onChange: (value: string) => void;
  mentions: BriefMention[];
}) {
  const [mentionRange, setMentionRange] = useState<{ from: number; to: number; query: string } | null>(null);
  const [activeMention, setActiveMention] = useState(0);
  const [toolbarRevision, setToolbarRevision] = useState(0);
  const activeMentionRef = useRef(0);
  const mentionRangeRef = useRef<typeof mentionRange>(null);
  const mentionsRef = useRef(mentions);
  const onChangeRef = useRef(onChange);
  const lastValidValue = useRef(value);
  const editorRef = useRef<Editor | null>(null);
  mentionsRef.current = mentions;
  onChangeRef.current = onChange;

  const setRange = (next: typeof mentionRange) => {
    const current = mentionRangeRef.current;
    if (
      current?.from === next?.from &&
      current?.to === next?.to &&
      current?.query === next?.query
    ) return;
    mentionRangeRef.current = next;
    setMentionRange(next);
    activeMentionRef.current = 0;
    setActiveMention(0);
  };

  const refreshMentionRange = (editor: Editor) => {
    const { selection } = editor.state;
    if (!selection.empty || !selection.$from.parent.isTextblock) {
      setRange(null);
      return;
    }
    const beforeCursor = selection.$from.parent.textContent.slice(0, selection.$from.parentOffset);
    const match = /(?:^|[^\p{L}\p{N}_.+\-])@([^\n]*)$/u.exec(beforeCursor);
    if (!match) {
      setRange(null);
      return;
    }
    const query = match[1];
    const from = selection.from - query.length - 1;
    setRange({ from, to: selection.from, query });
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: editorContent(value),
    onCreate: ({ editor: currentEditor }) => {
      currentEditor.commands.setTextSelection(currentEditor.state.doc.content.size);
    },
    onTransaction: () => setToolbarRevision(revision => revision + 1),
    editorProps: {
      attributes: {
        class: "board-brief-prose",
        "aria-label": "Brief",
        "aria-multiline": "true",
        "aria-autocomplete": "list",
        "aria-haspopup": "listbox",
        "aria-controls": "board-brief-mention-listbox",
        "aria-expanded": "false",
        "data-testid": "input-card-description",
        role: "textbox",
      },
      handleDOMEvents: {
        focus: () => {
          if (editorRef.current) refreshMentionRange(editorRef.current);
          return false;
        },
      },
      handleKeyDown: (_view, event) => {
        const range = mentionRangeRef.current;
        if (!range) return false;
        const matches = filterBoardBriefMentions(mentionsRef.current, range.query);
        if (!matches.length) {
          if (event.key === "Escape") {
            setRange(null);
            return true;
          }
          return false;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const nextIndex = (activeMentionRef.current + 1) % matches.length;
          activeMentionRef.current = nextIndex;
          setActiveMention(nextIndex);
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          const nextIndex = (activeMentionRef.current - 1 + matches.length) % matches.length;
          activeMentionRef.current = nextIndex;
          setActiveMention(nextIndex);
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setRange(null);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const selected = matches[activeMentionRef.current % matches.length];
          const currentEditor = editorRef.current;
          if (selected && currentEditor) {
            currentEditor.chain().focus().insertContentAt(
              { from: range.from, to: range.to },
              `@${selected.token} `,
            ).run();
            setRange(null);
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const next = serializeBrief(currentEditor);
      if (next.length > BRIEF_LIMIT) {
        currentEditor.commands.setContent(editorContent(lastValidValue.current), { emitUpdate: false });
        return;
      }
      lastValidValue.current = next;
      onChangeRef.current(next);
      refreshMentionRange(currentEditor);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => refreshMentionRange(currentEditor),
  });
  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    const current = serializeBrief(editor);
    if (lastValidValue.current !== value && value !== current) {
      lastValidValue.current = value;
      editor.commands.setContent(editorContent(value), { emitUpdate: false });
    }
  }, [editor, value]);

  const filteredMentions = useMemo(() => {
    if (!mentionRange) return [];
    return filterBoardBriefMentions(mentions, mentionRange.query);
  }, [mentionRange, mentions]);
  void toolbarRevision;

  useEffect(() => {
    if (!editor) return;
    const surface = editor.view.dom;
    if (mentionRange && filteredMentions.length) {
      surface.setAttribute("aria-expanded", "true");
      surface.setAttribute("aria-activedescendant", `board-brief-mention-option-${activeMention}`);
    } else {
      surface.setAttribute("aria-expanded", "false");
      surface.removeAttribute("aria-activedescendant");
    }
  }, [activeMention, editor, filteredMentions.length, mentionRange]);

  const insertMention = (person: BriefMention) => {
    const range = mentionRangeRef.current;
    if (!editor || !range) return;
    editor.chain().focus().insertContentAt(
      { from: range.from, to: range.to },
      `@${person.token} `,
    ).run();
    setRange(null);
  };

  return (
    <div className="board-brief-editor" data-testid="board-brief-editor">
      <div className="board-brief-toolbar" role="toolbar" aria-label="Brief formatting">
        {editor && <>
          <BriefToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></BriefToolbarButton>
          <BriefToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></BriefToolbarButton>
          <BriefToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></BriefToolbarButton>
          <BriefToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></BriefToolbarButton>
          <span className="board-brief-toolbar-separator" aria-hidden="true" />
          <BriefToolbarButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></BriefToolbarButton>
          <BriefToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></BriefToolbarButton>
          <BriefToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></BriefToolbarButton>
        </>}
      </div>
      <div className="board-brief-writing-area">
        <div onFocus={() => { if (editor) refreshMentionRange(editor); }}>
          <EditorContent editor={editor} />
        </div>
        {mentionRange && filteredMentions.length > 0 && (
          <div id="board-brief-mention-listbox" className="board-brief-mention-picker" role="listbox" aria-label="Mention a teammate" data-testid="board-brief-mention-picker">
            {filteredMentions.map((person, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeMention}
                id={`board-brief-mention-option-${index}`}
                key={person.token}
                onMouseDown={event => event.preventDefault()}
                onClick={() => insertMention(person)}
                className="board-brief-mention-option"
                data-testid={`board-brief-mention-${index}`}
              >
                <span className="board-brief-mention-avatar" aria-hidden="true">{person.initials}</span>
                <span className="min-w-0"><span className="block truncate text-xs font-semibold">{person.label}</span><span className="block truncate text-[10px] text-muted-foreground">{person.detail}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="board-brief-editor-footer">
        <span>Use @ to mention a teammate</span>
        <span>{(value.length).toLocaleString()} / {BRIEF_LIMIT.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function BoardBriefPreview({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div
      className={`board-brief-preview ${className}`}
      data-testid="board-brief-preview"
      dangerouslySetInnerHTML={{ __html: sanitizeBoardBriefHtml(value) }}
    />
  );
}

export function boardBriefMentions(names: string[]): BriefMention[] {
  return buildTeamMentionPeople(names).map(({ token, label, detail, initials }) => ({
    token,
    label,
    detail,
    initials,
  }));
}
