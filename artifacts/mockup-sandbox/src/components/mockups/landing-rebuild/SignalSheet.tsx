import "./_group.css";
import { ArrowRight, ArrowUpRight, MonitorPlay } from "lucide-react";

/**
 * CONCEPT 4 — "Signal Sheet"
 * Structure: a Swiss-brutalist sheet. Everything is set on an explicit 12-column
 * grid with visible column rules, heavy rules under every block, one red accent,
 * zero border radius, zero shadows, zero cards. Sections are numbered in the
 * margin like a printed spec sheet, and the hero is a full-bleed type stack
 * rather than a copy-plus-image split.
 */
export function SignalSheet() {
  const blocks = [
    {
      n: "01",
      col: "col-span-12 lg:col-span-5",
      title: "Arrival",
      head: "Front desk, one screen.",
      body: "Check an applicant in and their grade, lane and seat resolve instantly. No retyping names into a second spreadsheet, and nothing for a volunteer to remember afterwards.",
      rows: [
        ["Roster import", "semicolon-safe CSV"],
        ["Invalid AI score", "preserved as invalid"],
        ["Check-in source of truth", "server"],
      ],
    },
    {
      n: "02",
      col: "col-span-12 lg:col-span-7",
      title: "Queue",
      head: "Derived, never typed.",
      body: "Position comes from roster order and completion status. Finish one interview and the front desk, the room lead and the waiting-room display all update on their next poll.",
      rows: [
        ["Active slots", "interviewer count"],
        ["Default", "2"],
        ["Maximum", "12"],
      ],
    },
    {
      n: "03",
      col: "col-span-12 lg:col-span-7",
      title: "Workspaces",
      head: "After the tryout, the season starts.",
      body: "Chat with attachments, reactions, polls and server-scheduled messages. Collaborative documents, whiteboards and spreadsheets that persist before they broadcast. Private CAD with chunked uploads. Code with AI edits, Git, FTC TeamCode export and USB ADB tools. Parts with supplier sync and cost tracking.",
      rows: [
        ["Documents", "persist before broadcast"],
        ["CAD previews", "in-browser"],
        ["Scheduling", "local timezone"],
      ],
    },
    {
      n: "04",
      col: "col-span-12 lg:col-span-5",
      title: "Display",
      head: "Deliberately narrow.",
      body: "The big-screen endpoint returns names, grades, lanes and announcement copy. It never returns an email, a transcript, a note or an AI concern. That limit is the product decision.",
      rows: [
        ["Emails", "never exposed"],
        ["Transcripts", "never exposed"],
        ["Names, grades, lanes", "exposed"],
      ],
    },
  ];

  return (
    <div className="d4-sans min-h-[1500px] bg-[#ffffff] text-[#0a0a0a]">
      {/* masthead strip */}
      <header className="border-b-[3px] border-[#0a0a0a]">
        <div className="grid grid-cols-12">
          <div className="col-span-12 flex flex-wrap items-center justify-between gap-4 px-6 py-4 md:col-span-6 md:px-8">
            <span className="flex items-center gap-2.5 text-[13px] font-bold tracking-[-.02em]">
              <span className="flex h-6 w-6 items-center justify-center bg-[#ff2b1f] text-white">
                <span className="d4-mono text-[11px] font-bold">R</span>
              </span>
              ROBOTICS TRYOUT CONTROL
            </span>
            <span className="d4-mono text-[10px] tracking-[.2em] text-[#0a0a0a]/45 uppercase">
              Sheet 01 / 04 · Team 23442
            </span>
          </div>
          <div className="col-span-12 flex items-center justify-end gap-8 border-t border-[#0a0a0a]/15 px-6 py-4 md:col-span-6 md:border-t-0 md:border-l md:px-8">
            {["The day", "The queue", "The team", "Questions"].map((l) => (
              <a
                key={l}
                href="#"
                className="d4-mono text-[10.5px] tracking-[.16em] uppercase transition hover:text-[#ff2b1f]"
              >
                {l}
              </a>
            ))}
            <a
              href="#"
              className="d4-mono inline-flex items-center gap-2 bg-[#0a0a0a] px-4 py-2.5 text-[10.5px] tracking-[.16em] text-white uppercase transition hover:bg-[#ff2b1f]"
            >
              Sign in <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </header>

      {/* hero: full-bleed type stack */}
      <section className="grid grid-cols-12 border-b-[3px] border-[#0a0a0a]">
        <div className="col-span-12 border-b border-[#0a0a0a]/15 px-6 pt-14 pb-10 md:col-span-9 md:px-8">
          <p className="d4-mono mb-8 text-[10.5px] tracking-[.28em] text-[#ff2b1f] uppercase">
            Tryout day operations · live from 07:45
          </p>
          <h1 className="text-[clamp(2.9rem,8.2vw,7.4rem)] leading-[.84] font-black tracking-[-.055em] uppercase">
            Run the room.
            <br />
            <span className="text-white [-webkit-text-stroke:2px_#0a0a0a]">Not the</span>{" "}
            <span className="bg-[#ff2b1f] px-3 text-white">day</span>
          </h1>
        </div>
        <div className="col-span-12 flex flex-col justify-between gap-8 border-t border-[#0a0a0a]/15 px-6 py-8 md:col-span-3 md:border-t-0 md:border-l md:px-8">
          <p className="text-[14px] leading-[1.65] text-[#0a0a0a]/75">
            A control surface for robotics tryouts. Arrival, queue, bays and a
            waiting-room display that publishes names, grades and lanes — and nothing
            else.
          </p>
          <div className="flex flex-col gap-2.5">
            <a
              href="#"
              className="group inline-flex items-center justify-between gap-3 border-[3px] border-[#0a0a0a] px-5 py-3.5 text-[12px] font-bold tracking-[-.01em] transition hover:bg-[#0a0a0a] hover:text-white"
            >
              Open admin workspace
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-between gap-3 border-[3px] border-[#0a0a0a]/25 px-5 py-3.5 text-[12px] font-bold transition hover:border-[#ff2b1f] hover:text-[#ff2b1f]"
            >
              Preview display
              <MonitorPlay size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* stat band */}
      <section className="grid grid-cols-2 border-b-[3px] border-[#0a0a0a] md:grid-cols-4">
        {[
          ["07:45", "Doors open"],
          ["04", "In the room"],
          ["02", "In a bay"],
          ["11", "Still queued"],
        ].map(([n, l], i) => (
          <div
            key={l}
            className={`px-6 py-7 md:px-8 ${
              i < 3 ? "border-r border-[#0a0a0a]/15" : ""
            } ${i === 1 ? "max-md:border-r max-md:border-[#0a0a0a]/15" : ""} ${
              i === 3 ? "max-md:col-span-2 max-md:border-t max-md:border-[#0a0a0a]/15" : ""
            } ${i === 2 ? "max-md:border-t max-md:border-[#0a0a0a]/15" : ""}`}
          >
            <div className="text-[clamp(2rem,4vw,3.2rem)] leading-none font-black tracking-[-.05em] tabular-nums">
              {n}
            </div>
            <div className="d4-mono mt-2.5 text-[10px] tracking-[.22em] text-[#0a0a0a]/50 uppercase">
              {l}
            </div>
          </div>
        ))}
      </section>

      {/* numbered spec blocks on an explicit grid */}
      <section className="grid grid-cols-12 border-b-[3px] border-[#0a0a0a]">
        {blocks.map((b, i) => (
          <article
            key={b.n}
            className={`${b.col} px-6 py-11 md:px-8 ${
              i < blocks.length - 1 ? "border-b border-[#0a0a0a]/15 lg:border-b-0" : ""
            } ${i === 0 ? "lg:border-r lg:border-[#0a0a0a]/15" : ""} ${
              i === 1 ? "lg:border-r lg:border-[#0a0a0a]/15" : ""
            } ${i === 2 ? "lg:border-r lg:border-[#0a0a0a]/15" : ""} ${
              i === 0 || i === 2 ? "lg:border-b lg:border-[#0a0a0a]/15" : ""
            }`}
          >
            <div className="mb-7 flex items-baseline gap-4 border-b-2 border-[#0a0a0a] pb-3">
              <span className="text-[38px] leading-none font-black tracking-[-.05em] text-[#ff2b1f]">
                {b.n}
              </span>
              <span className="d4-mono text-[10.5px] tracking-[.26em] uppercase">
                {b.title}
              </span>
            </div>
            <h2 className="max-w-[15ch] text-[clamp(1.4rem,2.4vw,2rem)] leading-[1.02] font-bold tracking-[-.035em] uppercase">
              {b.head}
            </h2>
            <p className="mt-4 max-w-[42ch] text-[13.5px] leading-[1.65] text-[#0a0a0a]/70">
              {b.body}
            </p>
            <dl className="mt-7 border-t border-[#0a0a0a]/20">
              {b.rows.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4 border-b border-[#0a0a0a]/12 py-2.5"
                >
                  <dt className="d4-mono text-[10px] tracking-[.16em] text-[#0a0a0a]/55 uppercase">
                    {k}
                  </dt>
                  <dd className="d4-mono text-[11px] font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>

      {/* display proof — the narrow surface */}
      <section className="grid grid-cols-12 border-b-[3px] border-[#0a0a0a]">
        <div className="col-span-12 border-b border-[#0a0a0a]/15 px-6 py-12 md:col-span-5 md:border-b-0 md:border-r md:px-8">
          <p className="d4-mono mb-4 text-[10.5px] tracking-[.28em] text-[#ff2b1f] uppercase">
            Public surface
          </p>
          <h2 className="text-[clamp(1.8rem,3.6vw,3rem)] leading-[.98] font-black tracking-[-.05em] uppercase">
            A family can
            <br />
            read this all day.
          </h2>
          <p className="mt-5 max-w-[38ch] text-[13.5px] leading-[1.65] text-[#0a0a0a]/70">
            Point the big screen at the door and leave it. The endpoint returns the
            current instruction plus the names or lanes you choose to show. A sanitized
            waiting-room display, not a window into applicant data.
          </p>
        </div>
        <div className="col-span-12 bg-[#0a0a0a] px-6 py-12 text-white md:col-span-7 md:px-8">
          <div className="d4-mono mb-9 flex items-center justify-between text-[10px] tracking-[.24em] text-white/45 uppercase">
            <span>Live interview queue</span>
            <span className="flex items-center gap-2 text-[#ff2b1f]">
              <span className="h-1.5 w-1.5 bg-[#ff2b1f]" /> live
            </span>
          </div>
          <p className="text-[13px] tracking-[.2em] text-white/45 uppercase">Now calling</p>
          <p className="mt-3 text-[clamp(2.4rem,6vw,4.6rem)] leading-[.92] font-black tracking-[-.05em] uppercase">
            Jordan M.
          </p>
          <div className="d4-mono mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/15 pt-5 text-[10.5px] tracking-[.18em] uppercase">
            <span>Corresponding interviewer</span>
            <span className="text-[#ff2b1f]">Bay 02</span>
            <span className="text-white/40">Grade 8</span>
          </div>
          <div className="d4-mono mt-9 space-y-1.5 text-[10px] tracking-[.14em] text-white/25 uppercase">
            <p>emails — never exposed</p>
            <p>transcripts — never exposed</p>
            <p>notes — never exposed</p>
          </div>
        </div>
      </section>

      {/* roster strip */}
      <section className="border-b-[3px] border-[#0a0a0a] px-6 py-12 md:px-8">
        <div className="d4-mono mb-6 text-[10.5px] tracking-[.28em] text-[#ff2b1f] uppercase">
          Queue, 08:42
        </div>
        <div className="overflow-hidden border-2 border-[#0a0a0a]">
          <div className="d4-mono grid grid-cols-[2.2rem_1fr_7rem_6rem] gap-3 border-b-2 border-[#0a0a0a] bg-[#0a0a0a] px-4 py-2.5 text-[10px] tracking-[.2em] text-white uppercase md:grid-cols-[2.5rem_1fr_9rem_9rem_7rem]">
            <span>#</span>
            <span>Applicant</span>
            <span className="max-md:hidden">Lane</span>
            <span>Grade</span>
            <span className="max-md:hidden">Status</span>
          </div>
          {[
            ["1", "Jordan M.", "Bay 02", "8", "Interviewing", true],
            ["2", "Alex R.", "Bay 01", "9", "Interviewing", true],
            ["3", "Sam K.", "Next up", "7", "Waiting", false],
            ["4", "Tariq D.", "Next up", "10", "Waiting", false],
            ["5", "Mina L.", "Next up", "8", "Waiting", false],
          ].map(([n, name, lane, grade, status, hot]) => (
            <div
              key={name as string}
              className={`d4-mono grid grid-cols-[2.2rem_1fr_7rem_6rem] items-center gap-3 border-b border-[#0a0a0a]/12 px-4 py-3 text-[11.5px] last:border-b-0 md:grid-cols-[2.5rem_1fr_9rem_9rem_7rem] ${
                hot ? "bg-[#ff2b1f]/[.08]" : ""
              }`}
            >
              <span className="text-[#0a0a0a]/40">{n as string}</span>
              <span className="font-medium">{name as string}</span>
              <span className="max-md:hidden text-[#0a0a0a]/65">{lane as string}</span>
              <span className="text-[#0a0a0a]/65">{grade as string}</span>
              <span
                className={`max-md:hidden tracking-[.14em] uppercase ${
                  hot ? "text-[#ff2b1f]" : "text-[#0a0a0a]/40"
                }`}
              >
                {status as string}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* closing bar */}
      <section className="grid grid-cols-12">
        <div className="col-span-12 bg-[#ff2b1f] px-6 py-14 text-white md:col-span-8 md:px-8">
          <p className="d4-mono mb-5 text-[10.5px] tracking-[.28em] uppercase opacity-80">
            Before the first applicant
          </p>
          <h2 className="max-w-[18ch] text-[clamp(2rem,4.4vw,3.6rem)] leading-[.92] font-black tracking-[-.05em] uppercase">
            One room, one page.
          </h2>
        </div>
        <div className="col-span-12 flex flex-col justify-center gap-4 border-t-[3px] border-[#0a0a0a] px-6 py-14 md:col-span-4 md:border-t-0 md:border-l-[3px] md:px-8">
          <a
            href="#"
            className="group inline-flex items-center justify-between gap-3 bg-[#0a0a0a] px-5 py-4 text-[12px] font-bold tracking-[.04em] text-white uppercase transition hover:bg-[#ff2b1f]"
          >
            Coordinator sign-in
            <ArrowRight size={16} className="transition group-hover:translate-x-1" />
          </a>
          <p className="d4-mono text-[10px] tracking-[.2em] text-[#0a0a0a]/50 uppercase">
            Built by Team 23442 · Ishaan Bansal
          </p>
        </div>
      </section>
    </div>
  );
}

export default SignalSheet;