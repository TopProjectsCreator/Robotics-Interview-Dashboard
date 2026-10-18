import "./_group.css";
import { ArrowRight, Check, Columns2, Feather, Lock, MonitorPlay, Quote } from "lucide-react";

/**
 * CONCEPT 2 — "Broadsheet"
 * Structure: an editorial newspaper front page. Masthead with hairline rules and
 * a folio line, a three-column drop-cap lede, a two-column body with a sidebar
 * in the classic editorial margin, centred pull quote, and an index-style
 * closing block. Hairline borders everywhere instead of cards and shadows.
 */
export function Broadsheet() {
  const columns = [
    {
      kicker: "Arrival",
      title: "A front desk that already knows the roster",
      body: "Check an applicant in against the imported roster and their grade, lane and seat assignment resolve on the spot. Nobody retypes a name into a second spreadsheet, and nobody asks a volunteer to remember where they wrote it down.",
    },
    {
      kicker: "Queues",
      title: "The next name is never a guess",
      body: "Queue position is derived from roster order and completion, not from a coordinator's memory. Finish a bay and the next applicant is already moving — the display, the front desk and the interviewer all read the same derived state on their next poll.",
    },
    {
      kicker: "Display",
      title: "One instruction, broadcast to the room",
      body: "The big screen shows names, grades, lanes and announcement copy. No emails, no transcripts, no notes, no AI concerns — a deliberately narrow surface you can point a family member at without thinking twice.",
    },
  ];

  return (
    <div className="d2-text min-h-[1500px] bg-[#f6f1e7] text-[#1b1713]">
      {/* masthead */}
      <div className="px-10 pt-10">
        <div className="d2-mono flex items-center justify-between border-b border-[#1b1713]/25 pb-2 text-[9px] tracking-[.26em] uppercase">
          <span>Vol. 04 — Tryout season</span>
          <span>Saturday, doors 07:45</span>
          <span>Price: nothing</span>
        </div>
        <div className="flex items-end justify-between gap-8 border-b-[3px] border-[#1b1713] py-6">
          <h1 className="d2-serif text-[clamp(2.6rem,7vw,5.4rem)] leading-[.86] tracking-[-.02em]">
            The Tryout
            <br />
            <span className="italic">Dispatch</span>
          </h1>
          <div className="hidden shrink-0 text-right lg:block">
            <p className="d2-serif text-[13px] leading-snug italic">
              A robotics operations
              <br />
              newspaper
            </p>
            <p className="d2-mono mt-2 text-[9px] tracking-[.22em] uppercase">
              Team 23442 · est. tryout day
            </p>
          </div>
        </div>
        <div className="d2-mono flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-[#1b1713]/25 py-2.5 text-[9px] tracking-[.22em] uppercase">
          <a href="#" className="underline-offset-4 hover:underline">
            The day
          </a>
          <a href="#" className="underline-offset-4 hover:underline">
            The queue
          </a>
          <a href="#" className="underline-offset-4 hover:underline">
            The display
          </a>
          <a href="#" className="underline-offset-4 hover:underline">
            The team
          </a>
          <a href="#" className="underline-offset-4 hover:underline">
            Questions
          </a>
          <span className="ml-auto inline-flex items-center gap-2 text-[#8c2f1d]">
            <MonitorPlay size={12} /> public display
          </span>
          <a href="#" className="inline-flex items-center gap-1.5 font-semibold">
            Sign in <ArrowRight size={11} />
          </a>
        </div>
      </div>

      {/* lede: three columns with drop cap */}
      <section className="grid grid-cols-1 gap-x-10 gap-y-8 px-10 pt-10 lg:grid-cols-[1.55fr_1fr]">
        <div className="columns-1 gap-10 md:columns-2">
          <p className="text-[15.5px] leading-[1.72]">
            <span className="d2-serif float-left mt-1 mr-3 text-[4.1rem] leading-[.74] font-bold">
              I
            </span>
            t is 07:52 on the morning of tryouts and the room has a problem it has had
            every year: four people know four different things. The front desk has a
            printed list. An interviewer has a text thread. The display shows a name
            from twenty minutes ago. Somewhere in the gym a parent is asking when they
            will be called.
          </p>
          <p className="mt-4 text-[15.5px] leading-[1.72]">
            <strong>Robotics Tryout Control</strong> is the answer to a narrow,
            unglamorous problem. It is not an applicant database. It is an operating
            surface for the handful of decisions that keep a tryout moving — who has
            arrived, who is in a bay, who is next — and it publishes exactly that much
            to the room.
          </p>
          <p className="mt-4 text-[15.5px] leading-[1.72]">
            Everything else is deliberately absent. The public endpoint returns names,
            grades, lanes and announcement copy. It never returns an email, a
            transcript, a note or an AI concern. That constraint is the feature: a
            family can read the big screen all afternoon without anyone reaching for a
            laptop.
          </p>
        </div>

        {/* editorial sidebar */}
        <aside className="border-t-[3px] border-[#1b1713] pt-3 lg:border-t-0 lg:border-l lg:border-[#1b1713]/25 lg:pt-0 lg:pl-8">
          <p className="d2-mono mb-4 text-[9px] tracking-[.26em] text-[#8c2f1d] uppercase">
            At a glance · 08:42
          </p>
          <dl className="divide-y divide-[#1b1713]/18 border-y border-[#1b1713]/18">
            {[
              ["In the room", "04"],
              ["Interviewing", "02"],
              ["Still queued", "11"],
              ["Active slots", "2 of 12"],
              ["Checked in", "18 / 24"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="d2-mono text-[10px] tracking-[.18em] uppercase">{k}</dt>
                <dd className="d2-serif text-[19px] font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-[12.5px] leading-[1.65] italic opacity-80">
            Active slots equal the number of interviewer labels configured for the
            team. Two by default, twelve at the outside.
          </p>
        </aside>
      </section>

      {/* pull quote */}
      <section className="px-10 pt-16">
        <blockquote className="relative border-y-[3px] border-[#1b1713] py-9 text-center">
          <Quote size={20} className="mx-auto mb-4 text-[#8c2f1d]" />
          <p className="d2-serif mx-auto max-w-[46rem] text-[clamp(1.5rem,3.4vw,2.5rem)] leading-[1.16] tracking-[-.01em]">
            The best event tool is the one people stop talking about because the room
            simply works.
          </p>
          <footer className="d2-mono mt-5 text-[9px] tracking-[.26em] uppercase">
            Robotics operations · tryout day staff
          </footer>
        </blockquote>
      </section>

      {/* body: two text columns + sidebar index */}
      <section className="grid grid-cols-1 gap-x-10 gap-y-10 px-10 pt-14 lg:grid-cols-[1fr_1fr_15rem]">
        <div>
          <p className="d2-mono mb-3 text-[9px] tracking-[.26em] text-[#8c2f1d] uppercase">
            I. The room
          </p>
          <h2 className="d2-serif mb-4 text-[26px] leading-[1.1] tracking-[-.01em]">
            Four desks, one queue, zero reconciliation
          </h2>
          <p className="text-[14px] leading-[1.75]">
            Queue state is derived, not typed. A coordinator finishes an interview and
            every other view — the front desk, the room lead, the waiting-room display —
            catches up on its next poll. There is no button labelled “tell the display
            about this”, because there does not need to be one. Active slots equal the
            interviewer count you configured, so a second bay is a settings change
            rather than a spreadsheet column.
          </p>
          <p className="mt-4 text-[14px] leading-[1.75]">
            When storage hiccups or a quota runs out, you get an honest error or the
            configured secondary instance. Nothing reports success before the bytes are
            actually stored.
          </p>
        </div>
        <div>
          <p className="d2-mono mb-3 text-[9px] tracking-[.26em] text-[#8c2f1d] uppercase">
            II. The team
          </p>
          <h2 className="d2-serif mb-4 text-[26px] leading-[1.1] tracking-[-.01em]">
            The workspace your team actually keeps open
          </h2>
          <p className="text-[14px] leading-[1.75]">
            Chat with attachments, reactions, polls and scheduled messages in the
            team's local timezone. Collaborative documents, whiteboards and
            spreadsheets that persist before they broadcast. A private CAD library with
            chunked uploads and in-browser previews. An in-browser editor with AI
            edits, a terminal, Git, FTC TeamCode export, REV Hub builds, and USB ADB
            serial tools. Parts catalog with supplier sync and cost tracking.
          </p>
          <ul className="mt-5 space-y-2.5 border-t border-[#1b1713]/18 pt-5">
            {[
              "Workspace access is configured in Settings and enforced on the server",
              "Teams route to isolated primary or secondary instances from a signed session",
              "Sign in with a password or a passkey",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-[13px] leading-[1.6]">
                <Check size={14} className="mt-[3px] shrink-0 text-[#8c2f1d]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t-[3px] border-[#1b1713] pt-3 lg:border-t-0 lg:border-l lg:border-[#1b1713]/25 lg:pt-0 lg:pl-6">
          <p className="d2-mono mb-3 text-[9px] tracking-[.26em] uppercase">In this issue</p>
          <ol className="space-y-2.5">
            {columns.map((c, i) => (
              <li key={c.title} className="border-b border-[#1b1713]/14 pb-2.5">
                <span className="d2-mono mr-2 text-[9px] text-[#8c2f1d]">
                  0{i + 1}
                </span>
                <span className="text-[12.5px] leading-[1.5]">{c.title}</span>
              </li>
            ))}
          </ol>
          <div className="d2-mono mt-5 space-y-1.5 text-[9px] tracking-[.18em] uppercase opacity-70">
            <p className="inline-flex items-center gap-2">
              <Lock size={11} /> private workspace
            </p>
            <p className="inline-flex items-center gap-2">
              <Columns2 size={11} /> two columns, one truth
            </p>
            <p className="inline-flex items-center gap-2">
              <Feather size={11} /> set in Baskerville
            </p>
          </div>
        </div>
      </section>

      {/* running foot of the index entries */}
      <section className="px-10 pt-16">
        {columns.map((c, i) => (
          <article
            key={c.title}
            className="grid grid-cols-1 gap-x-10 gap-y-3 border-t border-[#1b1713] py-7 lg:grid-cols-[9rem_1fr_1.15fr]"
          >
            <div>
              <span className="d2-serif block text-[38px] leading-none font-bold text-[#8c2f1d]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="d2-mono mt-1.5 block text-[9px] tracking-[.26em] uppercase">
                {c.kicker}
              </span>
            </div>
            <h3 className="d2-serif text-[21px] leading-[1.16] tracking-[-.01em]">
              {c.title}
            </h3>
            <p className="text-[13.5px] leading-[1.72] opacity-90">{c.body}</p>
          </article>
        ))}
      </section>

      {/* closing advertisement strip */}
      <section className="mt-6 border-y-[3px] border-[#1b1713] bg-[#1b1713] px-10 py-12 text-[#f6f1e7]">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="d2-mono mb-3 text-[9px] tracking-[.26em] text-[#f8c84a] uppercase">
              Classified · action required before doors
            </p>
            <h2 className="d2-serif text-[clamp(1.6rem,3.4vw,2.6rem)] leading-[1.1]">
              Open the admin workspace, or preview the display.
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#"
              className="d2-mono inline-flex items-center gap-2.5 bg-[#f8c84a] px-7 py-3.5 text-[11px] font-semibold tracking-[.14em] text-[#1b1713] uppercase transition hover:bg-white"
            >
              Coordinator sign-in <ArrowRight size={13} />
            </a>
            <a
              href="#"
              className="d2-mono inline-flex items-center gap-2 border border-white/30 px-6 py-3.5 text-[11px] tracking-[.14em] uppercase transition hover:border-white"
            >
              Public display
            </a>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 px-10 py-6">
        <span className="d2-mono text-[9px] tracking-[.26em] uppercase">
          Robotics Tryout Control · Team 23442
        </span>
        <span className="d2-mono text-[9px] tracking-[.26em] uppercase opacity-60">
          Printed once, on the day · no applicant data on the public display
        </span>
      </footer>
    </div>
  );
}

export default Broadsheet;