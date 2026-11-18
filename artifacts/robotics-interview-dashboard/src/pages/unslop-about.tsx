import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  ExternalLink,
  LayoutDashboard,
  MessageSquare,
  Menu,
  UsersRound,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const sections = [
  {
    index: "01",
    label: "Team coordination",
    title: "Keep project work moving",
    body: "Shared planning, attendance tools, and clear team updates help keep day-to-day robotics work organized.",
    icon: UsersRound,
  },
  {
    index: "02",
    label: "Collaboration",
    title: "Keep the conversation with the work",
    body: "Team chat and live shared boards keep conversations, working notes, and decisions together instead of scattered across tools.",
    icon: MessageSquare,
  },
  {
    index: "03",
    label: "Engineering",
    title: "Review designs in context",
    body: "CAD models and engineering files can be previewed alongside the conversations where the team discusses them.",
    icon: Cpu,
  },
  {
    index: "04",
    label: "Shared knowledge",
    title: "Make team information useful",
    body: "Shared spreadsheets, custom charts, and connected workspace tools help keep important information easy to find.",
    icon: LayoutDashboard,
  },
];

const focusAreas = [
  { number: "01", label: "Team planning & updates" },
  { number: "02", label: "Chat & shared boards" },
  { number: "03", label: "CAD & 3D files" },
  { number: "04", label: "Sheets & insights" },
];

const teamPhotos = [
  {
    src: `${import.meta.env.BASE_URL}team-23442-1.webp`,
    alt: "A Wolverine team member working on a laptop",
  },
  {
    src: `${import.meta.env.BASE_URL}team-23442-2.webp`,
    alt: "Team 23442 standing together in their Wolverines shirts",
  },
  {
    src: `${import.meta.env.BASE_URL}team-23442-3.webp`,
    alt: "Wolverines team members assembling a robot",
  },
];

const previewRows = [
  { icon: UsersRound, label: "Team planning", detail: "Build season 2026" },
  { icon: MessageSquare, label: "Chat", detail: "Drivetrain thread" },
  { icon: Cpu, label: "CAD library", detail: "Intake v2.step" },
];

function DimensionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-2 w-px bg-[#5f747b] dark:bg-[#91aaa8]" />
      <span className="h-px flex-1 bg-[#dbe5e1] dark:bg-[#28464d]" />
      <span className="font-mono text-[11px] text-[#5f747b] dark:text-[#91aaa8]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[#dbe5e1] dark:bg-[#28464d]" />
      <span className="h-2 w-px bg-[#5f747b] dark:bg-[#91aaa8]" />
    </div>
  );
}

