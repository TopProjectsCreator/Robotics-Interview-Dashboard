import { useState } from "react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowRight,
  Cpu,
  Boxes,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Monitor,
  Radio,
  Rows3,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

const workspaceModules = [
  {
    label: "COLLABORATE",
    title: "Chat & shared boards",
    detail: "Ideas stay with the team",
    icon: MessageSquare,
    color: "text-[#7edbd0]",
  },
  {
    label: "ENGINEERING",
    title: "CAD & 3D previews",
    detail: "Design files in context",
    icon: Cpu,
    color: "text-[#f1cc67]",
  },
  {
    label: "ORGANIZE",
    title: "Sheets & dashboards",
    detail: "Shared plans and insights",
    icon: LayoutDashboard,
    color: "text-[#a5dfb8]",
  },
  {
    label: "ASSIST",
    title: "AI tools",
    detail: "Support for team decisions",
    icon: Sparkles,
    color: "text-[#c8b7ff]",
  },
];

const productAreas = [
  {
    number: "01",
    eyebrow: "COLLABORATE",
    title: "Keep the team connected.",
    description:
      "Use team chat and live shared boards to keep conversations, working notes, and decisions together.",
    icon: UsersRound,
    iconStyle: "bg-[#dff1ec] text-[#167d78] dark:bg-[#17443f] dark:text-[#7edbd0]",
  },
  {
    number: "02",
    eyebrow: "ENGINEERING",
    title: "Review the work in 3D.",
    description:
      "Preview CAD models and engineering files alongside the conversations where the team discusses them.",
    icon: Cpu,
    iconStyle: "bg-[#fff0c6] text-[#946b0c] dark:bg-[#4b3c1c] dark:text-[#f1cc67]",
  },
  {
    number: "03",
    eyebrow: "PLANNING & INSIGHT",
    title: "Make shared information useful.",
    description:
      "Work with shared spreadsheets, build custom charts, and keep important team information easy to find.",
    icon: Rows3,
    iconStyle: "bg-[#e7e7fb] text-[#6351a1] dark:bg-[#322d51] dark:text-[#c8b7ff]",
  },
  {
    number: "04",
    eyebrow: "TEAM OPERATIONS",
    title: "Bring coordination into one place.",
    description:
      "Support the team's day-to-day work with attendance tools, clear public displays, and built-in assistance.",
    icon: Monitor,
    iconStyle: "bg-[#dceef5] text-[#28738a] dark:bg-[#183c49] dark:text-[#8bd2e0]",
  },
];

