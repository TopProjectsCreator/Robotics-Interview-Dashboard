import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
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

function loadNotepad(key: string): string {
  try {
    return localStorage.getItem(key) || "<p></p>";
  } catch {
    return "<p></p>";
  }
}

export function PersonalNotepad({ accountKey, onClose }: { accountKey: string; onClose: () => void }) {
  const storageKey = `robotics-personal-notepad:${accountKey}`;
  const initialContent = useMemo(() => loadNotepad(storageKey), [storageKey]);
  const [storageError, setStorageError] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "personal-notepad-editor",
        "aria-label": "Notepad text",
        "data-testid": "personal-notepad-editor",
      },
    },
    onUpdate({ editor: activeEditor }) {
      try {
        localStorage.setItem(storageKey, activeEditor.getHTML());
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
  }, [storageKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      data-testid="personal-notepad-overlay"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="personal-notepad-title"
        className="flex max-h-[min(82vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 id="personal-notepad-title" className="text-base font-semibold">Personal notepad</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Private to this account on this device</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close notepad" data-testid="button-close-notepad" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2" role="toolbar" aria-label="Notepad formatting">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6">
          <EditorContent editor={editor} />
        </div>
        <footer className="flex min-h-10 items-center border-t border-border px-4 text-xs text-muted-foreground">
          {storageError ? "Couldn’t save on this device. Copy your notes before closing." : "Notes save automatically on this device."}
        </footer>
      </section>
    </div>
  );
}
