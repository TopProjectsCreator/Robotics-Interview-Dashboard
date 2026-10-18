import "./_group.css";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Check,
  Lock,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";

const QUEUE_ROWS = [
  ["JM", "Jordan M.", "Bay 02", "now", true],
  ["AR", "Alex R.", "Bay 01", "now", true],
  ["SK", "Sam K.", "Next up", "8 min", false],
  ["TD", "Tariq D.", "Next up", "16 min", false],
] as const;

/**
 * CONCEPT 1 — "Command Deck"
 * Structure: vertical rail navigation pinned to the left edge, asymmetric
 * two-column hero where the live console bleeds off the right edge, a vertical
 * run-of-show instead of a horizontal feature row, and a sheared CTA block.
 * Nothing here reuses the horizontal-nav / centered-hero / 3-card-grid spine.
 */
export function CommandDeck() {
  const runOfShow = [
    {
      time: "07:45",
      title: "Doors open",
      body: "Front desk checks applicants in against the roster. Names, grades and lane assignments land on the display automatically.",
      state: "done",
    },
    {
      time: "08:30",
      title: "Interviews in flight",
      body: "Every bay advances from one shared queue. Two interviewers, twelve slots, one lane order that nobody has to memorize.",
      state: "live",
    },
    {
      time: "11:15",
      title: "Swapping bays",
      body: "Finish an interview and the next name is already moving. No radio calls, no hallway guesswork about who is next.",
      state: "next",
    },
    {
      time: "14:00",
      title: "Decisions filed",
      body: "Notes, scores and lanes are written once. Everything downstream — team, lead, display — reads the same record.",
      state: "next",
    },
  ];

  return (
    <div className="d1-sans flex min-h-[1400px] bg-[#0c1219] text-[#e8eef3]">
      {/* vertical rail */}
      <aside className="sticky top-0 flex h-dvh w-[104px] shrink-0 flex-col items-center justify-between self-start border-r border-white/10 bg-[#080d13] py-7">
        <div className="flex flex-col items-center gap-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8c84a] text-[#0c1219]">
            <Activity size={22} strokeWidth={2.4} />
          </div>
          <nav className="flex flex-col items-center gap-7">
            {["Day", "Queue", "Chat", "Build", "Docs"].map((item, i) => (
              <a
                key={item}
                href="#"
                className={`group flex flex-col items-center gap-2 ${
                  i === 0 ? "text-[#f8c84a]" : "text-[#5d7183] hover:text-white"
                }`}
              >
                <span className="h-6 w-[2px] bg-current opacity-0 transition group-hover:opacity-100" />
                <span className="d1-mono text-[9px] tracking-[.28em] uppercase [writing-mode:vertical-rl]">
                  {item}
                </span>
              </a>
            ))}
          </nav>
        </div>
        <div className="flex flex-col items-center gap-4">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade9f] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade9f]" />
          </span>
          <span className="d1-mono text-[9px] tracking-[.2em] text-[#5d7183] uppercase [writing-mode:vertical-rl]">
            systems live
          </span>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* hero */}
        <header className="relative grid grid-cols-[1.05fr_.95fr] gap-12 px-14 pt-16 pb-20">
          <div className="d-grid-lines pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60" />
          <div className="relative">
            <p className="d1-mono mb-7 flex items-center gap-3 text-[10px] tracking-[.3em] text-[#4ade9f] uppercase">
              <Radio size={12} /> Day-of operations
            </p>
            <h1 className="text-[clamp(2.6rem,5.4vw,4.6rem)] leading-[.94] font-semibold tracking-[-.045em]">
              The tryout day,
              <br />
              run like a
              <br />
              <span className="text-[#f8c84a]">control room.</span>
            </h1>
            <p className="mt-8 max-w-[30rem] text-[15px] leading-relaxed text-[#93a7b8]">
              One operating surface for robotics interviews — arrival, queue, bays and the
              public display — built so a front desk and a room lead never have to
              reconcile two versions of the truth.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#"
                className="group inline-flex items-center gap-3 rounded-full bg-[#f8c84a] px-7 py-3.5 text-[13px] font-semibold text-[#0c1219] transition hover:bg-white"
              >
                Open admin workspace
                <ArrowRight size={15} className="transition group-hover:translate-x-1" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2.5 rounded-full border border-white/15 px-6 py-3.5 text-[13px] text-[#c3d2de] transition hover:border-white/40 hover:text-white"
              >
                <MonitorSmartphone size={15} /> Public display
              </a>
            </div>
            <div className="d1-mono mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] tracking-[.18em] text-[#5d7183] uppercase">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={12} className="text-[#4ade9f]" /> Private by default
              </span>
              <span className="inline-flex items-center gap-2">
                <Lock size={12} className="text-[#4ade9f]" /> Server-enforced access
              </span>
            </div>
          </div>

          {/* console, deliberately cropped by the right edge */}
          <div className="relative">
            <div className="translate-x-6 rounded-2xl border border-white/12 bg-[#111b26] p-6 shadow-[0_30px_80px_rgba(0,0,0,.55)]">
              <div className="mb-5 flex items-center justify-between">
                <span className="d1-mono text-[9px] tracking-[.24em] text-[#5d7183] uppercase">
                  Team 23442 · interview queue
                </span>
                <span className="d1-mono flex items-center gap-2 text-[9px] tracking-[.2em] text-[#4ade9f] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade9f]" /> synced 08:42
                </span>
              </div>
              <div className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/10">
                {[
                  ["04", "in room"],
                  ["02", "in bay"],
                  ["11", "queued"],
                ].map(([n, l]) => (
                  <div key={l} className="bg-[#0e1620] px-4 py-4">
                    <div className="text-2xl font-semibold tracking-[-.03em]">{n}</div>
                    <div className="d1-mono mt-1 text-[9px] tracking-[.18em] text-[#5d7183] uppercase">
                      {l}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {QUEUE_ROWS.map(([init, name, lane, tag, active]) => (
                  <div
                    key={name}
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 ${
                      active
                        ? "border-[#f8c84a]/35 bg-[#f8c84a]/[.07]"
                        : "border-white/8 bg-white/[.02]"
                    }`}
                  >
                    <span
                      className={`d1-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-medium ${
                        active ? "bg-[#f8c84a] text-[#0c1219]" : "bg-white/8 text-[#93a7b8]"
                      }`}
                    >
                      {init}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{name}</div>
                      <div className="d1-mono text-[9px] tracking-[.16em] text-[#5d7183] uppercase">
                        {lane}
                      </div>
                    </div>
                    <span className="d1-mono text-[9px] tracking-[.16em] text-[#5d7183] uppercase">
                      {tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -right-6 bottom-6 w-56 rounded-xl border border-white/12 bg-[#16232f] p-4">
              <div className="d1-mono mb-2 text-[9px] tracking-[.24em] text-[#5d7183] uppercase">
                public display
              </div>
              <p className="text-[12px] leading-snug text-[#c3d2de]">
                Now calling <span className="text-[#4ade9f]">Jordan M.</span>
                <br />
                <span className="d1-mono text-[9px] tracking-[.16em] text-[#5d7183] uppercase">
                  bay 02 · no private detail
                </span>
              </p>
            </div>
          </div>
        </header>

        {/* ticker */}
        <div className="flex items-center gap-8 overflow-hidden border-y border-white/10 bg-[#080d13] py-3.5">
          <span className="d1-mono shrink-0 text-[9px] tracking-[.3em] text-[#f8c84a] uppercase">
            live
          </span>
          {["Arrival desk", "Decision lanes", "Interview bays", "Big screen", "Team chat", "Assistant"].map(
            (t) => (
              <span key={t} className="flex shrink-0 items-center gap-8">
                <span className="d1-mono text-[10px] tracking-[.2em] text-[#5d7183] uppercase">
                  {t}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
              </span>
            ),
          )}
        </div>

        {/* vertical run of show */}
        <section className="px-14 py-20">
          <div className="mb-14 flex items-end justify-between gap-8 border-b border-white/10 pb-6">
            <h2 className="max-w-[26rem] text-[clamp(1.7rem,3vw,2.5rem)] leading-[1.05] font-semibold tracking-[-.035em]">
              A day on the clock, not a to-do list.
            </h2>
            <p className="d1-mono max-w-[22rem] text-[10px] leading-relaxed tracking-[.16em] text-[#5d7183] uppercase">
              Sequence matters more than features on a day like this.
            </p>
          </div>
          <ol className="relative">
            <div className="absolute top-3 bottom-3 left-[5.6rem] w-px bg-gradient-to-b from-[#f8c84a]/60 via-white/12 to-transparent" />
            {runOfShow.map((s) => (
              <li key={s.time} className="group relative grid grid-cols-[5.6rem_1fr_auto] items-start gap-8 pb-11 last:pb-0">
                <span
                  className={`d1-mono pt-1 text-[13px] tracking-[.1em] ${
                    s.state === "live" ? "text-[#f8c84a]" : "text-[#5d7183]"
                  }`}
                >
                  {s.time}
                </span>
                <span className="absolute left-[5.6rem] top-2 -ml-[4.5px]">
                  <span
                    className={`block h-2 w-2 rounded-full ring-4 ring-[#0c1219] ${
                      s.state === "live"
                        ? "bg-[#f8c84a]"
                        : s.state === "done"
                          ? "bg-[#4ade9f]"
                          : "bg-white/25"
                    }`}
                  />
                </span>
                <div className="col-start-2">
                  <h3 className="text-[19px] font-medium tracking-[-.02em]">{s.title}</h3>
                  <p className="mt-2 max-w-[40rem] text-[13.5px] leading-relaxed text-[#93a7b8]">
                    {s.body}
                  </p>
                </div>
                <span
                  className={`d1-mono pt-1 text-[9px] tracking-[.2em] uppercase ${
                    s.state === "live" ? "text-[#4ade9f]" : "text-[#3f5164]"
                  }`}
                >
                  {s.state}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* sheared CTA */}
        <section className="relative overflow-hidden border-t border-white/10 px-14 pt-20 pb-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[420px] -skew-y-6 bg-[#f8c84a]"
          />
          <div className="relative grid grid-cols-[1fr_auto] items-center gap-10">
            <h2 className="max-w-[34rem] text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.02] font-semibold tracking-[-.04em] text-[#0c1219]">
              Open the workspace before the first applicant walks in.
            </h2>
            <div className="flex flex-col items-end gap-4">
              <a
                href="#"
                className="inline-flex items-center gap-3 rounded-full bg-[#0c1219] px-8 py-4 text-[13px] font-semibold text-white transition hover:bg-[#1b2a38]"
              >
                Coordinator sign-in <ArrowRight size={15} />
              </a>
              <div className="d1-mono flex items-center gap-2 text-[9px] tracking-[.2em] text-[#0c1219]/60 uppercase">
                <Users size={12} /> password or passkey
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-6 border-t border-white/10 px-14 py-8">
          <span className="d1-mono text-[10px] tracking-[.24em] text-[#5d7183] uppercase">
            Robotics Tryout Control
          </span>
          <div className="d1-mono flex flex-wrap gap-6 text-[10px] tracking-[.18em] text-[#5d7183] uppercase">
            <span className="inline-flex items-center gap-2">
              <Check size={12} className="text-[#4ade9f]" /> no applicant data on the display
            </span>
            <span className="inline-flex items-center gap-2">
              <ArrowDownRight size={12} /> built by Team 23442
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default CommandDeck;