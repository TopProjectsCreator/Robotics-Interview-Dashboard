import { useMemo, useState } from "react";
import { Search, SmilePlus, Upload, UsersRound, X } from "lucide-react";
import "./_group.css";

const emojiGroups: Record<string, { emoji: string; name: string }[]> = {
  "Frequently used": [
    { emoji: "😀", name: "grinning face" }, { emoji: "😂", name: "face with tears of joy" }, { emoji: "😍", name: "heart eyes" },
    { emoji: "👍", name: "thumbs up" }, { emoji: "🙏", name: "folded hands" }, { emoji: "🎉", name: "party popper" },
    { emoji: "🔥", name: "fire" }, { emoji: "✅", name: "check mark" }, { emoji: "😮", name: "open mouth" },
    { emoji: "🤖", name: "robot" }, { emoji: "🚀", name: "rocket" }, { emoji: "💡", name: "light bulb" },
  ],
  "Smileys & people": [
    { emoji: "🙂", name: "slightly smiling face" }, { emoji: "😅", name: "grinning face with sweat" }, { emoji: "🥹", name: "face holding back tears" },
    { emoji: "🤔", name: "thinking face" }, { emoji: "🙌", name: "raising hands" }, { emoji: "👏", name: "clapping hands" },
    { emoji: "💪", name: "flexed biceps" }, { emoji: "🫡", name: "saluting face" }, { emoji: "😎", name: "smiling face with sunglasses" },
    { emoji: "🤝", name: "handshake" }, { emoji: "🧑‍🚀", name: "astronaut" }, { emoji: "🧑‍🔧", name: "mechanic" },
  ],
  "Animals & nature": [
    { emoji: "🐕", name: "dog" }, { emoji: "🐈", name: "cat" }, { emoji: "🦊", name: "fox" },
    { emoji: "🐢", name: "turtle" }, { emoji: "🐙", name: "octopus" }, { emoji: "🦋", name: "butterfly" },
    { emoji: "🌱", name: "seedling" }, { emoji: "🌈", name: "rainbow" }, { emoji: "🌻", name: "sunflower" },
  ],
  "Food & drink": [
    { emoji: "☕", name: "coffee" }, { emoji: "🍕", name: "pizza" }, { emoji: "🍣", name: "sushi" },
    { emoji: "🍓", name: "strawberry" }, { emoji: "🥑", name: "avocado" }, { emoji: "🧋", name: "bubble tea" },
  ],
  "Travel & places": [
    { emoji: "🚗", name: "car" }, { emoji: "🚲", name: "bicycle" }, { emoji: "✈️", name: "airplane" },
    { emoji: "🏕️", name: "camping" }, { emoji: "🌋", name: "volcano" }, { emoji: "🗽", name: "statue of liberty" },
  ],
  Activities: [
    { emoji: "⚽", name: "soccer ball" }, { emoji: "🏀", name: "basketball" }, { emoji: "🎮", name: "video game" },
    { emoji: "🎸", name: "guitar" }, { emoji: "🏆", name: "trophy" }, { emoji: "🎯", name: "bullseye" },
  ],
  Objects: [
    { emoji: "💻", name: "laptop" }, { emoji: "🔧", name: "wrench" }, { emoji: "🧰", name: "toolbox" },
    { emoji: "🔬", name: "microscope" }, { emoji: "📡", name: "satellite antenna" }, { emoji: "🧪", name: "test tube" },
  ],
  Symbols: [
    { emoji: "❤️", name: "red heart" }, { emoji: "💯", name: "hundred points" }, { emoji: "♻️", name: "recycling symbol" },
    { emoji: "⚡", name: "high voltage" }, { emoji: "✨", name: "sparkles" }, { emoji: "❌", name: "cross mark" },
  ],
  Flags: [
    { emoji: "🏁", name: "chequered flag" }, { emoji: "🚩", name: "triangular flag" }, { emoji: "🏴‍☠️", name: "pirate flag" },
    { emoji: "🇺🇸", name: "United States" }, { emoji: "🇯🇵", name: "Japan" }, { emoji: "🇨🇦", name: "Canada" },
  ],
};

const teamEmojis = [
  { id: "bot", mark: "R", label: "rover" },
  { id: "spark", mark: "✦", label: "spark" },
  { id: "wave", mark: "≈", label: "wave" },
];

