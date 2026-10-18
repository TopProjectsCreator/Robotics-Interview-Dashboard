import "./_group.css";
import { ArrowRight, MonitorPlay } from "lucide-react";

/**
 * CONCEPT 5 — "Runbook"
 * Structure: the landing page IS the runbook. A left sticky index rail lists
 * steps; the right column is a stack of wide, flat operational entries with
 * timestamps, owner tags, command-style calls to action, and terminal/ASCII
 * accents. Deliberately dense, horizontal, and utilitarian — no rounded cards,
 * no marketing gradients, no centred anything.
 */
export function Runbook() {
  const steps = [
    {
      id: "step-01",
      t: "07:45",
      owner: "front desk",
      title: "Open the arrival view",
      body: "Import lands as semicolon-delimited CSV so commas inside quoted JSON survive. An AI score of -1 stays invalid instead of becoming a zero.",
      cmd: "$ roster.import --file team23442.csv --delimiter ';'",
      note: "source of truth stays on the server",
    },
    {
      id: "step-02",
      t: "08:05",
      owner: "front desk",
      title: "Check people in",
      body: "Attendance is a counter, not a document. Eighteen of twenty-four, with six expected inside the next twenty minutes.",
      cmd: "$ attendance.checkin --name 'Jordan M.' --seat 12",
      note: "18/24 · 75%",
    },
    {
      id: "step-03",
      t: "08:30",
      owner: "interviewers",
      title: "Advance the queue",
      body: "One deliberate action moves the lane. Queue position is derived from roster order plus completion status, so every view catches up on its next poll.",
      cmd: "$ queue.advance --lane bay-02",
      note: "active slots = interviewer count",
    },
    {
      id: "step-04",
      t: "10:15",
      owner: "any admin",
      title: "File the decision",
      body: "Scores and lanes write once. Notes stay out of the public surface entirely — the display endpoint never returns them.",
      cmd: "$ decision.file --lane accept-build --score 8",
      note: "notes never reach /display",
    },
    {
      id: "step-05",
      t: "14:00",
      owner: "team lead",
      title: "Hand off to the season",
      body: "Chat, documents, CAD, code and parts all read from the same team identity. Workspace visibility is set in Settings and enforced server-side.",
      cmd: "$ workspace.open --team 23442",
      note: "verified session, never client claims",
    },
  ];

  return (
    <div className="d5-mono flex min-h-[1450px] bg-[#050806] text-[#e6f7ec]">
      {/* sticky index rail */}
      <aside className="sticky top-0 hidden h-[1450px] w-[16rem] shrink-0 flex-col border-r border-[#33ff99]/20 bg-[#040705] px-6 py-8 lg:flex">
        <div className="mb-9">
          <p className="text-[11px] tracking-[.26em] text-[#33ff99] uppercase">
            tryout-day
          </p>
          <p className="mt-1 text-[11px] tracking-[.26em] text-[#33ff99]/40 uppercase">
            runbook v4
          </p>
        </div>
        <nav className="flex-1">
          <ul className="space-y-3.5">
            {steps.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="group flex items-baseline gap-2.5 text-[11px] tracking-[.1em] text-[#33ff99]/45 transition hover:text-[#33ff99]"
                >
                  <span className="text-[#33ff99]/25 group-hover:text-[#33ff99]/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{s.title}</span>
                </a>
              </li>
            ))}
            <li className="!mt-6 border-t border-[#33ff99]/15 pt-4">
              <a href="#display" className="text-[11px] tracking-[.1em] text-[#33ff99]/45 transition hover:text-[#33ff99]">
                public display
              </a>
            </li>
            <li>
              <a href="#access" className="text-[11px] tracking-[.1em] text-[#33ff99]/45 transition hover:text-[#33ff99]">
                access model
              </a>
            </li>
          </ul>
        </nav>
        <div className="d-scanlines border-t border-[#33ff99]/20 pt-4">
          <p className="text-[10px] tracking-[.18em] text-[#33ff99]/50 uppercase">
            status: ready
          </p>
          <p className="mt-1 text-[10px] tracking-[.18em] text-[#33ff99]/25 uppercase">
            team 23442 · private
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* head */}
        <header className="border-b border-[#33ff99]/20 px-7 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="border border-[#33ff99]/50 px-2 py-1 text-[10px] tracking-[.2em] uppercase">
                robotics
              </span>
              <span className="text-[12px] tracking-[.2em] uppercase">tryout_control</span>
              <span className="text-[12px] text-[#33ff99]/35">::main</span>
            </div>
            <nav className="flex flex-wrap items-center gap-5">
              {["steps", "display", "access"].map((l) => (
                <a key={l} href="#" className="text-[11px] tracking-[.14em] text-[#33ff99]/50 transition hover:text-[#33ff99]">
                  {l}
                </a>
              ))}
              <a
                href="#"
                className="inline-flex items-center gap-2 border border-[#33ff99] bg-[#33ff99] px-4 py-2 text-[11px] font-medium tracking-[.12em] text-[#050806] uppercase transition hover:bg-transparent hover:text-[#33ff99]"
              >
                sign_in <ArrowRight size={12} />
              </a>
            </nav>
          </div>
        </header>

        {/* hero as a boot sequence */}
        <section className="border-b border-[#33ff99]/20 px-7 py-12">
          <div className="mb-8 space-y-1.5 text-[12px] leading-relaxed">
            <p className="text-[#33ff99]/40">
              <span className="text-[#33ff99]/70">$</span> tryout_control boot --day 2024-11-16
            </p>
            <p className="text-[#33ff99]/40">loading workspace config ... <span className="text-[#33ff99]">ok</span></p>
            <p className="text-[#33ff99]/40">verifying session &amp; team route ... <span className="text-[#33ff99]">ok</span></p>
            <p className="text-[#33ff99]/40">subscribing queue stream ... <span className="text-[#33ff99]">connected</span></p>
          </div>

          <h1 className="max-w-[26ch] text-[clamp(2rem,5.6vw,4rem)] leading-[.98] tracking-[-.02em]">
            Run the room
            <br />
            like you mean it.
          </h1>
          <p className="mt-6 max-w-[62ch] text-[13px] leading-[1.8] text-[#33ff99]/60">
            One operating surface for robotics tryouts. Every handoff below is a step, not
            a feature — arrival, queue, bays, decisions, and a waiting-room display that
            publishes names, grades and lanes and nothing else.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#step-01"
              className="inline-flex items-center gap-2.5 bg-[#33ff99] px-5 py-3 text-[12px] tracking-[.1em] text-[#050806] uppercase transition hover:bg-transparent hover:text-[#33ff99]"
            >
              start at step 01 <ArrowRight size={13} />
            </a>
            <a
              href="#display"
              className="inline-flex items-center gap-2.5 border border-[#33ff99]/40 px-5 py-3 text-[12px] tracking-[.1em] text-[#33ff99] uppercase transition hover:border-[#33ff99]"
            >
              <MonitorPlay size={13} /> preview /display
            </a>
          </div>
        </section>

        {/* steps */}
        <section>
          {steps.map((s, i) => (
            <article
              key={s.id}
              id={s.id}
              className="scroll-mt-8 border-b border-[#33ff99]/20 px-7 py-9 transition hover:bg-[#33ff99]/[.03]"
            >
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <span className="text-[#33ff99]/30">//</span>
                <span className="text-[11px] tracking-[.16em] text-[#33ff99]/45">
                  STEP {String(i + 1).padStart(2, "0")}
                </span>
                <span className="border border-[#33ff99]/25 px-2 py-0.5 text-[10px] tracking-[.16em] text-[#33ff99]/60 uppercase">
                  {s.t}
                </span>
                <span className="text-[10px] tracking-[.16em] text-[#33ff99]/30 uppercase">
                  owner: {s.owner}
                </span>
              </div>
              <h2 className="text-[clamp(1.25rem,2.6vw,1.9rem)] leading-tight tracking-[-.02em]">
                {s.title}
              </h2>
              <p className="mt-3 max-w-[68ch] text-[12.5px] leading-[1.8] text-[#33ff99]/55">{s.body}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                <code className="border-l-2 border-[#33ff99] bg-[#33ff99]/[.06] px-4 py-2 text-[11.5px] text-[#33ff99]">
                  {s.cmd}
                </code>
                <span className="text-[10.5px] tracking-[.14em] text-[#33ff99]/30 uppercase">
                  # {s.note}
                </span>
              </div>
            </article>
          ))}
        </section>

        {/* display section */}
        <section id="display" className="scroll-mt-8 border-b border-[#33ff99]/20 px-7 py-11">
          <p className="text-[11px] tracking-[.16em] text-[#33ff99]/45">STEP 06 · any time</p>
          <h2 className="mt-3 text-[clamp(1.25rem,2.6vw,1.9rem)] tracking-[-.02em]">public display</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="border border-[#33ff99]/30 p-6">
              <p className="text-[10.5px] tracking-[.18em] text-[#33ff99]/40 uppercase">
                GET /display
              </p>
              <pre className="mt-4 overflow-x-auto text-[11.5px] leading-[1.9] text-[#33ff99]/75">
                {`{
  "now_calling": "Jordan M.",
  "lane": "Bay 02",
  "grade": 8,
  "announcement": "Corresponding
                    interviewer"
}`}
              </pre>
            </div>
            <div className="border border-[#33ff99]/30 p-6">
              <p className="text-[10.5px] tracking-[.18em] text-[#33ff99]/40 uppercase">
                never in the payload
              </p>
              <ul className="mt-4 space-y-2 text-[12px] text-[#33ff99]/50">
                {["email", "transcript", "interview notes", "AI concerns", "attachments"].map(
                  (k) => (
                    <li key={k} className="flex items-center gap-3">
                      <span className="text-[#ff2b1f]">×</span>
                      <span className="line-through decoration-[#ff2b1f]/50">{k}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* access model */}
        <section id="access" className="scroll-mt-8 border-b border-[#33ff99]/20 px-7 py-11">
          <p className="text-[11px] tracking-[.16em] text-[#33ff99]/45">STEP 07 · before doors</p>
          <h2 className="mt-3 text-[clamp(1.25rem,2.6vw,1.9rem)] tracking-[-.02em]">access model</h2>
          <div className="mt-6 space-y-4 text-[12.5px] leading-[1.8] text-[#33ff99]/55">
            <p>
              <span className="text-[#33ff99]">$</span> identity comes from a server-verified
              interviewer session — password or passkey. There is exactly one auth provider,
              and no second one.
            </p>
            <p>
              <span className="text-[#33ff99]">$</span> the team is routed to a primary or
              secondary instance from that signed session. Isolation is a server concern,
              never a URL parameter.
            </p>
            <p>
              <span className="text-[#33ff99]">$</span> workspace visibility is configured in
              Settings and enforced server-side. The nav filters itself; it is not the
              security boundary.
            </p>
          </div>
        </section>

        {/* footer CTA */}
        <footer className="px-7 py-12">
          <p className="text-[11px] tracking-[.16em] text-[#33ff99]/45">STEP 08 · go</p>
          <h2 className="mt-3 max-w-[22ch] text-[clamp(1.6rem,4vw,2.8rem)] leading-[1.02] tracking-[-.03em]">
            open the workspace.
          </h2>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2.5 bg-[#33ff99] px-5 py-3 text-[12px] tracking-[.1em] text-[#050806] uppercase transition hover:bg-transparent hover:text-[#33ff99]"
            >
              coordinator_sign_in <ArrowRight size={13} />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 border border-[#33ff99]/40 px-5 py-3 text-[12px] tracking-[.1em] text-[#33ff99] uppercase transition hover:border-[#33ff99]"
            >
              view_public_display
            </a>
          </div>
          <div className="mt-10 border-t border-[#33ff99]/15 pt-5 text-[10px] tracking-[.18em] text-[#33ff99]/25 uppercase">
            <span className="text-[#33ff99]">$</span> exit 0 — built by Team 23442, Ishaan Bansal
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Runbook;