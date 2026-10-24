import { useState } from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowRight, Cpu, LayoutDashboard, Menu, MessageSquare, Radio, Sparkles, UsersRound, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const sections = [
  {
    index: "01",
    label: "TEAM OPERATIONS",
    title: "Make tryouts easier to coordinate.",
    body: "A dedicated interview workflow brings applicant review and tryout coordination into the same workspace as the rest of the team's work.",
    icon: UsersRound,
    accent: "teal",
  },
  {
    index: "02",
    label: "COLLABORATION",
    title: "Keep the conversation with the work.",
    body: "Team chat and live shared boards keep conversations, working notes, and decisions together instead of scattered across tools.",
    icon: MessageSquare,
    accent: "mint",
  },
  {
    index: "03",
    label: "ENGINEERING",
    title: "Review designs in context.",
    body: "CAD models and engineering files can be previewed alongside the conversations where the team discusses them.",
    icon: Cpu,
    accent: "gold",
  },
  {
    index: "04",
    label: "SHARED KNOWLEDGE",
    title: "Make team information useful.",
    body: "Shared spreadsheets, custom charts, and connected workspace tools help keep important information easy to find.",
    icon: LayoutDashboard,
    accent: "lilac",
  },
];

const accentStyles = {
  teal: "bg-[#dff1ec] text-[#167d78] dark:bg-[#17443f] dark:text-[#7edbd0]",
  mint: "bg-[#e6f2e7] text-[#39794d] dark:bg-[#244331] dark:text-[#a5dfb8]",
  gold: "bg-[#fff0c6] text-[#946b0c] dark:bg-[#4b3c1c] dark:text-[#f1cc67]",
  lilac: "bg-[#e7e7fb] text-[#6351a1] dark:bg-[#322d51] dark:text-[#c8b7ff]",
};

