import "./_group.css";
import { ArrowRight, Check, ClipboardList, MessageSquare } from "lucide-react";

export function RicherCards() {
  return (
    <div className="min-h-screen bg-[#f1f5f4] px-6 py-8 text-[#182232] dark:bg-[#101b23] dark:text-[#e8eff2] sm:px-9 sm:py-10">
      <main className="mx-auto max-w-[1120px]">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.22em] text-[#16869a] dark:text-[#73c9c0]">Team 23442 · Coordinator workspace</p>
            <h1 className="text-3xl font-semibold tracking-[-.05em] sm:text-[2.6rem]">Choose a workspace</h1>
            <p className="mt-2 text-sm text-[#65747a] dark:text-[#afc1c9]">Pick the space you need and jump straight in.</p>
          </div>
          <span className="mono hidden rounded-full border border-[#d6e1df] bg-white/70 px-3 py-1.5 text-[10px] uppercase tracking-[.12em] text-[#718189] dark:border-[#344953] dark:bg-[#1a2b34] dark:text-[#b6c7ce] sm:inline-flex">
            02 spaces
          </span>
        </header>

        <section className="grid gap-5 md:grid-cols-2" role="group" aria-label="Choose a workspace">
          <a
            href="/interview"
            data-testid="link-workspace-interview"
            className="group relative isolate flex min-h-[350px] flex-col overflow-hidden rounded-[28px] border border-[#355365] bg-gradient-to-br from-[#173143] via-[#1b3c50] to-[#235064] p-6 text-white shadow-[0_20px_45px_rgba(18,43,58,.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_55px_rgba(18,43,58,.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f8c84a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f1f5f4] dark:border-[#385968] dark:focus-visible:ring-offset-[#101b23] sm:min-h-[370px] sm:p-7"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full border border-white/[.08]" />
            <span aria-hidden="true" className="pointer-events-none absolute -right-7 -top-12 -z-10 h-52 w-52 rounded-full border border-[#f8c84a]/20" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-[38%] -z-10 h-64 w-64 rounded-full bg-[#f8c84a]/[.06] blur-3xl" />

            <div className="relative z-10 flex items-center justify-between">
              <span className="mono inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.16em] text-[#d6e3e7]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f8c84a]" />
                Workspace 01
              </span>
              <span className="mono text-[10px] tracking-[.12em] text-[#b5c8d0]">INTERVIEW</span>
            </div>

            <div className="relative z-10 flex flex-1 items-center justify-end py-5">
              <div aria-hidden="true" className="relative mr-2 h-[142px] w-[172px] sm:mr-7 sm:h-[160px] sm:w-[190px]">
                <div className="absolute inset-x-5 inset-y-2 rotate-[-8deg] rounded-[22px] border border-white/15 bg-white/[.045] shadow-[0_18px_35px_rgba(0,0,0,.14)]" />
                <div className="absolute inset-x-1 inset-y-4 rotate-[5deg] rounded-[22px] border border-white/20 bg-[#24485a]/90 shadow-[0_18px_35px_rgba(0,0,0,.16)]" />
                <div className="absolute inset-x-7 inset-y-0 flex rotate-[-2deg] flex-col rounded-[20px] border border-white/20 bg-[#f5f7f1] p-4 text-[#183a4b] shadow-[0_18px_32px_rgba(0,0,0,.2)]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f8c84a]"><ClipboardList size={17} /></span>
                    <span className="h-1.5 w-8 rounded-full bg-[#dce6e2]" />
                  </div>
                  <div className="space-y-2.5">
                    <span className="flex items-center gap-2"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dff1ec] text-[#16806f]"><Check size={10} strokeWidth={3} /></span><span className="h-1.5 w-14 rounded-full bg-[#9eb6b8]" /></span>
                    <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-[#ccd9d8]" /><span className="h-1.5 w-20 rounded-full bg-[#d0dcda]" /></span>
                    <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-[#ccd9d8]" /><span className="h-1.5 w-16 rounded-full bg-[#d0dcda]" /></span>
                  </div>
                </div>
                <span className="absolute -bottom-1 left-0 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-[#f8c84a] text-[#182232] shadow-lg transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-6deg]"><ClipboardList size={20} /></span>
              </div>
            </div>

            <div className="relative z-10">
              <h2 className="text-[2rem] font-semibold leading-none tracking-[-.055em] sm:text-[2.35rem]">Interview</h2>
              <p className="mt-2 max-w-[300px] text-sm leading-6 text-[#d0dfe4]">Applicant review and interview coordination.</p>
            </div>
            <span className="relative z-10 mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-sm font-semibold">
              <span className="text-[#f8f5e9]">Open interview workspace</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8c84a] text-[#182232] transition-transform group-hover:translate-x-1"><ArrowRight size={17} /></span>
            </span>
          </a>

          <a
            href="/chat"
            data-testid="link-workspace-chat"
            className="group relative isolate flex min-h-[350px] flex-col overflow-hidden rounded-[28px] border border-[#b8d8d3] bg-gradient-to-br from-[#e8f5f0] via-[#e1f2ed] to-[#d3e9e5] p-6 text-[#183a4b] shadow-[0_20px_45px_rgba(26,73,73,.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_55px_rgba(26,73,73,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16869a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f1f5f4] dark:border-[#35616a] dark:bg-gradient-to-br dark:from-[#173542] dark:via-[#1a3d49] dark:to-[#214c55] dark:text-[#e8eff2] dark:focus-visible:ring-offset-[#101b23] sm:min-h-[370px] sm:p-7"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full border border-[#16869a]/15 dark:border-[#a3e0d8]/10" />
            <span aria-hidden="true" className="pointer-events-none absolute -right-7 -top-12 -z-10 h-52 w-52 rounded-full border border-[#16869a]/15 dark:border-[#a3e0d8]/15" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-[38%] -z-10 h-64 w-64 rounded-full bg-white/45 blur-3xl dark:bg-[#7ed0c4]/[.07]" />

            <div className="relative z-10 flex items-center justify-between">
              <span className="mono inline-flex items-center gap-2 rounded-full border border-[#16869a]/15 bg-white/55 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.16em] text-[#46646b] dark:border-white/15 dark:bg-white/[.06] dark:text-[#c3d7da]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16869a] dark:bg-[#7ed0c4]" />
                Workspace 02
              </span>
              <span className="mono text-[10px] tracking-[.12em] text-[#55747a] dark:text-[#bed4d8]">TEAM CHAT</span>
            </div>

            <div className="relative z-10 flex flex-1 items-center justify-end py-5">
              <div aria-hidden="true" className="relative mr-2 h-[142px] w-[172px] sm:mr-7 sm:h-[160px] sm:w-[190px]">
                <div className="absolute right-5 top-3 h-[92px] w-[124px] rounded-[20px] border border-[#16869a]/15 bg-white/45 shadow-[0_18px_35px_rgba(30,81,84,.08)] dark:border-white/10 dark:bg-white/[.06]" />
                <div className="absolute left-3 top-10 flex h-[92px] w-[142px] rotate-[-4deg] flex-col rounded-[20px] border border-white/75 bg-white/90 p-4 shadow-[0_18px_35px_rgba(30,81,84,.13)] dark:border-white/15 dark:bg-[#254c57]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#16869a] text-white dark:bg-[#48b8ab]"><MessageSquare size={14} /></span>
                    <span className="h-1.5 w-14 rounded-full bg-[#99b5b5] dark:bg-[#94b7b9]" />
                  </div>
                  <span className="mt-3 flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#65bdb1]" />
                    <span className="h-2 w-2 rounded-full bg-[#65bdb1]/65" />
                    <span className="h-2 w-2 rounded-full bg-[#65bdb1]/35" />
                  </span>
                  <span className="absolute -bottom-4 -right-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-[#f8c84a] text-[#183a4b] shadow-md transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[7deg]"><MessageSquare size={18} /></span>
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <h2 className="text-[2rem] font-semibold leading-none tracking-[-.055em] sm:text-[2.35rem]">Chat</h2>
              <p className="mt-2 max-w-[300px] text-sm leading-6 text-[#46646b] dark:text-[#d0e0e3]">Keep the team connected throughout the event.</p>
            </div>
            <span className="relative z-10 mt-5 flex items-center justify-between border-t border-[#183a4b]/15 pt-4 text-sm font-semibold dark:border-white/15">
              <span className="dark:text-[#f2f7f8]">Open team chat</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16869a] text-white transition-transform group-hover:translate-x-1 dark:bg-[#48b8ab] dark:text-[#10252d]"><ArrowRight size={17} /></span>
            </span>
          </a>
        </section>
      </main>
    </div>
  );
}