function CadPreview() {
  return (
    <div className="rounded-2xl border border-[#dbe5e1] bg-white p-4 shadow-[0_1px_2px_rgba(21,54,66,0.05)] dark:border-[#28464d] dark:bg-[#122a32]">
      <div className="flex items-center justify-between border-b border-[#dbe5e1] pb-3 dark:border-[#28464d]">
        <p className="font-mono text-[11px] text-[#5f747b] dark:text-[#91aaa8]">
          Workspace — build 2026
        </p>
        <span className="font-mono text-[11px] text-[#5f747b] dark:text-[#91aaa8]">23442</span>
      </div>
      <div className="grid gap-4 pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-3">
          {previewRows.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eef3f0] text-[#5f747b] dark:bg-[#173b45] dark:text-[#91aaa8]">
                <Icon size={16} strokeWidth={1.5} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-[#153642] dark:text-[#e3efeb]">
                  {label}
                </span>
                <span className="block truncate font-mono text-[11px] text-[#5f747b] dark:text-[#91aaa8]">
                  {detail}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-xl bg-[#0c1d24] p-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(126,219,208,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(126,219,208,0.5) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <svg
            viewBox="0 0 260 180"
            className="relative w-full"
            role="img"
            aria-label="Wireframe top view of the team's drivetrain"
          >
            <g fill="none" stroke="#7edbd0" strokeWidth="1.5">
              <rect x="70" y="35" width="120" height="110" rx="10" />
              <circle cx="70" cy="55" r="16" />
              <circle cx="70" cy="125" r="16" />
              <circle cx="190" cy="55" r="16" />
              <circle cx="190" cy="125" r="16" />
              <circle cx="130" cy="90" r="22" />
              <circle cx="130" cy="90" r="8" />
              <rect x="95" y="18" width="70" height="15" rx="4" />
              <line x1="86" y1="55" x2="86" y2="125" strokeDasharray="3 4" />
              <line x1="70" y1="160" x2="190" y2="160" />
              <line x1="70" y1="155" x2="70" y2="165" />
              <line x1="190" y1="155" x2="190" y2="165" />
            </g>
          </svg>
          <p className="relative mt-2 font-mono text-[11px] text-[#7edbd0]">
            Drivetrain v3 — top view
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UnslopAboutPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const closeMenu = () => setMenuOpen(false);

  const showPhoto = (offset: number) => {
    setActivePhoto((current) => (current + offset + teamPhotos.length) % teamPhotos.length);
  };

  return (
    <main
      className="relative min-h-[100dvh] bg-[#f4f7f5] text-[#153642] dark:bg-[#0c1d24] dark:text-[#e3efeb]"
      data-testid="public-unslop-about"
    >
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] sm:w-[min(1180px,calc(100%-48px))]">
        <header className="relative z-20 flex min-h-[72px] items-center justify-between gap-6">
          <Link
            href="/"
            onClick={closeMenu}
            className="inline-flex shrink-0 text-inherit no-underline"
            data-testid="link-unslop-about-brand"
          >
            <BrandMark ariaLabel="Robotics team logo" dataTestId="unslop-about-team-logo" />
          </Link>
          <nav
            aria-label="Primary navigation"
            className={`${
              menuOpen ? "flex" : "hidden"
            } absolute left-0 right-0 top-[68px] flex-col gap-1 rounded-xl border border-[#dbe5e1] bg-white p-2 shadow-[0_8px_24px_rgba(21,54,66,0.06)] dark:border-[#28464d] dark:bg-[#122a32] md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
            data-testid="unslop-about-navigation"
          >
            <Link
              href="/"
              onClick={closeMenu}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#4a616a] transition-colors hover:text-[#153642] dark:text-[#aac1be] dark:hover:text-[#e3efeb]"
            >
              Home
            </Link>
            <a
              href="#what-we-bring-together"
              onClick={closeMenu}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#4a616a] transition-colors hover:text-[#153642] dark:text-[#aac1be] dark:hover:text-[#e3efeb]"
            >
              What it brings together
            </a>
            <Link
              href="/privacy"
              onClick={closeMenu}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#4a616a] transition-colors hover:text-[#153642] dark:text-[#aac1be] dark:hover:text-[#e3efeb]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              onClick={closeMenu}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#4a616a] transition-colors hover:text-[#153642] dark:text-[#aac1be] dark:hover:text-[#e3efeb]"
            >
              Terms
            </Link>
            <Link
              href="/auth"
              onClick={closeMenu}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#153642] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477]"
            >
              Team sign in <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </nav>
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#dbe5e1] text-[#153642] transition-colors hover:bg-[#eef3f0] dark:border-[#28464d] dark:text-[#e3efeb] dark:hover:bg-[#173b45] md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            data-testid="button-unslop-about-menu"
          >
            {menuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </header>

        <section
          className="border-b border-[#dbe5e1] py-16 dark:border-[#28464d] lg:py-24"
          aria-labelledby="unslop-about-title"
        >
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:gap-16">
            <div>
              <p className="flex items-center gap-3 text-sm font-medium text-[#4a616a] dark:text-[#aac1be]">
                <span className="h-px w-8 bg-[#0d6e77] dark:bg-[#7edbd0]" />
                About the workspace
              </p>
              <h1
                id="unslop-about-title"
                className="mt-6 text-[clamp(2.5rem,6vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.02em] text-[#153642] dark:text-[#e3efeb]"
              >
                The work behind a robot is part of the build
              </h1>
              <p className="mt-6 max-w-[560px] text-base leading-7 text-[#4a616a] dark:text-[#aac1be] sm:text-lg sm:leading-8">
                Engineering, team coordination, and shared records all shape how a robotics team works.
                This workspace brings those everyday tools together.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/auth"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#153642] px-5 text-sm font-medium text-white transition-colors hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477]"
                >
                  Team sign in <ArrowRight size={16} strokeWidth={1.5} />
                </Link>
                <a
                  href="#what-we-bring-together"
                  className="inline-flex min-h-11 items-center rounded-lg border border-[#dbe5e1] px-5 text-sm font-medium text-[#153642] transition-colors hover:bg-[#eef3f0] dark:border-[#28464d] dark:text-[#e3efeb] dark:hover:bg-[#173b45]"
                >
                  See what it brings together
                </a>
              </div>
              <div className="mt-10 max-w-[560px]">
                <DimensionRule label="23442" />
              </div>
            </div>
            <CadPreview />
          </div>
        </section>

        <section
          className="grid grid-cols-2 border-b border-[#dbe5e1] dark:border-[#28464d] sm:grid-cols-4"
          aria-label="Workspace focus areas"
        >
          {focusAreas.map(({ number, label }, index) => (
            <a
              key={number}
              href={`#unslop-area-${number}`}
              className={`py-5 transition-colors hover:bg-[#eef3f0] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0d6e77] dark:hover:bg-[#173b45] dark:focus-visible:outline-[#7edbd0] ${
                index % 2 === 1
                  ? "border-l border-[#dbe5e1] pl-4 dark:border-[#28464d] sm:px-5"
                  : "pr-3"
              } ${
                index < 2
                  ? "border-b border-[#dbe5e1] dark:border-[#28464d] sm:border-b-0"
                  : ""
              } ${index > 0 ? "sm:border-l sm:border-[#dbe5e1] sm:px-5 dark:sm:border-[#28464d]" : ""}`}
            >
              <span className="font-mono text-[11px] text-[#5f747b] dark:text-[#91aaa8]">
                {number}
              </span>
              <span className="mt-2 block text-sm font-medium text-[#153642] dark:text-[#e3efeb]">
                {label}
              </span>
            </a>
          ))}
        </section>

        <section
          id="what-we-bring-together"
          className="scroll-mt-8 py-16 lg:py-24"
          aria-labelledby="unslop-work-heading"
        >
          <div className="grid gap-6 md:grid-cols-[1fr_0.72fr] md:items-end">
            <div>
              <p className="text-sm font-medium text-[#4a616a] dark:text-[#aac1be]">
                A workspace built around the team
              </p>
              <h2
                id="unslop-work-heading"
                className="mt-3 max-w-[650px] text-3xl font-medium leading-[1.05] tracking-[-0.02em] text-[#153642] dark:text-[#e3efeb] sm:text-5xl"
              >
                Different workstreams, connected by shared context
              </h2>
            </div>
            <p className="max-w-[400px] text-sm leading-6 text-[#4a616a] dark:text-[#aac1be]">
              From planning project work to reviewing a model, the workspace brings practical team
              tools into a shared home.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {sections.map(({ index, label, title, body, icon: Icon }) => (
              <article
                id={`unslop-area-${index}`}
                key={index}
                className="scroll-mt-8 border-t border-[#dbe5e1] pt-5 dark:border-[#28464d]"
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon size={16} strokeWidth={1.5} className="text-[#5f747b] dark:text-[#91aaa8]" />
                  <span className="font-mono text-[11px] text-[#5f747b] dark:text-[#91aaa8]">
                    {index}
                  </span>
                </div>
                <p className="mt-4 text-xs font-medium text-[#4a616a] dark:text-[#aac1be]">
                  {label}
                </p>
                <h3 className="mt-2 text-lg font-medium leading-snug tracking-[-0.01em] text-[#153642] dark:text-[#e3efeb]">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#4a616a] dark:text-[#aac1be]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="mb-14 grid gap-10 rounded-2xl border border-[#dbe5e1] bg-white p-6 dark:border-[#28464d] dark:bg-[#122a32] sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] md:items-center lg:gap-12 lg:p-10"
          aria-labelledby="unslop-made-by-heading"
          data-testid="unslop-about-team-23442"
        >
          <div>
            <div className="flex items-center gap-4">
              <img
                src={`${import.meta.env.BASE_URL}team-23442-logo.webp`}
                alt="Wolverines Robotics team 23442 logo"
                className="size-16 shrink-0 rounded-xl bg-black object-contain p-1"
                data-testid="unslop-about-team-23442-logo"
              />
              <p className="text-sm font-medium text-[#4a616a] dark:text-[#aac1be]">
                The team behind the workspace
              </p>
            </div>
            <h2
              id="unslop-made-by-heading"
              className="mt-6 text-2xl font-medium leading-tight tracking-[-0.02em] text-[#153642] dark:text-[#e3efeb] sm:text-3xl lg:text-4xl"
            >
              Made by Team 23442 for robotics teams like yours
            </h2>
            <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#4a616a] dark:text-[#aac1be] sm:text-base sm:leading-7">
              Team 23442—the Wolverines—built this workspace to bring robotics engineering,
              collaboration, and shared knowledge into one place for teams like yours.
            </p>
            <a
              href="https://pinelakeroboticsteam.lovable.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[#153642] px-4 text-sm font-medium text-white transition-colors hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477]"
              data-testid="unslop-link-team-site"
            >
              Visit the team site <ExternalLink size={16} strokeWidth={1.5} />
            </a>
          </div>
          <div className="min-w-0" role="region" aria-label="Team 23442 photo carousel" aria-roledescription="carousel">
            <div className="overflow-hidden rounded-xl bg-[#0b1515]">
              <img
                key={teamPhotos[activePhoto].src}
                src={teamPhotos[activePhoto].src}
                alt={teamPhotos[activePhoto].alt}
                className="aspect-[4/3] w-full object-cover"
                data-testid="unslop-about-team-23442-image"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => showPhoto(-1)}
                aria-label="Previous team photo"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#dbe5e1] text-[#4a616a] transition-colors hover:bg-[#eef3f0] dark:border-[#28464d] dark:text-[#aac1be] dark:hover:bg-[#173b45]"
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
              </button>
              <div className="flex items-center gap-2" aria-label={`Photo ${activePhoto + 1} of ${teamPhotos.length}`}>
                {teamPhotos.map((photo, index) => (
                  <button
                    key={photo.src}
                    type="button"
                    onClick={() => setActivePhoto(index)}
                    aria-label={`Show team photo ${index + 1}`}
                    aria-current={activePhoto === index ? "true" : undefined}
                    className={`h-2 rounded-full transition-[width,background-color] duration-150 ${
                      activePhoto === index
                        ? "w-6 bg-[#0d6e77] dark:bg-[#7edbd0]"
                        : "w-2 bg-[#c3d2ce] dark:bg-[#45676d]"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => showPhoto(1)}
                aria-label="Next team photo"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#dbe5e1] text-[#4a616a] transition-colors hover:bg-[#eef3f0] dark:border-[#28464d] dark:text-[#aac1be] dark:hover:bg-[#173b45]"
              >
                <ArrowRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </section>

        <section
          className="mb-14 overflow-hidden rounded-2xl bg-[#153642] px-6 py-10 text-[#eef8f3] sm:mb-16 sm:px-10"
          data-testid="unslop-about-next-step"
        >
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#9dc7bf]">Robotics team workspace</p>
              <h2 className="mt-3 max-w-[650px] text-3xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-4xl">
                Bring the team’s work together
              </h2>
              <p className="mt-3 max-w-[530px] text-sm leading-6 text-[#b5d0cb]">
                Plan together, review designs, organize team knowledge, and keep projects moving.
              </p>
            </div>
            <Link
              href="/auth"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-[#efc34f] px-5 text-sm font-medium text-[#153642] transition-colors hover:bg-[#f4d477] md:self-center"
              data-testid="unslop-link-about-sign-in"
            >
              Team sign in <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-[#dbe5e1] py-6 text-[13px] text-[#5f747b] dark:border-[#28464d] dark:text-[#91aaa8] sm:flex-row sm:items-center sm:justify-between">
          <span>Robotics team workspace</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/" className="transition-colors hover:text-[#0d6e77] dark:hover:text-[#7edbd0]">
              Home
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-[#0d6e77] dark:hover:text-[#7edbd0]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-[#0d6e77] dark:hover:text-[#7edbd0]"
            >
              Terms
            </Link>
            <Link
              href="/agents"
              className="transition-colors hover:text-[#0d6e77] dark:hover:text-[#7edbd0]"
            >
              AGENTS.md
            </Link>
            <Link
              href="/about"
              className="transition-colors hover:text-[#0d6e77] dark:hover:text-[#7edbd0]"
            >
              Original about
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[#0d6e77] dark:hover:text-[#7edbd0]"
            >
              Team sign in <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
