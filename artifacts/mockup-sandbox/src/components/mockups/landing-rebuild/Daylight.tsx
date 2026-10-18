import "./_group.css";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Lock,
  MessageSquare,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

/**
 * CONCEPT 6 — "Daylight"
 * Structure: full-bleed stacked scene panels that alternate light and deep
 * bands, a horizontally-scrolling workspace strip, a centred marquee headline
 * that runs edge to edge, and a closing full-width ink block. Reads top to
 * bottom as one continuous vertical narrative — the rhythm comes from
 * full-bleed banding rather than from a contained page grid.
 */
export function Daylight() {
  const scene = [
    {
      when: "The doors open",
      title: "Somebody has to know who is here.",
      body: "A gym, a folding table, twenty-four middle schoolers, and one volunteer with a clipboard. That volunteer should not be the database.",
      tint: "bg-[#f3ede1] text-[#201a12]",
    },
    {
      when: "The first call",
      title: "Nobody should be guessing in the hallway.",
      body: "Queue state is derived from roster order and completion. Finish an interview and the front desk, the room lead and the big screen all know the next name without a single radio call.",
      tint: "bg-[#14342f] text-[#eaf6f1]",
    },
    {
      when: "The last one",
      title: "And the family never sees the paperwork.",
      body: "The waiting-room display returns names, grades, lanes and announcement copy. Nothing else crosses that boundary — not emails, not transcripts, not notes.",
      tint: "bg-[#f3ede1] text-[#201a12]",
    },
  ];

  return (
    <div className="d6-sans min-h-[1500px] overflow-x-hidden bg-[#fbf8f2] text-[#201a12]">
      {/* nav */}
      <header className="px-7 py-5">
        <div className="mx-auto flex max-w-[74rem] flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#201a12] text-[#fbf8f2]">
              <span className="text-[12px] font-bold">R</span>
            </span>
            <span className="text-[14px] font-semibold tracking-[-.01em]">Tryout Control</span>
          </div>
          <nav className="flex flex-wrap items-center gap-7">
            {["The day", "The room", "The team", "Questions"].map((l) => (
              <a key={l} href="#" className="d6-body text-[13px] text-[#201a12]/60 transition hover:text-[#201a12]">
                {l}
              </a>
            ))}
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full bg-[#201a12] px-5 py-2.5 text-[13px] font-medium text-[#fbf8f2] transition hover:bg-[#14342f]"
            >
              Sign in <ArrowRight size={14} />
            </a>
          </nav>
        </div>
      </header>

      {/* full-bleed hero band, no contained grid */}
      <section className="relative overflow-hidden bg-[#f3ede1] px-7 pt-16 pb-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-10%] h-[30rem] w-[30rem] rounded-full bg-[#f0b429]/25 blur-3xl"
        />
        <div className="relative mx-auto max-w-[74rem]">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#201a12]/15 bg-[#fbf8f2]/70 px-3.5 py-1.5 text-[11px] tracking-[.1em] text-[#201a12]/65">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1f9d6b]" /> live during tryouts
          </p>
          <h1 className="max-w-[16ch] text-[clamp(2.6rem,7vw,5.6rem)] leading-[.95] font-semibold tracking-[-.045em]">
            A tryout day, <span className="italic text-[#a8632a]">run</span> by one
            shared screen.
          </h1>
          <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-6">
            <a
              href="#"
              className="group inline-flex items-center gap-3 rounded-full bg-[#201a12] px-7 py-4 text-[14px] font-medium text-[#fbf8f2] transition hover:bg-[#14342f]"
            >
              Open admin workspace
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 text-[14px] text-[#201a12]/70 transition hover:text-[#201a12]"
            >
              <MonitorPlay size={16} /> See the public display
            </a>
            <a href="#" className="inline-flex items-center gap-2 text-[13px] text-[#201a12]/45 transition hover:text-[#201a12]">
              Scroll <ArrowDown size={14} />
            </a>
          </div>
        </div>

        {/* floating device cluster, overlapping the band edge */}
        <div className="relative mx-auto mt-16 max-w-[74rem]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
            <div className="rounded-3xl border border-[#201a12]/10 bg-[#fbf8f2] p-7 shadow-[0_18px_50px_rgba(32,26,18,.08)]">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-[12px] font-medium tracking-[.04em] text-[#201a12]/50">
                  Interview queue
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#1f9d6b]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1f9d6b]" /> synced
                </span>
              </div>
              <div className="space-y-2">
                {[
                  ["Jordan M.", "Bay 02", true],
                  ["Alex R.", "Bay 01", true],
                  ["Sam K.", "Next up", false],
                  ["Tariq D.", "Next up", false],
                ].map(([n, l, hot]) => (
                  <div
                    key={n as string}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                      hot ? "bg-[#f0b429]/15" : "bg-[#f3ede1]"
                    }`}
                  >
                    <span
                      className={`h-8 w-1.5 rounded-full ${
                        hot ? "bg-[#f0b429]" : "bg-[#201a12]/12"
                      }`}
                    />
                    <span className="flex-1 text-[14px] font-medium">{n as string}</span>
                    <span className="text-[12px] text-[#201a12]/50">{l as string}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-[#201a12] p-7 text-[#fbf8f2]">
              <p className="text-[11px] tracking-[.14em] text-[#fbf8f2]/45 uppercase">
                In the room
              </p>
              <p className="mt-4 text-[64px] leading-none font-semibold tracking-[-.05em]">04</p>
              <div className="mt-6 space-y-2.5 text-[12px] text-[#fbf8f2]/60">
                <p>02 interviewing</p>
                <p>11 still queued</p>
                <p>2 active slots</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[#201a12]/10 bg-[#14342f] p-7 text-[#eaf6f1]">
              <p className="text-[11px] tracking-[.14em] text-[#eaf6f1]/45 uppercase">
                Public display
              </p>
              <p className="mt-4 text-[13px] leading-snug">
                Please come to your <span className="text-[#f0b429]">corresponding interviewer</span>
              </p>
              <p className="mt-6 text-[12px] leading-relaxed text-[#eaf6f1]/50">
                Names, grades and lanes only. No transcripts. No notes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* edge-to-edge marquee */}
      <div className="overflow-hidden border-y border-[#201a12]/10 bg-[#f0b429] py-3.5">
        <div className="flex w-max items-center gap-8">
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex items-center gap-8">
              {["Arrival", "Queue", "Bays", "Decisions", "Big screen", "Chat", "CAD", "Code", "Parts"].map(
                (w) => (
                  <span key={w} className="flex shrink-0 items-center gap-8">
                    <span className="text-[13px] font-medium tracking-[.02em] text-[#201a12]">{w}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#201a12]/35" />
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* narrative scenes: alternating full-width bands */}
      {scene.map((s, i) => (
        <section key={s.title} className={`${s.tint} px-7 py-20`}>
          <div className="mx-auto max-w-[74rem]">
            <div className={`grid grid-cols-1 gap-10 lg:grid-cols-12 ${i % 2 === 1 ? "" : ""}`}>
              <div className={`lg:col-span-4 ${i % 2 === 1 ? "lg:order-2 lg:col-start-7" : ""}`}>
                <p
                  className={`text-[11px] tracking-[.18em] uppercase ${
                    i % 2 === 1 ? "text-[#eaf6f1]/45" : "text-[#201a12]/40"
                  }`}
                >
                  0{i + 1} — {s.when}
                </p>
                <h2 className="mt-5 text-[clamp(1.8rem,3.8vw,3rem)] leading-[1.02] font-semibold tracking-[-.04em]">
                  {s.title}
                </h2>
              </div>
              <div
                className={`lg:col-span-7 ${i % 2 === 1 ? "lg:order-1 lg:col-start-1" : "lg:col-start-6"}`}
              >
                <p
                  className={`max-w-[46ch] text-[17px] leading-[1.65] ${
                    i % 2 === 1 ? "text-[#eaf6f1]/70" : "text-[#201a12]/65"
                  }`}
                >
                  {s.body}
                </p>
                <ul className="mt-7 space-y-3">
                  {(
                    i === 0
                      ? ["Roster import that survives quoted commas", "Check-in with grade, lane and seat resolved", "No second clipboard at the table"]
                      : i === 1
                        ? ["Queue derived from order plus completion", "Slots follow your interviewer count", "Every view updates on the next poll"]
                        : ["Names, grades and lanes on the display", "Emails and transcripts never exposed", "Family-safe all afternoon"]
                  ).map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <Check
                        size={16}
                        className={`mt-1 shrink-0 ${i % 2 === 1 ? "text-[#f0b429]" : "text-[#a8632a]"}`}
                      />
                      <span
                        className={`text-[14px] ${
                          i % 2 === 1 ? "text-[#eaf6f1]/70" : "text-[#201a12]/65"
                        }`}
                      >
                        {t}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* horizontal workspace strip */}
      <section className="overflow-hidden bg-[#fbf8f2] py-20">
        <div className="mx-auto max-w-[74rem] px-7">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] tracking-[.18em] text-[#201a12]/40 uppercase">
                After the tryouts
              </p>
              <h2 className="mt-4 max-w-[16ch] text-[clamp(1.8rem,3.8vw,3rem)] leading-[1.02] font-semibold tracking-[-.04em]">
                The rest of the season.
              </h2>
            </div>
            <p className="max-w-[28ch] text-[14px] leading-relaxed text-[#201a12]/55">
              Same team, same identity, same server-enforced access. Workspaces light up
              only if Settings allows them.
            </p>
          </div>
        </div>
        <div className="mt-12 flex w-max gap-4 px-7">
          {[
            ["Chat", "Attachments, reactions, polls, moderation, AI mentions and server-scheduled messages.", MessageSquare],
            ["Documents", "Rich text, whiteboards and spreadsheets that persist before they broadcast.", Sparkles],
            ["Build", "CAD library, in-browser code editor, Git, and USB ADB tools.", Wrench],
          ].map(([title, body, Icon]) => {
            const I = Icon as typeof MessageSquare;
            return (
              <div
                key={title as string}
                className="w-[22rem] shrink-0 rounded-3xl border border-[#201a12]/10 bg-[#f3ede1] p-7"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbf8f2] text-[#a8632a]">
                  <I size={19} />
                </span>
                <p className="mt-6 text-[19px] font-semibold tracking-[-.02em]">{title as string}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#201a12]/60">{body as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* trust strip */}
      <section className="px-7 pb-20">
        <div className="mx-auto grid max-w-[74rem] grid-cols-1 gap-4 md:grid-cols-3">
          {[
            [ShieldCheck, "Private workspace", "Server-verified interviewer sessions with password or passkey sign-in."],
            [Lock, "Isolated teams", "Each team routes to its own primary or secondary instance from a signed session."],
            [Sparkles, "Assistant included", "Team-aware AI help that treats imported applicant text strictly as data."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="rounded-3xl border border-[#201a12]/10 p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14342f] text-[#f0b429]">
                  <I size={19} />
                </span>
                <p className="mt-5 text-[16px] font-semibold tracking-[-.02em]">{title as string}</p>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#201a12]/55">{body as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* full-bleed ink close */}
      <section className="bg-[#201a12] px-7 py-24 text-[#fbf8f2]">
        <div className="mx-auto max-w-[74rem] text-center">
          <p className="text-[11px] tracking-[.2em] text-[#fbf8f2]/40 uppercase">
            Before the first applicant arrives
          </p>
          <h2 className="mx-auto mt-6 max-w-[18ch] text-[clamp(2rem,5.4vw,4rem)] leading-[.98] font-semibold tracking-[-.045em]">
            Put the whole room on the same page.
          </h2>
          <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#"
              className="group inline-flex items-center gap-3 rounded-full bg-[#f0b429] px-8 py-4 text-[14px] font-semibold text-[#201a12] transition hover:bg-[#fbf8f2]"
            >
              Enter admin workspace
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 rounded-full border border-[#fbf8f2]/25 px-7 py-4 text-[14px] text-[#fbf8f2]/80 transition hover:border-[#fbf8f2] hover:text-[#fbf8f2]"
            >
              <MonitorPlay size={16} /> Preview public display
            </a>
          </div>
          <p className="mt-12 text-[12px] tracking-[.1em] text-[#fbf8f2]/30 uppercase">
            Created by Team 23442 · Ishaan Bansal
          </p>
        </div>
      </section>
    </div>
  );
}

export default Daylight;