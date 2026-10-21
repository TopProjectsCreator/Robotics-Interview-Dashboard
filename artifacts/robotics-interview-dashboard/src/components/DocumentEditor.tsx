import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileText,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Users,
  X,
} from "lucide-react";
import type { Awareness } from "y-protocols/awareness";
import { createDocumentCollaboration } from "./documentCollaboration";

export type DocumentRecord = {
  id: string;
  title: string;
  data: string;
  createdBy: string;
  updatedAt: string;
};

export type DocumentEditorProps = {
  document: DocumentRecord;
  activeInterviewer: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onTitleSave: (title: string) => void;
};

type CollaborationStatus = "connecting" | "connected" | "reconnecting";
type Alignment = "left" | "center" | "right" | "justify";

const CURSOR_COLORS = ["#16869a", "#d27a3a", "#7d67b6", "#3f8c68", "#b14d61"];

function colorForInterviewer(name: string) {
  const score = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return CURSOR_COLORS[score % CURSOR_COLORS.length];
}

function initialsFor(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "IT";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently updated";
  return `updated ${date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

function ToolbarButton({
  label,
  testId,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  testId: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`document-toolbar-button ${active ? "document-toolbar-button-active" : ""}`}
    >
      {children}
    </button>
  );
}

export function DocumentEditor({
  document: documentRecord,
  activeInterviewer,
  saving,
  error,
  onClose,
  onTitleSave,
}: DocumentEditorProps) {
  const collaboration = useMemo(
    () =>
      createDocumentCollaboration(documentRecord.id, documentRecord.data, {
        name: activeInterviewer,
        color: colorForInterviewer(activeInterviewer),
      }),
    [activeInterviewer, documentRecord.id],
  );
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationStatus>("connecting");
  const [documentSaveStatus, setDocumentSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [awarenessVersion, setAwarenessVersion] = useState(0);
  const [activeAlignment, setActiveAlignment] = useState<Alignment>("left");
  const [title, setTitle] = useState(documentRecord.title);
  const lastSavedTitleRef = useRef(documentRecord.title);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDocumentIdRef = useRef(documentRecord.id);
  const awareness = collaboration.provider.awareness as Awareness;

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Collaboration.configure({ document: collaboration.doc }),
        CollaborationCaret.configure({
          provider: collaboration.provider,
          user: { name: activeInterviewer, color: colorForInterviewer(activeInterviewer) },
        }),
      ],
      editorProps: {
        attributes: {
          class: "document-prose",
          spellcheck: "true",
          "data-testid": "document-writing-surface",
        },
      },
    },
    [collaboration, activeInterviewer],
  );

  useEffect(() => {
    const unsubscribeStatus = collaboration.subscribeStatus(setCollaborationStatus);
    const unsubscribeSaveStatus = collaboration.subscribeSaveStatus(setDocumentSaveStatus);
    const unsubscribeTitle = collaboration.subscribeTitle((nextTitle) => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      setTitle((currentTitle) => {
        const normalizedCurrent = currentTitle.trim() || "Untitled interview plan";
        if (normalizedCurrent !== lastSavedTitleRef.current && normalizedCurrent !== nextTitle) return currentTitle;
        lastSavedTitleRef.current = nextTitle;
        return nextTitle;
      });
    });
    const refreshAwareness = () => setAwarenessVersion((version) => version + 1);
    awareness.on("change", refreshAwareness);
    refreshAwareness();
    return () => {
      awareness.off("change", refreshAwareness);
      unsubscribeStatus();
      unsubscribeSaveStatus();
      unsubscribeTitle();
      collaboration.destroy();
    };
  }, [awareness, collaboration]);

  useEffect(() => {
    if (titleDocumentIdRef.current === documentRecord.id) return;
    titleDocumentIdRef.current = documentRecord.id;
    lastSavedTitleRef.current = documentRecord.title;
    setTitle(documentRecord.title);
  }, [documentRecord.id, documentRecord.title]);

  const saveTitleNow = useCallback(() => {
    const nextTitle = title.trim() || "Untitled interview plan";
    if (nextTitle === lastSavedTitleRef.current) return;
    lastSavedTitleRef.current = nextTitle;
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = null;
    collaboration.provider.setTitle(nextTitle);
    onTitleSave(nextTitle);
  }, [collaboration.provider, onTitleSave, title]);

  useEffect(() => {
    const nextTitle = title.trim() || "Untitled interview plan";
    if (nextTitle === lastSavedTitleRef.current || titleDocumentIdRef.current !== documentRecord.id) return;
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      lastSavedTitleRef.current = nextTitle;
        collaboration.provider.setTitle(nextTitle);
      onTitleSave(nextTitle);
      titleTimerRef.current = null;
    }, 650);
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, [collaboration.provider, documentRecord.id, onTitleSave, title]);

  useEffect(
    () => () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    },
    [],
  );

  const participants = useMemo(() => {
    void awarenessVersion;
    const people = Array.from(awareness.getStates().values()).map((state, index) => {
      const user = state.user as { name?: unknown; color?: unknown } | undefined;
      const name = typeof user?.name === "string" && user.name.trim() ? user.name : `Interviewer ${index + 1}`;
      return {
        name,
        color: typeof user?.color === "string" ? user.color : colorForInterviewer(name),
      };
    });
    if (!people.some((person) => person.name.toLowerCase() === activeInterviewer.toLowerCase())) {
      people.unshift({ name: activeInterviewer, color: colorForInterviewer(activeInterviewer) });
    }
    return people;
  }, [activeInterviewer, awareness, awarenessVersion]);

  const run = useCallback((command: (currentEditor: NonNullable<typeof editor>) => void) => {
    if (!editor) return;
    command(editor);
  }, [editor]);

  const setAlignment = (alignment: Alignment) => {
    setActiveAlignment(alignment);
    run((currentEditor) => {
      const chain = currentEditor.chain().focus() as unknown as {
        setTextAlign: (value: Alignment) => { run: () => boolean };
      };
      chain.setTextAlign(alignment).run();
    });
  };

  const headingValue = editor?.isActive("heading", { level: 1 })
    ? "heading-1"
    : editor?.isActive("heading", { level: 2 })
      ? "heading-2"
      : editor?.isActive("heading", { level: 3 })
        ? "heading-3"
        : "paragraph";
  const connectionLabel = collaborationStatus === "connected"
    ? "Live collaboration"
    : collaborationStatus === "reconnecting"
      ? "Reconnecting"
      : "Connecting";
  const isSaving = saving || documentSaveStatus === "saving";
  const saveError = error || (documentSaveStatus === "error"
    ? "A document change could not be saved. Your latest edits are not saved."
    : "");
  const autosaveLabel = saveError ? "Save needs attention" : isSaving ? "Saving changes" : "All changes saved";
  const autosaveIcon = saveError
    ? <CircleAlert size={14} />
    : isSaving
      ? <LoaderCircle size={14} className="animate-spin" />
      : <CircleCheck size={14} />;

  return (
    <div className="document-editor fixed inset-0 z-[80] flex min-h-[100dvh] flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Shared interview document" data-testid="document-editor">

      <header className="shrink-0 border-b">
        <div className="flex min-h-[70px] items-center justify-between gap-4 px-4 py-3 sm:px-7"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar text-sidebar-primary shadow-sm" aria-hidden="true">
              <FileText size={19} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="document-eyebrow text-[10px] font-bold uppercase tracking-[.16em]">Tryout team workspace</span>
                <span className="document-breadcrumb hidden text-[10px] sm:inline">/</span>
                <span className="document-breadcrumb hidden text-[10px] sm:inline">shared plan</span>
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={saveTitleNow}
                maxLength={120}
                aria-label="Document title"
                data-testid="input-document-title"
                className="document-title-input mt-0.5 w-full max-w-[500px] bg-transparent text-lg font-semibold tracking-[-.025em] outline-none"
                placeholder="Name this interview plan"
              />
              <p className="document-meta mt-0.5 hidden text-[10px] sm:block" data-testid="text-document-meta">
                {documentRecord.createdBy ? `Created by ${documentRecord.createdBy} · ` : ""}{formatUpdatedAt(documentRecord.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 lg:flex" data-testid="status-document-autosave" aria-live="polite">
              <span className="document-save-icon" data-state={saveError ? "error" : isSaving ? "saving" : "saved"}>{autosaveIcon}</span>
              <span className="document-save-text text-[11px] font-semibold">{autosaveLabel}</span>
            </div>
            <button type="button" onClick={() => { saveTitleNow(); onClose(); }} aria-label="Close document" data-testid="button-close-document" className="document-close-button flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition">
              <X size={15} />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>
        <div className="document-toolbar flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 sm:px-7">
          <div className="flex min-w-0 items-center gap-1">
            <ToolbarButton label="Undo" testId="button-document-undo" disabled={!editor?.can().undo()} onClick={() => run((currentEditor) => currentEditor.chain().focus().undo().run())}><Undo2 size={16} /></ToolbarButton>
            <ToolbarButton label="Redo" testId="button-document-redo" disabled={!editor?.can().redo()} onClick={() => run((currentEditor) => currentEditor.chain().focus().redo().run())}><Redo2 size={16} /></ToolbarButton>
            <span className="document-toolbar-separator mx-2 h-5 w-px" />
            <label className="relative flex h-8 items-center">
              <span className="sr-only">Text style</span>
              <select
                value={headingValue}
                onChange={(event) => run((currentEditor) => {
                  const value = event.target.value;
                  if (value === "paragraph") currentEditor.chain().focus().setParagraph().run();
                  else currentEditor.chain().focus().toggleHeading({ level: Number(value.split("-")[1]) as 1 | 2 | 3 }).run();
                })}
                data-testid="select-document-heading"
                className="document-style-select h-8 appearance-none rounded-lg border-0 bg-transparent py-1 pl-2 pr-7 text-base md:text-xs font-semibold outline-none"
              >
                <option value="paragraph">Body</option>
                <option value="heading-1">Heading 1</option>
                <option value="heading-2">Heading 2</option>
                <option value="heading-3">Heading 3</option>
              </select>
              <ChevronDown size={13} className="document-muted-icon pointer-events-none absolute right-1.5" />
            </label>
            <span className="document-toolbar-separator mx-2 h-5 w-px" />
            <ToolbarButton label="Bold" testId="button-document-bold" active={Boolean(editor?.isActive("bold"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleBold().run())}><Bold size={16} /></ToolbarButton>
            <ToolbarButton label="Italic" testId="button-document-italic" active={Boolean(editor?.isActive("italic"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleItalic().run())}><Italic size={16} /></ToolbarButton>
            <ToolbarButton label="Underline" testId="button-document-underline" active={Boolean(editor?.isActive("underline"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleMark("underline").run())}><Underline size={16} /></ToolbarButton>
            <ToolbarButton label="Strikethrough" testId="button-document-strike" active={Boolean(editor?.isActive("strike"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleStrike().run())}><Strikethrough size={16} /></ToolbarButton>
            <span className="document-toolbar-separator mx-2 h-5 w-px" />
            <ToolbarButton label="Bulleted list" testId="button-document-bullet-list" active={Boolean(editor?.isActive("bulletList"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleBulletList().run())}><List size={17} /></ToolbarButton>
            <ToolbarButton label="Numbered list" testId="button-document-ordered-list" active={Boolean(editor?.isActive("orderedList"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleOrderedList().run())}><ListOrdered size={17} /></ToolbarButton>
            <span className="document-toolbar-separator mx-2 h-5 w-px" />
            <ToolbarButton label="Align left" testId="button-document-align-left" active={activeAlignment === "left"} onClick={() => setAlignment("left")}><AlignLeft size={16} /></ToolbarButton>
            <ToolbarButton label="Align center" testId="button-document-align-center" active={activeAlignment === "center"} onClick={() => setAlignment("center")}><AlignCenter size={16} /></ToolbarButton>
            <ToolbarButton label="Align right" testId="button-document-align-right" active={activeAlignment === "right"} onClick={() => setAlignment("right")}><AlignRight size={16} /></ToolbarButton>
            <ToolbarButton label="Justify text" testId="button-document-align-justify" active={activeAlignment === "justify"} onClick={() => setAlignment("justify")}><AlignJustify size={16} /></ToolbarButton>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2" data-testid="status-document-collaboration" aria-live="polite">
              <span className="document-collaboration-dot h-2 w-2 rounded-full" data-status={collaborationStatus} />
              <span className="document-muted-text text-[11px] font-semibold">{connectionLabel}</span>
            </div>
            <div className="flex items-center gap-2" data-testid="text-collaborator-count" aria-label={`${participants.length} interviewer${participants.length === 1 ? "" : "s"} in this document`}>
              <div className="flex -space-x-1.5">
                {participants.slice(0, 4).map((participant, index) => (
                  <span key={`${participant.name}-${index}`} title={participant.name} className="document-collaborator-avatar flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white" style={{ backgroundColor: participant.color }} data-testid={`avatar-collaborator-${index}`}>
                    {initialsFor(participant.name)}
                  </span>
                ))}
              </div>
              <span className="document-muted-text hidden text-[11px] font-semibold sm:inline"><Users size={13} className="mr-1 inline-block -translate-y-px" />{participants.length}</span>
            </div>
          </div>
        </div>
      </header>

      {saveError && <div className="document-save-error flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs font-semibold sm:px-7" role="alert" data-testid="status-document-error"><CircleAlert size={14} />{saveError}</div>}

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-8 sm:py-9">
        <div className="document-paper mx-auto min-h-[calc(100dvh-190px)] w-full max-w-[850px]">
          {editor ? <EditorContent editor={editor} /> : <div className="document-loading-surface min-h-[760px] animate-pulse" data-testid="status-document-loading" />}
        </div>
        <p className="document-footer mx-auto mt-4 max-w-[850px] text-center text-[10px] uppercase tracking-[.13em]" data-testid="text-document-footer">Shared notes stay with the tryout team</p>
      </main>
    </div>
  );
}
