import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  getGetPersonalNotepadQueryKey,
  useGetPersonalNotepad,
  useUpdatePersonalNotepad,
} from "@workspace/api-client-react";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from "lucide-react";

function loadLegacyNotepad(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function PersonalNotepad({ accountKey, onClose }: { accountKey: string; onClose: () => void }) {
  const legacyStorageKey = `robotics-personal-notepad:${accountKey}`;
  const queryKey = [...getGetPersonalNotepadQueryKey(), accountKey];
  const note = useGetPersonalNotepad({
    query: {
      queryKey,
      enabled: Boolean(accountKey),
      refetchInterval: 3000,
      refetchIntervalInBackground: false,
    },
  });
  const saveNote = useUpdatePersonalNotepad();
  const [content, setContent] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const hydratedRef = useRef(false);
  const loadedRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const latestContentRef = useRef("");
  const lastSavedRef = useRef<string | null>(null);
  const lastObservedUpdatedAtRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    content: "<p></p>",
    editable: false,
    editorProps: {
      attributes: {
        class: "personal-notepad-editor",
        "aria-label": "Notepad text",
        "data-testid": "personal-notepad-editor",
      },
    },
    onUpdate({ editor: activeEditor }) {
      if (!hydratedRef.current) return;
      const next = activeEditor.getHTML();
      hasUnsavedChangesRef.current = next !== lastSavedRef.current;
      latestContentRef.current = next;
      setContent(next);
      if (hasUnsavedChangesRef.current) setSaveState("saving");
    },
  });

  useEffect(() => {
    if (!editor || !note.isSuccess || loadedRef.current) return;
    const cloudContent = note.data.content || "";
    const legacyContent = cloudContent ? "" : loadLegacyNotepad(legacyStorageKey);
    const initial = cloudContent || legacyContent || "<p></p>";
    lastSavedRef.current = cloudContent || null;
    lastObservedUpdatedAtRef.current = note.data.updatedAt;
    latestContentRef.current = initial;
    hasUnsavedChangesRef.current = false;
    editor.commands.setContent(initial, { emitUpdate: false });
    hydratedRef.current = true;
    loadedRef.current = true;
    setContent(initial);
    setHydrated(true);
    editor.setEditable(true);
    setSaveState(cloudContent || !legacyContent ? "saved" : "saving");
  }, [editor, note.data, note.isSuccess, legacyStorageKey]);

  useEffect(() => {
    if (!editor || !hydratedRef.current || !loadedRef.current || !note.data) return;

    const remoteUpdatedAt = note.data.updatedAt;
    if (!remoteUpdatedAt) return;

    const lastObservedUpdatedAt = lastObservedUpdatedAtRef.current;
    if (
      lastObservedUpdatedAt &&
      Date.parse(remoteUpdatedAt) <= Date.parse(lastObservedUpdatedAt)
    ) {
      return;
    }

    const remoteContent = note.data.content || "<p></p>";
    if (remoteContent === lastSavedRef.current) {
      lastObservedUpdatedAtRef.current = remoteUpdatedAt;
      return;
    }

    // A remote save must never replace text the user has changed locally.
    if (hasUnsavedChangesRef.current || latestContentRef.current !== lastSavedRef.current) return;

    lastObservedUpdatedAtRef.current = remoteUpdatedAt;
    editor.commands.setContent(remoteContent, { emitUpdate: false });
    hasUnsavedChangesRef.current = false;
    latestContentRef.current = remoteContent;
    lastSavedRef.current = remoteContent;
    setContent(remoteContent);
    setSaveState("saved");
  }, [content, editor, note.data]);

  useEffect(() => {
    if (!hydrated || content === lastSavedRef.current) return;
    const draft = content;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveNote.mutateAsync({ data: { content: draft } }))
        .then((saved) => {
          if (saved.content === latestContentRef.current) {
            lastSavedRef.current = saved.content;
            lastObservedUpdatedAtRef.current = saved.updatedAt;
            hasUnsavedChangesRef.current = false;
            setSaveState("saved");
            try { localStorage.removeItem(legacyStorageKey); } catch { /* migration cache is optional */ }
          }
        })
        .catch(() => {
          if (draft === latestContentRef.current) setSaveState("error");
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [content, hydrated, legacyStorageKey, saveNote.mutateAsync]);

  const closeNotepad = useCallback(async () => {
    const latest = latestContentRef.current;
    if (!hydratedRef.current || latest === lastSavedRef.current) {
      onClose();
      return;
    }
    setSaveState("saving");
    try {
      const saved = await saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveNote.mutateAsync({ data: { content: latestContentRef.current } }));
      lastSavedRef.current = saved.content;
      lastObservedUpdatedAtRef.current = saved.updatedAt;
      hasUnsavedChangesRef.current = false;
      try { localStorage.removeItem(legacyStorageKey); } catch { /* migration cache is optional */ }
      onClose();
    } catch {
      setSaveState("error");
    }
  }, [legacyStorageKey, onClose, saveNote.mutateAsync]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void closeNotepad();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeNotepad]);

  const command = (
    label: string,
    active: boolean,
    run: () => void,
    icon: ReactNode,
    disabled = false,
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-muted disabled:opacity-40 ${active ? "bg-muted text-primary" : "text-muted-foreground"}`}
    >
      {icon}
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) void closeNotepad(); }}
      data-testid="personal-notepad-overlay"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="personal-notepad-title"
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl"
        style={{ maxHeight: "min(760px, calc(100dvh - 1.5rem))" }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 id="personal-notepad-title" className="text-base font-semibold">Personal notepad</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Private to your account · saved to the cloud</p>
          </div>
          <button type="button" onClick={() => void closeNotepad()} aria-label="Close notepad" data-testid="button-close-notepad" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X size={18} />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-3 py-2" role="toolbar" aria-label="Notepad formatting">
          {editor && <>
            {command("Bold", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
            {command("Italic", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
            {command("Underline", editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={16} />)}
            {command("Strikethrough", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />)}
            <span className="mx-1 h-5 w-px bg-border" />
            {command("Heading 1", editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={17} />)}
            {command("Heading 2", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={17} />)}
            {command("Bulleted list", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List size={17} />)}
            {command("Numbered list", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={17} />)}
            <span className="mx-1 h-5 w-px bg-border" />
            {command("Undo", false, () => editor.chain().focus().undo().run(), <Undo2 size={16} />, !editor.can().undo())}
            {command("Redo", false, () => editor.chain().focus().redo().run(), <Redo2 size={16} />, !editor.can().redo())}
          </>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6" data-testid="personal-notepad-editor-scroll">
          {note.isLoading && <p className="py-4 text-sm text-muted-foreground">Loading your cloud notes…</p>}
          {note.isError && <div className="py-4 text-sm text-destructive"><p>Couldn’t load your cloud notes.</p><button type="button" onClick={() => { loadedRef.current = false; void note.refetch(); }} className="mt-2 font-semibold underline">Try again</button></div>}
          {!note.isError && <EditorContent editor={editor} />}
        </div>
        <footer className="flex min-h-10 shrink-0 items-center border-t border-border px-4 text-xs text-muted-foreground">
          {saveState === "loading" ? "Loading…" : saveState === "saving" ? "Saving to cloud…" : saveState === "error" ? "Couldn’t sync to cloud. Keep this page open and edit to retry." : "Saved to your account in the cloud."}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
