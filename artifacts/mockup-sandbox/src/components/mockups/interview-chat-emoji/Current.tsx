import { useState } from "react";
import "./_group.css";

const originalEmojis = ["😀", "😂", "😍", "👍", "🙏", "🎉", "🔥", "✅", "😮", "😢", "❤️", "🤖"];

export function Current() {
  const [dark, setDark] = useState(false);
  return (
    <main className={`emoji-preview ${dark ? "is-dark" : ""} min-h-screen p-5`} style={{ background: dark ? "#0e1d27" : "#eef3f6" }}>
      <div className="mx-auto flex min-h-[510px] max-w-[390px] flex-col justify-between">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: "var(--muted)" }}>Interviewer chat</p>
            <h1 className="mt-1 text-lg font-semibold">Current picker</h1>
          </div>
          <button type="button" onClick={() => setDark(value => !value)} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
            {dark ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <div className="relative">
          <div className="absolute bottom-[calc(100%+10px)] right-0 w-64 rounded-2xl border p-3 shadow-[0_12px_32px_rgba(24,58,75,0.2)]" style={{ background: "var(--surface)", borderColor: "var(--border)" }} data-testid="emoji-picker">
            <p className="mb-2 text-xs font-semibold" style={{ color: "var(--muted)" }}>Emoji</p>
            <div className="grid grid-cols-6 gap-1">
              {originalEmojis.map(emoji => (
                <button key={emoji} type="button" aria-label={`Insert ${emoji}`} className="rounded-lg p-2 text-xl transition hover:bg-[var(--surface-hover)]">{emoji}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-[22px] border p-2 shadow-sm" style={{ background: dark ? "#10232d" : "#eef5ff", borderColor: "var(--border)" }}>
            <button type="button" aria-label="More message options" className="flex h-9 w-9 items-center justify-center rounded-full text-lg" style={{ color: "var(--muted)" }}>＋</button>
            <div className="flex-1 rounded-xl px-2 py-2 text-sm" style={{ color: "var(--muted)" }}>Message the team…</div>
            <button type="button" aria-label="Insert emoji" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: "var(--accent)" }}>☺</button>
            <button type="button" aria-label="Attach files" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: "var(--muted)" }}>⌁</button>
          </div>
          <p className="mt-3 text-center text-[11px]" style={{ color: "var(--muted)" }}>12 fixed choices · no search or categories</p>
        </div>
      </div>
    </main>
  );
}