export default function PublicDashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main
      className="relative isolate min-h-[100dvh] overflow-x-clip bg-[#f5f8f4] text-[#16303b] dark:bg-[#0c1d24] dark:text-[#e3efeb]"
      data-testid="public-dashboard"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] bg-[radial-gradient(ellipse_at_75%_5%,rgba(100,174,142,.22),transparent_32%),linear-gradient(180deg,#e8f2ee_0%,#f5f8f4_86%)] dark:bg-[radial-gradient(ellipse_at_75%_5%,rgba(45,117,103,.2),transparent_32%),linear-gradient(180deg,#102f36_0%,#0c1d24_86%)]"
      />

      <div className="mx-auto w-[min(1360px,calc(100%-32px))] sm:w-[min(1360px,calc(100%-48px))]">
        <header className="relative z-20 flex min-h-[82px] items-center justify-between gap-6">
          <Link
            href="/"
            onClick={closeMenu}
            className="inline-flex shrink-0 text-inherit no-underline"
            data-testid="link-public-brand"
          >
            <BrandMark ariaLabel="Robotics team logo" dataTestId="public-team-logo" />
          </Link>

          <nav
            id="public-dashboard-nav"
            aria-label="Primary navigation"
            className={`${menuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-[70px] flex-col gap-1 rounded-xl border border-[#d9e6e1] bg-white p-2 shadow-lg dark:border-[#28464d] dark:bg-[#122a32] md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
            data-testid="public-dashboard-nav-links"
          >
            <a
              href="#platform"
              onClick={closeMenu}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#43616a] hover:text-[#168b94] dark:text-[#b6ceca] dark:hover:text-[#7edbd0]"
            >
              Platform
            </a>
            <a
              href="#capabilities"
              onClick={closeMenu}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#43616a] hover:text-[#168b94] dark:text-[#b6ceca] dark:hover:text-[#7edbd0]"
            >
              Capabilities
            </a>
            <Link
              href="/auth"
              onClick={closeMenu}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#153642] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477]"
              data-testid="link-public-sign-in"
            >
              Team sign in <ArrowRight size={14} />
            </Link>
          </nav>

          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#bed4ce] text-[#16303b] dark:border-[#3b646b] dark:text-[#e3efeb] md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="public-dashboard-nav"
            aria-expanded={menuOpen}
            data-testid="button-public-dashboard-menu"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </header>

        <section
          id="platform"
          className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:py-24"
          aria-labelledby="public-dashboard-title"
        >
          <div className="max-w-[640px]">
            <p className="mb-5 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.15em] text-[#168b94] dark:text-[#7edbd0]">
              <span className="size-2 rounded-full bg-[#64ae8e] shadow-[0_0_0_5px_rgba(100,174,142,.15)]" />
              A shared home for robotics teams
            </p>
            <h1
              id="public-dashboard-title"
              className="text-[clamp(2rem,8.5vw,3rem)] font-semibold leading-[.94] tracking-[-.075em] text-[#153642] sm:text-[clamp(46px,7vw,86px)] dark:text-[#e3efeb]"
            >
              One home for the whole{" "}
              <span className="text-[#168b94] dark:text-[#6bd1d0]">robotics team.</span>
            </h1>
            <p className="mt-6 max-w-[570px] text-[16px] leading-7 text-[#43616a] dark:text-[#aac1be] sm:text-lg">
              Plan together, review designs, organize team knowledge, and keep projects moving across shared tools built for the work behind the robot.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#capabilities"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#153642] px-5 text-xs font-bold text-white shadow-[0_9px_20px_rgba(21,54,66,.13)] transition hover:-translate-y-0.5 hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477]"
                data-testid="link-hero-capabilities"
              >
                Explore the platform <ArrowRight size={15} />
              </a>
              <Link
                href="/auth"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#bed4ce] bg-white/65 px-5 text-xs font-bold text-[#153642] transition hover:border-[#168b94] hover:text-[#168b94] dark:border-[#3b646b] dark:bg-[#122a32]/70 dark:text-[#e3efeb] dark:hover:text-[#7edbd0]"
                data-testid="link-hero-sign-in"
              >
                Team sign in <ArrowRight size={15} />
              </Link>
            </div>
            <p
              className="mt-5 inline-flex rounded-full border border-[#bed4ce] bg-white/70 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-[#315d62] dark:border-[#3b646b] dark:bg-[#122a32]/70 dark:text-[#a7d7cd]"
              data-testid="public-dashboard-creator-credit"
            >
              Built by Team 23442 · Ishaan Bansal
            </p>
          </div>

          <div className="relative min-w-0">
            <div
              aria-hidden="true"
              className="absolute -left-8 -top-8 size-20 border-l border-t border-[#168b94]/25 dark:border-[#6bd1d0]/25"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-7 -right-7 size-24 border-b border-r border-[#efc34f]/45"
            />
            <div
              className="relative overflow-hidden rounded-2xl border border-[#2c5963] bg-[#153642] text-[#eaf5f0] shadow-[0_24px_60px_rgba(21,54,66,.2)]"
              aria-label="Robotics workspace preview"
              data-testid="card-workspace-preview"
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[.13] [background-image:linear-gradient(rgba(157,221,210,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(157,221,210,.4)_1px,transparent_1px)] [background-size:38px_38px] [mask-image:linear-gradient(120deg,black,transparent_70%)]"
              />
              <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
                <div>
                  <p className="font-mono text-[11px] sm:text-[9px] tracking-[.14em] text-[#8cb7b5]">ROBOTICS TEAM WORKSPACE</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-.04em] text-[#f1f8f4] sm:text-2xl">
                    Robotics workspace
                  </h2>
                </div>
              </div>
              <div className="relative grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 sm:gap-3 sm:p-6">
                {workspaceModules.map(({ label, title, detail, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="flex min-h-[90px] items-center gap-3 rounded-xl border border-white/10 bg-[#0c1d24]/35 p-3.5 sm:min-h-[106px] sm:p-4"
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/[.08] ${color}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] sm:text-[8px] tracking-[.12em] text-[#8cb7b5]">{label}</span>
                      <strong className="mt-1 block text-xs font-semibold text-[#f1f8f4] sm:text-sm">{title}</strong>
                      <small className="mt-1 block text-[10px] text-[#a8c6c3]">{detail}</small>
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3 font-mono text-[11px] sm:text-[9px] text-[#8cb7b5] sm:px-7">
                <span className="inline-flex items-center gap-2"><Radio size={12} /> SHARED TEAM TOOLS</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="grid grid-cols-2 border-y border-[#d9e6e1] dark:border-[#28464d] sm:grid-cols-4"
          aria-label="Platform areas"
          data-testid="section-platform-areas"
        >
          <div className="border-b border-[#d9e6e1] py-4 pr-3 dark:border-[#28464d] sm:border-b-0 sm:pr-5">
            <span className="font-mono text-[11px] sm:text-[9px] uppercase tracking-[.12em] text-[#70868b] dark:text-[#91aaa8]">01 / Connect</span>
            <strong className="mt-2 block text-sm text-[#153642] dark:text-[#e3efeb]">Chat & boards</strong>
          </div>
          <div className="border-b border-l border-[#d9e6e1] py-4 pl-4 dark:border-[#28464d] sm:border-b-0 sm:px-5">
            <span className="font-mono text-[11px] sm:text-[9px] uppercase tracking-[.12em] text-[#70868b] dark:text-[#91aaa8]">02 / Design</span>
            <strong className="mt-2 block text-sm text-[#153642] dark:text-[#e3efeb]">CAD & 3D files</strong>
          </div>
          <div className="py-4 pr-3 dark:border-[#28464d] sm:border-l sm:px-5">
            <span className="font-mono text-[11px] sm:text-[9px] uppercase tracking-[.12em] text-[#70868b] dark:text-[#91aaa8]">03 / Organize</span>
            <strong className="mt-2 block text-sm text-[#153642] dark:text-[#e3efeb]">Sheets & insights</strong>
          </div>
          <div className="border-l border-[#d9e6e1] py-4 pl-4 dark:border-[#28464d] sm:pl-5">
            <span className="font-mono text-[11px] sm:text-[9px] uppercase tracking-[.12em] text-[#70868b] dark:text-[#91aaa8]">04 / Coordinate</span>
            <strong className="mt-2 block text-sm text-[#153642] dark:text-[#e3efeb]">Team operations</strong>
          </div>
        </section>

        <section
          id="capabilities"
          className="py-16 sm:py-24"
          aria-labelledby="capabilities-title"
          data-testid="section-capabilities"
        >
          <div className="mb-8 flex flex-col justify-between gap-5 md:mb-9 md:flex-row md:items-end">
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[.16em] text-[#168b94] dark:text-[#7edbd0]">The platform</p>
              <h2
                id="capabilities-title"
                className="max-w-[640px] text-3xl font-semibold leading-[1.02] tracking-[-.065em] text-[#153642] dark:text-[#e3efeb] sm:text-5xl"
              >
                Tools for the work behind the robot.
              </h2>
            </div>
            <p className="max-w-[380px] text-sm leading-6 text-[#43616a] dark:text-[#aac1be]">
              Give the team one place to communicate, explore designs, manage shared information, and coordinate what comes next.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="grid-product-areas">
            {productAreas.map(({ number, eyebrow, title, description, icon: Icon, iconStyle }) => (
              <article
                key={number}
                className="flex min-h-[250px] flex-col rounded-2xl border border-[#d9e6e1] bg-white/80 p-5 shadow-[0_10px_25px_rgba(39,79,76,.045)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(39,79,76,.08)] dark:border-[#28464d] dark:bg-[#122a32] dark:shadow-black/10 sm:p-6"
                data-testid={`card-product-area-${number}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`grid size-10 place-items-center rounded-xl ${iconStyle}`}><Icon size={18} /></span>
                  <span className="font-mono text-[11px] sm:text-[9px] tracking-[.12em] text-[#70868b] dark:text-[#91aaa8]">{number}</span>
                </div>
                <p className="mb-2 mt-6 font-mono text-[11px] sm:text-[9px] tracking-[.13em] text-[#168b94] dark:text-[#7edbd0]">{eyebrow}</p>
                <h3 className="text-lg font-semibold tracking-[-.035em] text-[#153642] dark:text-[#e3efeb]">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#607981] dark:text-[#aac1be]">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="grid-product-entry-cards">
            <article
              className="flex flex-col gap-4 rounded-2xl border border-[#d9e6e1] bg-[#edf4f1] p-5 dark:border-[#28464d] dark:bg-[#122a32] sm:flex-row sm:items-center sm:justify-between sm:px-6"
              data-testid="card-interview-entry"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#153642] text-[#efc34f] dark:bg-[#203f49]">
                  <ClipboardListIcon />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#153642] dark:text-[#e3efeb]">Interview</h3>
                  <p className="mt-1 text-xs leading-5 text-[#607981] dark:text-[#aac1be]">
                    A dedicated workflow for applicant review and tryout coordination.
                  </p>
                </div>
              </div>
              <Link
                href="/interview-landing"
                className="inline-flex shrink-0 items-center gap-2 self-start text-xs font-bold text-[#167f88] hover:text-[#105c64] dark:text-[#7edbd0] dark:hover:text-[#b1f0e7] sm:self-center"
                data-testid="link-interview-entry"
              >
                View workspace <ArrowRight size={14} />
              </Link>
            </article>

            <article
              className="flex flex-col gap-4 rounded-2xl border border-[#d9e6e1] bg-[#edf4f1] p-5 dark:border-[#28464d] dark:bg-[#122a32] sm:flex-row sm:items-center sm:justify-between sm:px-6"
              data-testid="card-chat-entry"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#153642] text-[#7edbd0] dark:bg-[#203f49]">
                  <MessageSquare size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#153642] dark:text-[#e3efeb]">Chat & collaboration</h3>
                  <p className="mt-1 text-xs leading-5 text-[#607981] dark:text-[#aac1be]">
                    Team conversations, shared context, and connected work tools.
                  </p>
                </div>
              </div>
              <Link
                href="/chat-landing"
                className="inline-flex shrink-0 items-center gap-2 self-start text-xs font-bold text-[#167f88] hover:text-[#105c64] dark:text-[#7edbd0] dark:hover:text-[#b1f0e7] sm:self-center"
                data-testid="link-chat-entry"
              >
                Explore chat <ArrowRight size={14} />
              </Link>
            </article>

            <article
              className="flex flex-col gap-4 rounded-2xl border border-[#d9e6e1] bg-[#edf4f1] p-5 dark:border-[#28464d] dark:bg-[#122a32] sm:flex-row sm:items-center sm:justify-between sm:px-6"
              data-testid="card-parts-entry"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#153642] text-[#a5dfb8] dark:bg-[#203f49]">
                  <Boxes size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#153642] dark:text-[#e3efeb]">Parts & inventory</h3>
                  <p className="mt-1 text-xs leading-5 text-[#607981] dark:text-[#aac1be]">
                    Discover supplier listings, track team stock, and reserve parts for robot builds.
                  </p>
                </div>
              </div>
              <Link
                href="/parts-landing"
                className="inline-flex shrink-0 items-center gap-2 self-start text-xs font-bold text-[#167f88] hover:text-[#105c64] dark:text-[#7edbd0] dark:hover:text-[#b1f0e7] sm:self-center"
                data-testid="link-parts-entry"
              >
                Explore parts <ArrowRight size={14} />
              </Link>
            </article>

            <article
              className="flex flex-col gap-4 rounded-2xl border border-[#d9e6e1] bg-[#edf4f1] p-5 dark:border-[#28464d] dark:bg-[#122a32] sm:flex-row sm:items-center sm:justify-between sm:px-6"
              data-testid="card-code-entry"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#153642] text-[#c8b7ff] dark:bg-[#203f49]">
                  <MessageSquare size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#153642] dark:text-[#e3efeb]">Code workspace</h3>
                  <p className="mt-1 text-xs leading-5 text-[#607981] dark:text-[#aac1be]">
                    Collaborative FTC Java editing, checkpoints, and hub deploys.
                  </p>
                </div>
              </div>
              <Link
                href="/code-landing"
                className="inline-flex shrink-0 items-center gap-2 self-start text-xs font-bold text-[#167f88] hover:text-[#105c64] dark:text-[#7edbd0] dark:hover:text-[#b1f0e7] sm:self-center"
                data-testid="link-code-entry"
              >
                Explore code <ArrowRight size={14} />
              </Link>
            </article>

            <article
              className="flex flex-col gap-4 rounded-2xl border border-[#d9e6e1] bg-[#edf4f1] p-5 dark:border-[#28464d] dark:bg-[#122a32] sm:flex-row sm:items-center sm:justify-between sm:px-6"
              data-testid="card-cad-entry"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#153642] text-[#f1cc67] dark:bg-[#203f49]">
                  <Cpu size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#153642] dark:text-[#e3efeb]">CAD workspace</h3>
                  <p className="mt-1 text-xs leading-5 text-[#607981] dark:text-[#aac1be]">
                    Bots, folders, model uploads, and 3D previews for FTC design.
                  </p>
                </div>
              </div>
              <Link
                href="/cad-landing"
                className="inline-flex shrink-0 items-center gap-2 self-start text-xs font-bold text-[#167f88] hover:text-[#105c64] dark:text-[#7edbd0] dark:hover:text-[#b1f0e7] sm:self-center"
                data-testid="link-cad-entry"
              >
                Explore CAD <ArrowRight size={14} />
              </Link>
            </article>
          </div>
        </section>

        <section className="mb-12 overflow-hidden rounded-2xl bg-[#153642] px-6 py-8 text-[#eef8f3] dark:border dark:border-[#335963] sm:mb-16 sm:px-10 sm:py-10" data-testid="section-team-access">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-3 font-mono text-[11px] sm:text-[9px] uppercase tracking-[.16em] text-[#9dc7bf]">Robotics team workspace</p>
              <h2 className="max-w-[650px] text-3xl font-medium leading-[1.02] tracking-[-.06em] sm:text-4xl">
                Bring the team’s work together.
              </h2>
            </div>
            <Link
              href="/auth"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#efc34f] px-5 text-xs font-bold text-[#153642] transition hover:bg-[#f4d477]"
              data-testid="link-team-access"
            >
              Team sign in <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-[#d9e6e1] py-6 font-mono text-[11px] sm:text-[9px] uppercase tracking-[.08em] text-[#70868b] dark:border-[#28464d] dark:text-[#91aaa8] sm:flex-row sm:items-center sm:justify-between">
          <span>Robotics team workspace</span>
        </footer>
      </div>
    </main>
  );
}

function ClipboardListIcon() {
  return <Radio size={17} />;
}
