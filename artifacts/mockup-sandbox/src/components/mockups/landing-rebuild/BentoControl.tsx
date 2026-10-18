import "./_group.css";
import {
  ArrowUpRight,
  Blocks,
  Boxes,
  Check,
  ChevronRight,
  Code2,
  Cpu,
  MessagesSquare,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

/**
 * CONCEPT 3 — "Bento Control"
 * Structure: a bento-grid hero where six differently-sized cells make up the
 * entire fold — one oversized headline cell, a live queue cell, an attendance
 * cell, a display cell, a stat cell. No centred hero, no two-column split. The
 * grid continues as the organising principle through the whole page, with
 * asymmetric cell spans that never line up into a boring 3x3.
 */
export function BentoControl() {
  return (
    <div className="d3-sans min-h-[1500px] bg-[#080a0b] text-[#eef2f4]">
      {/* minimal top bar */}
      <header className="flex items-center justify-between gap-6 px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c8f751] text-[#080a0b]">
            <Blocks size={17} strokeWidth={2.5} />
          </span>
          <span className="text-[14px] font-semibold tracking-[-.01em]">Tryout Control</span>
          <span className="d3-mono rounded-full border border-white/15 px-2.5 py-0.5 text-[9px] tracking-[.18em] text-white/45 uppercase">
            team 23442
          </span>
        </div>
        <nav className="hidden items-center gap-7 md:flex">
          {["Bays", "Queue", "Team", "Build", "Display"].map((l) => (
            <a key={l} href="#" className="d3-mono text-[11px] tracking-[.1em] text-white/55 transition hover:text-white">
              {l}
            </a>
          ))}
        </nav>
        <a
          href="#"
          className="inline-flex items-center gap-2 rounded-full bg-[#c8f751] px-5 py-2.5 text-[12px] font-semibold text-[#080a0b] transition hover:bg-white"
        >
          Sign in <ArrowUpRight size={14} />
        </a>
      </header>

      {/* BENTO HERO */}
      <section className="grid grid-cols-1 gap-3 px-6 md:grid-cols-4 md:px-8">
        {/* headline cell - spans 2x2 on desktop */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0e1113] p-9 md:col-span-2 md:row-span-2 md:min-h-[30rem]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-[#c8f751]/12 blur-3xl"
          />
          <p className="d3-mono relative mb-6 flex items-center gap-2 text-[10px] tracking-[.22em] text-[#c8f751] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c8f751]" /> Day-of operations
          </p>
          <h1 className="relative text-[clamp(2.3rem,4.4vw,3.7rem)] leading-[.96] font-semibold tracking-[-.045em]">
            Everything the room needs.
            <br />
            <span className="text-white/35">Nothing the room doesn't.</span>
          </h1>
          <p className="relative mt-6 max-w-[26rem] text-[14px] leading-relaxed text-white/55">
            A control surface for robotics tryouts: arrival, queue, bays, decision
            lanes, and a waiting-room display that publishes names, grades and lanes —
            and nothing else.
          </p>
          <div className="relative mt-9 flex flex-wrap gap-3">
            <a
              href="#"
              className="group inline-flex items-center gap-2.5 rounded-full bg-[#c8f751] px-6 py-3 text-[12.5px] font-semibold text-[#080a0b] transition hover:bg-white"
            >
              Open workspace
              <ChevronRight size={15} className="transition group-hover:translate-x-0.5" />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-[12.5px] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              <MonitorPlay size={14} /> Display preview
            </a>
          </div>
        </div>

        {/* live queue cell */}
        <div className="rounded-3xl border border-white/10 bg-[#0e1113] p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <span className="d3-mono text-[10px] tracking-[.2em] text-white/40 uppercase">
              Live queue
            </span>
            <span className="d3-mono inline-flex items-center gap-1.5 text-[9px] tracking-[.16em] text-[#c8f751] uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c8f751]" /> 08:42
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              ["Jordan M.", "Bay 02", "#c8f751", true],
              ["Alex R.", "Bay 01", "#c8f751", true],
              ["Sam K.", "Next up", "rgba(255,255,255,.14)", false],
              ["Tariq D.", "Next up", "rgba(255,255,255,.14)", false],
            ].map(([name, lane, dot, hot]) => (
              <div
                key={name as string}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  hot ? "bg-white/[.05]" : "bg-white/[.015]"
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot as string }} />
                <span className="flex-1 truncate text-[13px] font-medium">{name as string}</span>
                <span className="d3-mono text-[10px] tracking-[.1em] text-white/40 uppercase">
                  {lane as string}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* stat strip cell */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-3xl bg-white/10 md:col-span-2">
          {[
            ["18/24", "checked in"],
            ["02", "in bay"],
            ["11", "queued"],
          ].map(([n, l]) => (
            <div key={l} className="bg-[#0e1113] px-5 py-6">
              <div className="text-[26px] leading-none font-semibold tracking-[-.04em] tabular-nums">{n}</div>
              <div className="d3-mono mt-2 text-[9px] tracking-[.16em] text-white/35 uppercase">{l}</div>
            </div>
          ))}
        </div>

        {/* attendance cell */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141a14] to-[#0e1113] p-6 md:col-span-2 md:row-span-2">
          <span className="d3-mono mb-4 block text-[10px] tracking-[.2em] text-white/40 uppercase">
            Attendance
          </span>
          <div className="flex items-end gap-3">
            <span className="text-[54px] leading-none font-semibold tracking-[-.05em] tabular-nums">18</span>
            <span className="pb-2 text-[20px] text-white/30">/24</span>
            <span className="d3-mono mb-2 ml-auto text-[10px] text-[#c8f751]">75%</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-3/4 rounded-full bg-[#c8f751]" />
          </div>
          <div className="mt-6 space-y-2">
            {[
              ["Jordan M.", "Ready", "#c8f751"],
              ["Alex R.", "In bay 01", "#5ac8fa"],
              ["Sam K.", "Waiting", "rgba(255,255,255,.25)"],
              ["Tariq D.", "Waiting", "rgba(255,255,255,.25)"],
            ].map(([n, s, c]) => (
              <div key={n} className="flex items-center gap-2.5 border-b border-white/6 pb-2 last:border-0">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                <span className="flex-1 truncate text-[12.5px]">{n}</span>
                <span className="d3-mono text-[9.5px] tracking-[.1em] text-white/45 uppercase">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* privacy cell */}
        <div className="flex flex-col justify-between rounded-3xl border border-[#c8f751]/25 bg-[#c8f751]/[.06] p-6 md:col-span-2">
          <ShieldCheck size={22} className="text-[#c8f751]" />
          <div>
            <p className="mt-8 text-[15px] font-medium tracking-[-.02em]">
              The display shows names, grades and lanes.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/50">
              Never emails, transcripts, notes or AI concerns.
            </p>
          </div>
        </div>
      </section>

      {/* bento body */}
      <section className="px-6 pt-20 pb-4 md:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-[24rem] text-[clamp(1.7rem,3.2vw,2.6rem)] leading-[1.03] font-semibold tracking-[-.04em]">
            Six surfaces, one shared state.
          </h2>
          <p className="max-w-[24rem] text-[13px] leading-relaxed text-white/45">
            Everything below reads from the same derived queue. Finish an interview and
            all of them move together on the next poll.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 px-6 pb-20 md:grid-cols-4 md:px-8">
        <div className="rounded-3xl border border-white/10 bg-[#0e1113] p-7 md:col-span-2 md:min-h-[19rem]">
          <Cpu size={22} className="mb-5 text-[#c8f751]" />
          <h3 className="text-[19px] font-medium tracking-[-.025em]">Bays and live queue</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-white/50">
            Queue position is derived from roster order and completion. Active slots
            equal your interviewer count — two by default, twelve at the outside.
          </p>
          <div className="mt-6 flex gap-1.5">
            {["Arrival", "Bay 01", "Bay 02", "Decision", "Roster"].map((t, i) => (
              <span
                key={t}
                className={`d3-mono rounded-md px-2.5 py-1 text-[9px] tracking-[.12em] uppercase ${
                  i < 2 ? "bg-[#c8f751] text-[#080a0b]" : "bg-white/8 text-white/45"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl bg-[#c8f751] p-7 text-[#080a0b] md:min-h-[19rem]">
          <MessagesSquare size={22} />
          <div className="mt-10">
            <p className="text-[clamp(1.9rem,3vw,2.5rem)] leading-[.95] font-semibold tracking-[-.045em]">
              Team chat that
              <br />
              keeps its word.
            </p>
            <p className="mt-4 text-[12.5px] leading-relaxed opacity-75">
              Attachments, reactions, polls, moderation, AI mentions and
              server-scheduled messages interpreted in your local timezone.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0e1113] p-7 md:col-span-2 md:row-span-2 md:min-h-[26rem]">
          <div className="mb-5 flex items-center justify-between">
            <Wrench size={22} className="text-[#c8f751]" />
            <span className="d3-mono text-[9px] tracking-[.18em] text-white/35 uppercase">after tryouts</span>
          </div>
          <h3 className="text-[19px] font-medium tracking-[-.025em]">The build workspaces</h3>
          <div className="mt-6 space-y-2.5">
            {[
              [Code2, "Code", "AI-assisted edits, terminal, problems panel, Git, FTC TeamCode export, REV Hub builds, USB ADB and Expansion Hub serial tools."],
              [Blocks, "CAD", "Private library with folders, chunked uploads for large files, and in-browser previews for supported CAD and mesh formats."],
              [Boxes, "Parts", "Catalog, inventory, supplier search and sync, robot builds and cost tracking, with a parts-aware assistant."],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof Code2;
              return (
                <div key={title as string} className="flex gap-4 rounded-2xl bg-white/[.03] p-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[#c8f751]">
                    <I size={16} />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium">{title as string}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/45">{body as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0e1113] p-7 md:col-span-2">
          <Sparkles size={22} className="mb-5 text-[#c8f751]" />
          <h3 className="text-[19px] font-medium tracking-[-.025em]">Assistant that knows the team</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-white/50">
            Ask about interviews, schedules or build notes. Imported applicant text is
            treated strictly as data, never as instructions.
          </p>
        </div>
      </section>

      {/* checklist strip */}
      <section className="mx-6 mb-20 grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-white/10 md:mx-8 md:grid-cols-4">
        {[
          ["Server-enforced access", "Workspace permissions come from a verified session, never the client."],
          ["Isolated instances", "Teams route to a primary or secondary database from their signed session."],
          ["Honest storage errors", "Uploads fail loudly, or fall back to the configured secondary bucket."],
          ["Password or passkey", "One identity provider, no second auth system to maintain."],
        ].map(([t, b]) => (
          <div key={t} className="bg-[#0e1113] p-6">
            <Check size={15} className="mb-3 text-[#c8f751]" />
            <p className="text-[13px] font-medium">{t}</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/40">{b}</p>
          </div>
        ))}
      </section>

      {/* closing */}
      <section className="mx-6 mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141a14] via-[#0e1113] to-[#0e1113] px-9 py-14 md:mx-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="d3-mono mb-4 text-[10px] tracking-[.22em] text-[#c8f751] uppercase">
              Before doors open
            </p>
            <h2 className="max-w-[32rem] text-[clamp(1.9rem,3.6vw,3rem)] leading-[1] font-semibold tracking-[-.045em]">
              Put the whole room on the same page.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2.5 rounded-full bg-[#c8f751] px-7 py-3.5 text-[13px] font-semibold text-[#080a0b] transition hover:bg-white"
            >
              Enter admin workspace <ArrowUpRight size={15} />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-[13px] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              <MonitorPlay size={15} /> Preview display
            </a>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 px-8 py-8">
        <span className="d3-mono text-[10px] tracking-[.2em] text-white/35 uppercase">
          Robotics Tryout Control · Team 23442
        </span>
        <span className="d3-mono text-[10px] tracking-[.2em] text-white/35 uppercase">
          Built by Ishaan Bansal
        </span>
      </footer>
    </div>
  );
}

export default BentoControl;