export function Expanded() {
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Frequently used");
  const [addOpen, setAddOpen] = useState(false);
  const [chosen, setChosen] = useState("😀");
  const available = useMemo(
    () => (category === "Team" ? [] : emojiGroups[category] ?? []).filter(item => `${item.name} ${item.emoji}`.toLowerCase().includes(search.toLowerCase())),
    [category, search],
  );
  const categories = [...Object.keys(emojiGroups), "Team"];

  return (
    <main className={`emoji-preview ${dark ? "is-dark" : ""} min-h-screen p-4`} style={{ background: dark ? "#0e1d27" : "#eef3f6" }}>
      <div className="mx-auto flex min-h-[520px] max-w-[398px] flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: "var(--muted)" }}>Interviewer chat</p>
            <h1 className="mt-1 text-lg font-semibold">Emoji picker</h1>
          </div>
          <button type="button" onClick={() => setDark(value => !value)} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
            {dark ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <section className="overflow-hidden rounded-2xl border shadow-[0_18px_44px_rgba(24,58,75,0.18)]" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="border-b p-3" style={{ borderColor: "var(--border)" }}>
            <label className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ background: "var(--surface-soft)", borderColor: "var(--border)" }}>
              <Search size={15} style={{ color: "var(--muted)" }} />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search emojis" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-70" style={{ color: "var(--text)" }} aria-label="Search emojis" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" style={{ color: "var(--muted)" }}><X size={14} /></button>}
              <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>⌘ K</kbd>
            </label>
            <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
              {categories.map((item, index) => (
                <button key={item} type="button" onClick={() => { setCategory(item); setSearch(""); }} aria-label={`Show ${item}`} className="flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-[11px] font-semibold transition" style={{ background: category === item ? (dark ? "#1d3744" : "#e3f4f2") : "transparent", color: category === item ? "var(--accent)" : "var(--muted)" }}>
                  {item === "Team" ? <UsersRound size={15} /> : ["◷", "☺", "♧", "◉", "⌖", "⚽", "▣", "✧", "⚑"][index]}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[310px] overflow-y-auto p-3">
            {category === "Team" ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Team emojis <span style={{ color: "var(--muted)" }}>· 3</span></p>
                  <button type="button" onClick={() => setAddOpen(value => !value)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ color: "var(--accent)", background: "var(--surface-hover)" }}><Upload size={12} /> Add</button>
                </div>
                {addOpen && <div className="mb-3 rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}><p className="text-[11px] font-semibold">Add a shared emoji</p><div className="mt-2 flex items-center gap-2"><div className="flex-1 rounded-lg border px-2 py-1.5 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface)" }}>emoji-name</div><button type="button" className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white" style={{ background: "var(--accent)" }}>Choose image</button></div><p className="mt-1.5 text-[10px]" style={{ color: "var(--muted)" }}>PNG, JPG, GIF, or WebP · visible to your team</p></div>}
                <div className="grid grid-cols-6 gap-1">
                  {teamEmojis.map(item => <button key={item.id} type="button" onClick={() => setChosen(`:${item.label}:`)} title={`:${item.label}:`} aria-label={`Insert team emoji ${item.label}`} className="flex h-11 flex-col items-center justify-center rounded-lg transition hover:bg-[var(--surface-hover)]"><span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold" style={{ color: "var(--accent)", background: dark ? "#1d3744" : "#e3f4f2" }}>{item.mark}</span><span className="mt-0.5 max-w-full truncate text-[8px]" style={{ color: "var(--muted)" }}>{item.label}</span></button>)}
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text)" }}>{search ? `Results for “${search}”` : category}</p>
                {available.length ? <div className="grid grid-cols-8 gap-1">{available.map(item => <button key={item.name} type="button" onClick={() => setChosen(item.emoji)} title={item.name} aria-label={`Insert ${item.name}`} className="flex h-10 items-center justify-center rounded-lg text-[23px] transition hover:bg-[var(--surface-hover)]">{item.emoji}</button>)}</div> : <p className="py-8 text-center text-xs" style={{ color: "var(--muted)" }}>No emojis found</p>}
              </>
            )}
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>{category === "Team" ? "Shared across interviewer chat" : "Select an emoji to insert"}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-lg" style={{ background: "var(--surface)", border: `1px solid var(--border)` }}>{chosen}</span>
          </div>
        </section>

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2 rounded-[22px] border p-2 shadow-sm" style={{ background: dark ? "#10232d" : "#eef5ff", borderColor: "var(--border)" }}>
            <button type="button" aria-label="More message options" className="flex h-9 w-9 items-center justify-center rounded-full text-lg" style={{ color: "var(--muted)" }}>＋</button>
            <div className="flex-1 rounded-xl px-2 py-2 text-sm" style={{ color: "var(--muted)" }}>Message the team…</div>
            <button type="button" aria-label="Insert emoji" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: "var(--accent)" }}><SmilePlus size={17} /></button>
          </div>
          <p className="mt-2 text-center text-[11px]" style={{ color: "var(--muted)" }}>Search · categories · team-shared custom emojis</p>
        </div>
      </div>
    </main>
  );
}