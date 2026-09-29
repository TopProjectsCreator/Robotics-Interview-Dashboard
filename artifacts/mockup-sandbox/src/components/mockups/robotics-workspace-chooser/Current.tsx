import "./_group.css";
import { ArrowRight, ClipboardList, MessageSquare } from "lucide-react";

function PageHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.22em] text-[#16869a]">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-[-.045em] md:text-4xl">{title}</h1>
        {detail && <p className="mt-2 max-w-2xl text-sm text-[#718189]">{detail}</p>}
      </div>
    </div>
  );
}

export function Current() {
  return (
    <div className="min-h-screen bg-[#f3f6f5] p-7 text-[#182232] dark:bg-[#111e27] dark:text-[#e5edf3] md:p-9">
      <main className="fade-up min-h-[calc(100dvh-160px)] rounded-3xl bg-[#f3f6f5] p-1 text-[#182232] dark:bg-[#111e27] dark:text-[#e5edf3]">
        <PageHeading eyebrow="Coordinator workspace" title="Choose a workspace" detail="Open a workspace to continue." />
        <div className="grid gap-5 md:grid-cols-2" role="group" aria-label="Choose a workspace">
          <a
            href="/interview"
            data-testid="link-workspace-interview"
            className="group relative isolate flex min-h-[280px] flex-col justify-between overflow-hidden rounded-3xl border border-[#263e50] bg-[#172a3a] p-7 text-white shadow-[0_8px_28px_rgba(23,42,58,.12)] transition hover:-translate-y-1 hover:bg-[#1d3545] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16869a] focus-visible:ring-offset-2 md:min-h-[clamp(24rem,55vh,34rem)] md:p-8 dark:border-[#31495b]"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 z-0 h-64 w-64 rounded-full border border-white/10" />
            <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 z-0 h-48 w-48 rounded-full border border-white/10" />
            <span className="relative z-10 flex items-start justify-between">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8c84a] text-[#182232]">
                <ClipboardList size={25} />
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-[#f8c84a] group-hover:text-[#182232]">
                <ArrowRight size={19} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
            <span className="relative z-10 text-3xl font-semibold tracking-[-.04em] md:text-4xl">Interview</span>
          </a>
          <a
            href="/chat"
            data-testid="link-workspace-chat"
            className="group relative isolate flex min-h-[280px] flex-col justify-between overflow-hidden rounded-3xl border border-[#b9d9d7] bg-[#e8f5f2] p-7 text-[#183a4b] shadow-[0_8px_28px_rgba(26,49,60,.07)] transition hover:-translate-y-1 hover:border-[#16869a] hover:bg-[#def1ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16869a] focus-visible:ring-offset-2 md:min-h-[clamp(24rem,55vh,34rem)] md:p-8 dark:border-[#2a5663] dark:bg-[#173443] dark:text-[#e5edf3] dark:hover:bg-[#1c4050]"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 z-0 h-64 w-64 rounded-full border border-[#16869a]/15 dark:border-[#73c9bf]/15" />
            <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 z-0 h-48 w-48 rounded-full border border-[#16869a]/15 dark:border-[#73c9bf]/15" />
            <span className="relative z-10 flex items-start justify-between">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16869a] text-white dark:bg-[#39a89e]">
                <MessageSquare size={25} />
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#183a4b]/[0.06] text-[#183a4b] transition group-hover:bg-[#16869a] group-hover:text-white dark:bg-white/10 dark:text-white dark:group-hover:bg-[#39a89e]">
                <ArrowRight size={19} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
            <span className="relative z-10 text-3xl font-semibold tracking-[-.04em] md:text-4xl">Chat</span>
          </a>
        </div>
      </main>
    </div>
  );
}