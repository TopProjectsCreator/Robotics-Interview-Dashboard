import { useEffect, useState } from "react";
import { Link } from "wouter";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { ArrowRight, ChevronRight, CircleCheck, Copy, Download, Rocket } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

type BriefingSection = { id: string; title: string };
type RenderedBriefing = { html: string; sections: BriefingSection[] };

function slugifyHeading(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
}

function renderBriefing(markdown: string): RenderedBriefing {
  const parsed = marked.parse(markdown, { gfm: true, async: false });
  const safeHtml = DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } });
  const template = document.createElement("template");
  template.innerHTML = safeHtml;

  const sections: BriefingSection[] = [];
  const usedIds = new Map<string, number>();
  for (const heading of template.content.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const baseId = slugifyHeading(heading.textContent ?? "");
    const occurrence = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, occurrence + 1);
    const id = occurrence === 0 ? baseId : `${baseId}-${occurrence + 1}`;
    heading.id = id;

    if (heading.tagName === "H2") {
      sections.push({ id, title: heading.textContent?.trim() ?? "" });
    }
  }

  return { html: template.innerHTML, sections };
}

export default function AgentsMdPage() {
  const [copied, setCopied] = useState(false);
  const [briefing, setBriefing] = useState<RenderedBriefing | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = "AGENTS.md — Robotics Dashboard, the complete briefing";
    const controller = new AbortController();

    void fetch("/AGENTS.md", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the canonical briefing.");
        return response.text();
      })
      .then((markdown) => {
        setBriefing(renderBriefing(markdown));
        setLoadError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });

    return () => {
      controller.abort();
      document.title = previous;
    };
  }, []);

  const copy = async () => {
    try {
      const response = await fetch("/AGENTS.md");
      if (!response.ok) throw new Error("Unable to load the canonical briefing.");
      await navigator.clipboard.writeText(await response.text());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // The raw file link remains available if clipboard access is unavailable.
    }
  };

  const firstSection = briefing?.sections[0]?.id;

  return (
    <main className="agents-md min-h-[100dvh] overflow-x-clip font-[Space_Grotesk,sans-serif]" data-testid="page-agents-md">
      <header className="sticky top-0 z-40 border-b border-[var(--agents-line)] bg-[var(--agents-header)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" data-testid="link-agents-md-brand">
            <BrandMark ariaLabel="Robotics Dashboard home" />
            <span className="min-w-0 leading-none">
              <span className="block text-[13px] font-bold tracking-[.2em] text-[var(--agents-strong)]">ROBOTICS</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.24em] text-[var(--agents-mint)]">Robotics Dashboard</span>
            </span>
            <span className="hidden rounded-md border border-[var(--agents-amber)]/40 bg-[var(--agents-amber)]/10 px-2 py-1 font-mono text-[10px] font-semibold tracking-[.18em] text-[var(--agents-amber)] sm:inline-block">AGENTS.md</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--agents-line)] bg-[var(--agents-panel)] px-3 text-[11px] font-semibold text-[var(--agents-text)] transition hover:border-[var(--agents-mint)] hover:text-[var(--agents-mint)]" data-testid="button-copy-agents-md">
              {copied ? <CircleCheck size={14} className="text-[var(--agents-mint)]" /> : <Copy size={14} />}
              <span className="hidden xs:inline">{copied ? "Copied" : "Copy AGENTS.md"}</span>
            </button>
            <a href="/AGENTS.md" download="AGENTS.md" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--agents-line)] bg-[var(--agents-panel)] px-3 text-[11px] font-semibold text-[var(--agents-text)] transition hover:border-[var(--agents-mint)] hover:text-[var(--agents-mint)]" data-testid="link-download-agents-md">
              <Download size={14} />
              <span className="hidden xs:inline">Download .md</span>
            </a>
            <Link href="/auth" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--agents-amber)] px-3 text-[11px] font-bold text-[var(--agents-button-ink)] transition hover:bg-[var(--agents-amber-hover)]" data-testid="link-agents-md-open-app">
              Open the app <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      <div className="relative border-b border-[var(--agents-line)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.16] [background-image:linear-gradient(rgba(126,219,208,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(126,219,208,.35)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_30%_0%,black,transparent_75%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.28em] text-[var(--agents-mint)]">
            <span className="inline-block size-2 animate-pulse rounded-full bg-[var(--agents-mint)]" /> The canonical briefing · raw Markdown at /AGENTS.md
          </p>
          <h1 className="mt-5 max-w-5xl text-[clamp(2.6rem,7.5vw,5.2rem)] font-semibold leading-[.95] tracking-[-.07em] text-[var(--agents-hero-title)]">
            The entire app,<br />
            <span className="text-[var(--agents-amber)]">explained once.</span><br />
            For every agent, forever.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-7 text-[var(--agents-soft)] sm:text-lg sm:leading-8">
            This is <span className="font-mono text-[var(--agents-amber)]">/agents</span>, the human-friendly view of the canonical briefing at{" "}
            <a className="font-mono text-[var(--agents-mint)] underline decoration-dotted underline-offset-4 hover:text-[var(--agents-strong)]" href="/AGENTS.md">/AGENTS.md</a>.
            Its content and section links are generated from that raw Markdown.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={firstSection ? `#${firstSection}` : "#agents-briefing"} className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--agents-light-button)] px-5 text-sm font-bold text-[var(--agents-light-button-ink)] transition hover:bg-[var(--agents-light-button-hover)]" data-testid="link-agents-md-start">
              Start reading <ChevronRight size={16} />
            </a>
            <a href="/AGENTS.md" className="inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--agents-amber)]/40 bg-[var(--agents-amber)]/10 px-5 text-sm font-semibold text-[var(--agents-amber)] transition hover:bg-[var(--agents-amber)]/20" data-testid="link-agents-md-raw">
              Get the raw file <ArrowRight size={15} />
            </a>
          </div>
        </div>
        <div className="relative border-t border-[var(--agents-line)] py-3">
          <p className="mx-auto max-w-7xl px-4 font-mono text-[10px] uppercase tracking-[.2em] text-[var(--agents-subtle)] sm:px-6">
            One source · public/AGENTS.md · rendered safely for readers
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="AGENTS.md table of contents" data-testid="agents-md-toc">
          <p className="font-mono text-[10px] uppercase tracking-[.24em] text-[var(--agents-mint)]">Table of contents</p>
          {briefing ? (
            <nav className="agents-md-scrollbar mt-3 flex gap-2 overflow-x-auto pb-2 lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0" data-testid="agents-md-toc-nav">
              {briefing.sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="shrink-0 rounded-lg border border-transparent px-3 py-2 text-[12px] leading-snug text-[var(--agents-chip-text)] transition hover:border-[var(--agents-line)] hover:bg-[var(--agents-panel)] hover:text-[var(--agents-strong)] lg:shrink" data-testid={`agents-md-toc-${section.id}`}>
                  {section.title}
                </a>
              ))}
            </nav>
          ) : (
            <p className="mt-3 text-[12px] leading-5 text-[var(--agents-muted)]" role={loadError ? "alert" : undefined}>
              {loadError ? "The briefing could not be loaded. Use the raw file link above." : "Loading the canonical briefing…"}
            </p>
          )}
          <div className="mt-6 hidden rounded-2xl border border-[var(--agents-line)] bg-[var(--agents-panel)] p-4 lg:block">
            <p className="font-mono text-[9px] uppercase tracking-[.2em] text-[var(--agents-mint)]">Source</p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--agents-soft)]">The article and these section links are both generated from the Markdown at <a href="/AGENTS.md" className="text-[var(--agents-amber)] underline underline-offset-2">/AGENTS.md</a>.</p>
          </div>
        </aside>

        <article
          id="agents-briefing"
          className="agents-md-article min-w-0"
          data-testid="agents-md-article"
          aria-busy={!briefing && !loadError}
        >
          {briefing ? (
            <div dangerouslySetInnerHTML={{ __html: briefing.html }} />
          ) : loadError ? (
            <div className="rounded-2xl border border-[var(--agents-line)] bg-[var(--agents-panel)] p-6 text-[14px] leading-7 text-[var(--agents-soft)]" role="alert">
              The canonical briefing could not be loaded. Read or download the raw file at <a href="/AGENTS.md" className="text-[var(--agents-mint)] underline">/AGENTS.md</a>.
            </div>
          ) : (
            <p className="text-[14px] text-[var(--agents-muted)]">Loading the canonical briefing…</p>
          )}
        </article>
      </div>

      <footer className="mx-auto mb-10 max-w-7xl overflow-hidden rounded-2xl border border-[var(--agents-line)] bg-[var(--agents-footer)]">
        <div className="relative px-6 py-10 sm:px-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full border border-[var(--agents-amber)]/15" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-2 size-24 rounded-full border border-[var(--agents-mint)]/20" />
          <p className="font-mono text-[10px] uppercase tracking-[.28em] text-[var(--agents-amber)]">End of the briefing</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.02] tracking-[-.05em] text-[var(--agents-hero-title)] sm:text-5xl">The canonical briefing is ready to share.</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--agents-soft)]">Read the raw Markdown or open the app.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/auth" className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--agents-amber)] px-6 text-sm font-bold text-[var(--agents-button-ink)] transition hover:bg-[var(--agents-amber-hover)]" data-testid="link-agents-md-cta-start"><Rocket size={16} /> Start your team</Link>
            <Link href="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--agents-line)] px-6 text-sm font-semibold text-[var(--agents-text)] transition hover:border-[var(--agents-mint)] hover:text-[var(--agents-mint)]" data-testid="link-agents-md-cta-demo">Try the live demo <ArrowRight size={15} /></Link>
            <a href="/AGENTS.md" className="inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--agents-amber)]/40 bg-[var(--agents-amber)]/10 px-6 text-sm font-semibold text-[var(--agents-amber)] transition hover:bg-[var(--agents-amber)]/20" data-testid="link-agents-md-cta-raw">Raw /AGENTS.md <Download size={15} /></a>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-[var(--agents-line)] px-6 py-5 font-mono text-[10px] uppercase tracking-[.14em] text-[var(--agents-subtle)] sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span>Robotics Dashboard · canonical briefing</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/about" className="hover:text-[var(--agents-text)]">About</Link>
            <Link href="/pricing" className="hover:text-[var(--agents-text)]">Pricing</Link>
            <Link href="/compare" className="hover:text-[var(--agents-text)]">Compare</Link>
            <Link href="/privacy" className="hover:text-[var(--agents-text)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--agents-text)]">Terms</Link>
            <a href="/AGENTS.md" className="text-[var(--agents-mint)] hover:text-[var(--agents-strong)]">AGENTS.md</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
