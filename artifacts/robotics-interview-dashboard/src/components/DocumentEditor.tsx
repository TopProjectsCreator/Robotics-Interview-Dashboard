import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import TextAlign from "@tiptap/extension-text-align";
import UnderlineExtension from "@tiptap/extension-underline";
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
  const [documentSaveStatus, setDocumentSaveStatus] = useState<"saving" | "saved">("saved");
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
        UnderlineExtension,
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
  const autosaveLabel = error ? "Save needs attention" : isSaving ? "Saving changes" : "All changes saved";
  const autosaveIcon = error
    ? <CircleAlert size={14} />
    : isSaving
      ? <LoaderCircle size={14} className="animate-spin" />
      : <CircleCheck size={14} />;

  return (
    <div className="document-editor fixed inset-0 z-[80] flex min-h-[100dvh] flex-col overflow-hidden bg-[#edf2f1] text-[#183a4b]" role="dialog" aria-modal="true" aria-label="Shared interview document" data-testid="document-editor">
      <style>{`
        .document-editor .document-prose { min-height: 760px; padding: 72px 78px 130px; outline: none; color: #263f49; font-family: "Space Grotesk", sans-serif; font-size: 16px; line-height: 1.75; }
        .document-editor .document-prose > *:first-child { margin-top: 0; }
        .document-editor .document-prose h1, .document-editor .document-prose h2, .document-editor .document-prose h3 { color: #183a4b; letter-spacing: -.045em; line-height: 1.15; }
        .document-editor .document-prose h1 { margin: 1.5em 0 .55em; font-size: 2.45rem; }
        .document-editor .document-prose h2 { margin: 1.35em 0 .5em; font-size: 1.8rem; }
        .document-editor .document-prose h3 { margin: 1.25em 0 .45em; font-size: 1.35rem; }
        .document-editor .document-prose p { margin: .65em 0; }
        .document-editor .document-prose ul, .document-editor .document-prose ol { padding-left: 1.5rem; }
        .document-editor .document-prose blockquote { margin: 1.2rem 0; padding-left: 1rem; border-left: 3px solid #f1c44d; color: #567079; font-style: italic; }
        .document-editor .document-prose code { border-radius: 5px; background: #e8f0ef; padding: .15em .35em; color: #116c79; font-family: "DM Mono", monospace; font-size: .88em; }
        .document-editor .document-prose pre { overflow-x: auto; border-radius: 10px; background: #183a4b; padding: 1rem; color: #eff8f6; }
        .document-editor .document-prose pre code { background: transparent; color: inherit; }
        .document-editor .document-prose hr { margin: 2rem 0; border: 0; border-top: 1px solid #dce5e5; }
        .document-editor .document-toolbar-button { display: inline-flex; height: 32px; min-width: 32px; align-items: center; justify-content: center; border: 0; border-radius: 7px; color: #52666e; background: transparent; transition: background-color .16s ease, color .16s ease; }
        .document-editor .document-toolbar-button:hover { background: #e8f3f1; color: #12737d; }
        .document-editor .document-toolbar-button:disabled { cursor: not-allowed; opacity: .38; }
        .document-editor .document-toolbar-button-active { background: #dff2ef; color: #106d7a; }
        .document-editor .collaboration-carets__caret { position: relative; margin-left: -1px; border-left: 2px solid var(--caret-color, #16869a); border-right: 0; pointer-events: none; }
        .document-editor .collaboration-carets__label { position: absolute; z-index: 5; top: -1.45em; left: -2px; padding: 2px 6px; border-radius: 4px 4px 4px 0; color: #fff; background: var(--caret-color, #16869a); font: 600 10px/1.25 "Space Grotesk", sans-serif; white-space: nowrap; }
        @media (max-width: 700px) { .document-editor .document-prose { min-height: 680px; padding: 42px 25px 100px; font-size: 15px; } .document-editor .document-prose h1 { font-size: 2rem; } }
      `}</style>

      <header className="shrink-0 border-b border-[#d8e3e2] bg-[#fbfcfa] shadow-[0_2px_10px_rgba(24,58,75,0.07)]">
        <div className="flex min-h-[70px] items-center justify-between gap-4 px-4 py-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#183a4b] text-[#f1c44d] shadow-sm" aria-hidden="true">
              <FileText size={19} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#16869a]">Tryout team workspace</span>
                <span className="hidden text-[10px] text-[#a0afb0] sm:inline">/</span>
                <span className="hidden text-[10px] text-[#7c8c91] sm:inline">shared plan</span>
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={saveTitleNow}
                maxLength={120}
                aria-label="Document title"
                data-testid="input-document-title"
                className="mt-0.5 w-full max-w-[500px] bg-transparent text-lg font-semibold tracking-[-.025em] text-[#183a4b] outline-none placeholder:text-[#9aa9ad]"
                placeholder="Name this interview plan"
              />
              <p className="mt-0.5 hidden text-[10px] text-[#819196] sm:block" data-testid="text-document-meta">
                {documentRecord.createdBy ? `Created by ${documentRecord.createdBy} · ` : ""}{formatUpdatedAt(documentRecord.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 lg:flex" data-testid="status-document-autosave" aria-live="polite">
              <span className={`${error ? "text-[#ad4b43]" : isSaving ? "text-[#b27a1d]" : "text-[#3d8b6a]"}`}>{autosaveIcon}</span>
              <span className="text-[11px] font-semibold text-[#657b82]">{autosaveLabel}</span>
            </div>
            <button type="button" onClick={() => { saveTitleNow(); onClose(); }} aria-label="Close document" data-testid="button-close-document" className="flex h-9 items-center gap-1.5 rounded-lg border border-[#d5e0e0] bg-[#fbfcfa] px-2.5 text-xs font-semibold text-[#52666e] transition hover:border-[#183a4b] hover:text-[#183a4b]">
              <X size={15} />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f1] px-4 py-2 sm:px-7">
          <div className="flex min-w-0 items-center gap-1">
            <ToolbarButton label="Undo" testId="button-document-undo" disabled={!editor?.can().undo()} onClick={() => run((currentEditor) => currentEditor.chain().focus().undo().run())}><Undo2 size={16} /></ToolbarButton>
            <ToolbarButton label="Redo" testId="button-document-redo" disabled={!editor?.can().redo()} onClick={() => run((currentEditor) => currentEditor.chain().focus().redo().run())}><Redo2 size={16} /></ToolbarButton>
            <span className="mx-2 h-5 w-px bg-[#dfe8e7]" />
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
                className="h-8 appearance-none rounded-lg border-0 bg-transparent py-1 pl-2 pr-7 text-xs font-semibold text-[#52666e] outline-none hover:bg-[#e8f3f1]"
              >
                <option value="paragraph">Body</option>
                <option value="heading-1">Heading 1</option>
                <option value="heading-2">Heading 2</option>
                <option value="heading-3">Heading 3</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-1.5 text-[#7c8c91]" />
            </label>
            <span className="mx-2 h-5 w-px bg-[#dfe8e7]" />
            <ToolbarButton label="Bold" testId="button-document-bold" active={Boolean(editor?.isActive("bold"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleBold().run())}><Bold size={16} /></ToolbarButton>
            <ToolbarButton label="Italic" testId="button-document-italic" active={Boolean(editor?.isActive("italic"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleItalic().run())}><Italic size={16} /></ToolbarButton>
            <ToolbarButton label="Underline" testId="button-document-underline" active={Boolean(editor?.isActive("underline"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleMark("underline").run())}><Underline size={16} /></ToolbarButton>
            <ToolbarButton label="Strikethrough" testId="button-document-strike" active={Boolean(editor?.isActive("strike"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleStrike().run())}><Strikethrough size={16} /></ToolbarButton>
            <span className="mx-2 h-5 w-px bg-[#dfe8e7]" />
            <ToolbarButton label="Bulleted list" testId="button-document-bullet-list" active={Boolean(editor?.isActive("bulletList"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleBulletList().run())}><List size={17} /></ToolbarButton>
            <ToolbarButton label="Numbered list" testId="button-document-ordered-list" active={Boolean(editor?.isActive("orderedList"))} onClick={() => run((currentEditor) => currentEditor.chain().focus().toggleOrderedList().run())}><ListOrdered size={17} /></ToolbarButton>
            <span className="mx-2 h-5 w-px bg-[#dfe8e7]" />
            <ToolbarButton label="Align left" testId="button-document-align-left" active={activeAlignment === "left"} onClick={() => setAlignment("left")}><AlignLeft size={16} /></ToolbarButton>
            <ToolbarButton label="Align center" testId="button-document-align-center" active={activeAlignment === "center"} onClick={() => setAlignment("center")}><AlignCenter size={16} /></ToolbarButton>
            <ToolbarButton label="Align right" testId="button-document-align-right" active={activeAlignment === "right"} onClick={() => setAlignment("right")}><AlignRight size={16} /></ToolbarButton>
            <ToolbarButton label="Justify text" testId="button-document-align-justify" active={activeAlignment === "justify"} onClick={() => setAlignment("justify")}><AlignJustify size={16} /></ToolbarButton>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2" data-testid="status-document-collaboration" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${collaborationStatus === "connected" ? "bg-[#39a97e]" : collaborationStatus === "reconnecting" ? "bg-[#d9a63c]" : "bg-[#8da3a5]"}`} />
              <span className="text-[11px] font-semibold text-[#657b82]">{connectionLabel}</span>
            </div>
            <div className="flex items-center gap-2" data-testid="text-collaborator-count" aria-label={`${participants.length} interviewer${participants.length === 1 ? "" : "s"} in this document`}>
              <div className="flex -space-x-1.5">
                {participants.slice(0, 4).map((participant, index) => (
                  <span key={`${participant.name}-${index}`} title={participant.name} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#fbfcfa] text-[9px] font-bold text-white" style={{ backgroundColor: participant.color }} data-testid={`avatar-collaborator-${index}`}>
                    {initialsFor(participant.name)}
                  </span>
                ))}
              </div>
              <span className="hidden text-[11px] font-semibold text-[#657b82] sm:inline"><Users size={13} className="mr-1 inline-block -translate-y-px" />{participants.length}</span>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="flex shrink-0 items-center gap-2 border-b border-[#efc9c5] bg-[#fff4f2] px-4 py-2 text-xs font-semibold text-[#ad4b43] sm:px-7" role="alert" data-testid="status-document-error"><CircleAlert size={14} />{error}</div>}

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-8 sm:py-9">
        <div className="mx-auto min-h-[calc(100dvh-190px)] w-full max-w-[850px] border border-[#e0e8e5] bg-[#fffefa] shadow-[0_13px_35px_rgba(31,64,72,0.12),0_2px_5px_rgba(31,64,72,0.06)]">
          {editor ? <EditorContent editor={editor} /> : <div className="min-h-[760px] animate-pulse bg-[#fffefa]" data-testid="status-document-loading" />}
        </div>
        <p className="mx-auto mt-4 max-w-[850px] text-center text-[10px] uppercase tracking-[.13em] text-[#91a2a2]" data-testid="text-document-footer">Shared notes stay with the tryout team</p>
      </main>
    </div>
  );
}