export default function AboutPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="relative isolate min-h-[100dvh] overflow-x-clip bg-[#f5f8f4] text-[#16303b] dark:bg-[#0c1d24] dark:text-[#e3efeb]" data-testid="public-about">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(ellipse_at_78%_3%,rgba(100,174,142,.22),transparent_33%),linear-gradient(180deg,#e8f2ee_0%,#f5f8f4_90%)] dark:bg-[radial-gradient(ellipse_at_78%_3%,rgba(45,117,103,.2),transparent_33%),linear-gradient(180deg,#102f36_0%,#0c1d24_90%)]" />
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] sm:w-[min(1180px,calc(100%-48px))]">
        <header className="relative z-20 flex min-h-[82px] items-center justify-between gap-6">
          <Link href="/" onClick={closeMenu} className="inline-flex shrink-0 text-inherit no-underline" data-testid="link-about-brand">
            <BrandMark ariaLabel="Robotics team logo" dataTestId="about-team-logo" />
          </Link>
          <nav aria-label="Primary navigation" className={`${menuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-[70px] flex-col gap-1 rounded-xl border border-[#d9e6e1] bg-white p-2 shadow-lg dark:border-[#28464d] dark:bg-[#122a32] md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0 md:shadow-none`} data-testid="about-navigation">
            <Link href="/" onClick={closeMenu} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#43616a] hover:text-[#168b94] dark:text-[#b6ceca] dark:hover:text-[#7edbd0]">Home</Link>
            <a href="#what-we-bring-together" onClick={closeMenu} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#43616a] hover:text-[#168b94] dark:text-[#b6ceca] dark:hover:text-[#7edbd0]">What it brings together</a>
            <Link href="/privacy" onClick={closeMenu} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#43616a] hover:text-[#168b94] dark:text-[#b6ceca] dark:hover:text-[#7edbd0]">Privacy</Link>
            <Link href="/terms" onClick={closeMenu} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#43616a] hover:text-[#168b94] dark:text-[#b6ceca] dark:hover:text-[#7edbd0]">Terms</Link>
            <Link href="/auth" onClick={closeMenu} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#153642] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477]">Team sign in <ArrowRight size={14} /></Link>
          </nav>
          <button type="button" className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#bed4ce] text-[#16303b] dark:border-[#3b646b] dark:text-[#e3efeb] md:hidden" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} data-testid="button-about-menu">
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </header>

        <section className="grid items-end gap-10 pb-16 pt-14 sm:pb-24 sm:pt-20 lg:grid-cols-[1.12fr_.88fr] lg:gap-16 lg:pt-28" aria-labelledby="about-title">
          <div className="max-w-[730px]">
            <p className="mb-5 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.15em] text-[#168b94] dark:text-[#7edbd0]"><span className="size-2 rounded-full bg-[#64ae8e]" />ABOUT THE WORKSPACE</p>
            <h1 id="about-title" className="text-[clamp(2.8rem,9vw,6.4rem)] font-semibold leading-[.91] tracking-[-.08em] text-[#153642] dark:text-[#e3efeb]">
              One home for the work <span className="text-[#168b94] dark:text-[#6bd1d0]">behind the robot.</span>
            </h1>
            <p className="mt-7 max-w-[620px] text-base leading-7 text-[#43616a] dark:text-[#aac1be] sm:text-lg sm:leading-8">
              A shared workspace for robotics teams to coordinate tryouts, collaborate on engineering, and keep team knowledge connected.
            </p>
            <a href="#what-we-bring-together" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#153642] px-5 text-xs font-bold text-white transition hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477]" data-testid="link-about-explore">
              See how the workspace fits together <ArrowDown size={15} />
            </a>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[#2c5963] bg-[#153642] p-5 text-[#eaf5f0] shadow-[0_24px_60px_rgba(21,54,66,.18)] sm:p-7" data-testid="about-workspace-map">
            <div aria-hidden="true" className="absolute inset-0 opacity-[.13] [background-image:linear-gradient(rgba(157,221,210,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(157,221,210,.4)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:linear-gradient(120deg,black,transparent_85%)]" />
            <div className="relative flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div><p className="font-mono text-[9px] tracking-[.14em] text-[#8cb7b5]">A SHARED TEAM SPACE</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">Many kinds of work.<br />One connected place.</h2></div>
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/[.08] text-[#efc34f]"><Radio size={21} /></span>
            </div>
            <div className="relative mt-5 grid grid-cols-2 gap-2">
              {[
                { title: "Tryouts", detail: "Applicant review", icon: UsersRound, color: "text-[#7edbd0]" },
                { title: "Engineering", detail: "CAD & 3D previews", icon: Cpu, color: "text-[#f1cc67]" },
                { title: "Collaboration", detail: "Chat & shared boards", icon: MessageSquare, color: "text-[#a5dfb8]" },
                { title: "Team knowledge", detail: "Sheets & dashboards", icon: LayoutDashboard, color: "text-[#c8b7ff]" },
              ].map(({ title, detail, icon: Icon, color }) => (
                <div key={title} className="flex min-h-[92px] items-start gap-3 rounded-xl border border-white/10 bg-[#0c1d24]/35 p-3 sm:p-4">
                  <Icon size={17} className={`mt-0.5 shrink-0 ${color}`} />
                  <div><strong className="block text-xs font-semibold">{title}</strong><span className="mt-1 block text-[10px] leading-4 text-[#a8c6c3]">{detail}</span></div>
                </div>
              ))}
            </div>
            <p className="relative mt-5 flex items-center gap-2 border-t border-white/10 pt-4 font-mono text-[9px] tracking-[.12em] text-[#8cb7b5]"><Sparkles size={12} className="text-[#c8b7ff]" />TOOLS FOR THE WORK BEHIND THE ROBOT</p>
          </div>
        </section>

        <section className="grid grid-cols-2 border-y border-[#d9e6e1] dark:border-[#28464d] sm:grid-cols-4" aria-label="Workspace focus areas">
          {[
            ["01 / Coordinate", "Tryouts & interviews"],
            ["02 / Connect", "Chat & shared boards"],
            ["03 / Design", "CAD & 3D files"],
            ["04 / Organize", "Sheets & insights"],
          ].map(([label, title], index) => <div key={label} className={`py-4 ${index % 2 === 1 ? "border-l border-[#d9e6e1] pl-4 dark:border-[#28464d] sm:px-5" : "pr-3"} ${index < 2 ? "border-b border-[#d9e6e1] dark:border-[#28464d] sm:border-b-0" : ""} ${index > 0 ? "sm:border-l sm:border-[#d9e6e1] sm:px-5 dark:sm:border-[#28464d]" : ""}`}><span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#70868b] dark:text-[#91aaa8]">{label}</span><strong className="mt-2 block text-sm text-[#153642] dark:text-[#e3efeb]">{title}</strong></div>)}
        </section>

        <section id="what-we-bring-together" className="scroll-mt-8 py-16 sm:py-24" aria-labelledby="work-heading">
          <div className="mb-10 grid gap-5 md:grid-cols-[1fr_.72fr] md:items-end">
            <div><p className="mb-3 font-mono text-[10px] uppercase tracking-[.16em] text-[#168b94] dark:text-[#7edbd0]">A workspace built around the team</p><h2 id="work-heading" className="max-w-[650px] text-3xl font-semibold leading-[1.02] tracking-[-.065em] text-[#153642] dark:text-[#e3efeb] sm:text-5xl">Different workstreams, connected by shared context.</h2></div>
            <p className="max-w-[400px] text-sm leading-6 text-[#43616a] dark:text-[#aac1be]">From organizing tryouts to reviewing a model, the workspace brings practical team tools into a shared home.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sections.map(({ index, label, title, body, icon: Icon, accent }) => (
              <article key={index} className="group grid gap-5 rounded-2xl border border-[#d9e6e1] bg-white/75 p-5 transition duration-200 hover:-translate-y-1 hover:border-[#a9c9c1] hover:shadow-[0_15px_30px_rgba(39,79,76,.08)] dark:border-[#28464d] dark:bg-[#122a32] dark:hover:border-[#477a7a] sm:grid-cols-[auto_1fr] sm:p-7" data-testid={`about-area-${index}`}>
                <span className={`grid size-11 place-items-center rounded-xl ${accentStyles[accent as keyof typeof accentStyles]}`}><Icon size={19} /></span>
                <div><div className="flex items-center justify-between gap-3"><p className="font-mono text-[9px] tracking-[.13em] text-[#168b94] dark:text-[#7edbd0]">{label}</p><span className="font-mono text-[10px] text-[#91a2a2] dark:text-[#91aaa8]">{index}</span></div><h3 className="mt-3 text-xl font-semibold tracking-[-.04em] text-[#153642] dark:text-[#e3efeb]">{title}</h3><p className="mt-2 max-w-[530px] text-sm leading-6 text-[#607981] dark:text-[#aac1be]">{body}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-14 overflow-hidden rounded-2xl bg-[#153642] px-6 py-8 text-[#eef8f3] dark:border dark:border-[#335963] sm:mb-16 sm:px-10 sm:py-10" data-testid="about-next-step">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div><p className="mb-3 font-mono text-[9px] uppercase tracking-[.16em] text-[#9dc7bf]">ROBOTICS TEAM WORKSPACE</p><h2 className="max-w-[650px] text-3xl font-medium leading-[1.02] tracking-[-.06em] sm:text-4xl">Bring the team’s work together.</h2><p className="mt-3 max-w-[530px] text-sm leading-6 text-[#b5d0cb]">Plan together, review designs, organize team knowledge, and keep projects moving.</p></div>
            <Link href="/auth" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-[#efc34f] px-5 text-xs font-bold text-[#153642] transition hover:bg-[#f4d477] md:self-center" data-testid="link-about-sign-in">Team sign in <ArrowRight size={15} /></Link>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-[#d9e6e1] py-6 font-mono text-[9px] uppercase tracking-[.08em] text-[#70868b] dark:border-[#28464d] dark:text-[#91aaa8] sm:flex-row sm:items-center sm:justify-between">
          <span>Robotics team workspace</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><Link href="/" className="hover:text-[#168b94] dark:hover:text-[#7edbd0]">Home</Link><Link href="/privacy" className="hover:text-[#168b94] dark:hover:text-[#7edbd0]">Privacy</Link><Link href="/terms" className="hover:text-[#168b94] dark:hover:text-[#7edbd0]">Terms</Link><Link href="/auth" className="inline-flex items-center gap-1.5 hover:text-[#168b94] dark:hover:text-[#7edbd0]">Team sign in <ArrowRight size={12} /></Link></div>
        </footer>
      </div>
    </main>
  );
}
