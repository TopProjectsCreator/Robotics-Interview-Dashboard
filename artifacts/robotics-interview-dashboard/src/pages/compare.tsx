import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import "./compare.css";

const pageMeta = [
  {
    attribute: "name",
    key: "description",
    content:
      "Compare a robotics team workspace with Robolyst’s toolkit for FTC, FRC, FLL, and VEX teams, including FTC-specific scouting and competition data.",
  },
  {
    attribute: "property",
    key: "og:title",
    content: "Robotics team workspace vs. Robolyst",
  },
  {
    attribute: "property",
    key: "og:description",
    content:
      "A sourced comparison of build collaboration and Robolyst’s multi-program toolkit, with FTC-specific scouting and competition data.",
  },
  {
    attribute: "name",
    key: "twitter:title",
    content: "Robotics team workspace vs. Robolyst",
  },
  {
    attribute: "name",
    key: "twitter:description",
    content:
      "Compare build collaboration, Robolyst’s multi-program toolkit, FTC-specific scouting and data, and pricing.",
  },
] as const;

const comparisonAreas = [
  {
    area: "Core focus",
    workspace:
      "A shared workspace for robotics teams, connecting conversation and coordination with engineering and parts tools.",
    robolyst:
      "A team toolkit for FTC, FRC, FLL, and VEX. FTC competition sync, scouting, live results, metrics, and public team pages are FTC-specific.",
  },
  {
    area: "Planning and coordination",
    workspace:
      "Channels, direct messages, shared notes and files, live boards and spreadsheets, attendance, and public displays.",
    robolyst:
      "Roster and roles; task boards, lists, and timelines with dependencies; schedules, checklists, documentation, and Discord or Slack connections.",
  },
  {
    area: "Robot engineering",
    workspace:
      "Collaborative FTC Java editing with checkpoints and hub deploys, plus a shared CAD library with browser-based 3D previews.",
    robolyst:
      "An engineering notebook organized by subsystem and design stage, shared resources, and a 3D-print job queue.",
  },
  {
    area: "Parts and finances",
    workspace:
      "Supplier listing discovery, team-owned inventory, and reservations for robot builds.",
    robolyst:
      "Parts orders, expenses, and budgets; optional fiscal sponsorship takes 4% of funds flowing through it, plus separate card-processing fees.",
  },
  {
    area: "Scouting and match data",
    workspace:
      "Focused on team collaboration and robot-building tools rather than event-wide scouting or match analytics.",
    robolyst:
      "FTC pit and match scouting, picklists, and a strategy board; public FTC results and derived metrics use published FIRST match data.",
  },
  {
    area: "Public presence",
    workspace:
      "Public display tools for sharing selected team information.",
    robolyst:
      "FTC team profiles and public team sites for information such as rosters, robots, awards, and sponsors.",
  },
  {
    area: "Pricing",
    workspace:
      "One team plan: $0, available now, with no payment card required.",
    robolyst:
      "Team workspaces are free. Optional fiscal sponsorship takes 4% of funds flowing through it; Stripe card-processing fees are separate and donors may cover them.",
  },
] as const;

export default function ComparePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const previousTitle = document.title;
    const previousMeta = pageMeta.map(({ attribute, key, content }) => {
      const selector = `meta[${attribute}="${key}"]`;
      const existing = document.head.querySelector<HTMLMetaElement>(selector);
      const meta = existing ?? document.createElement("meta");
      const previousContent = meta.getAttribute("content");
      if (!existing) {
        meta.setAttribute(attribute, key);
        document.head.append(meta);
      }
      meta.setAttribute("content", content);
      return { meta, previousContent, created: !existing };
    });
    document.title = "Robotics team workspace vs. Robolyst";
    return () => {
      document.title = previousTitle;
      previousMeta.forEach(({ meta, previousContent, created }) => {
        if (created) meta.remove();
        else if (previousContent === null) meta.removeAttribute("content");
        else meta.setAttribute("content", previousContent);
      });
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <main className="compare-page" data-testid="compare-page">
      <div className="compare-page__shell">
        <header className="compare-page__header">
          <Link
            href="/"
            className="compare-page__brand"
            onClick={closeMenu}
            data-testid="link-compare-brand"
          >
            <BrandMark ariaLabel="Robotics team workspace" dataTestId="compare-brand-mark" />
            <span>
              <strong>ROBOTICS</strong>
              <small>TEAM WORKSPACE</small>
            </span>
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            className="compare-page__menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="compare-navigation"
            aria-expanded={menuOpen}
            data-testid="button-compare-menu"
          >
            {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>

          <nav
            id="compare-navigation"
            className={`compare-page__nav${menuOpen ? " is-open" : ""}`}
            aria-label="Main navigation"
            data-testid="compare-navigation"
          >
            <Link href="/" onClick={closeMenu} data-testid="link-compare-home">Platform</Link>
            <a href="#our-workspace" onClick={closeMenu} data-testid="link-compare-workspace">Our workspace</a>
            <a href="#public-info" onClick={closeMenu} data-testid="link-compare-public-info">Side-by-side</a>
            <Link
              href="/pricing"
              className="compare-page__nav-cta"
              onClick={closeMenu}
              data-testid="link-compare-pricing-nav"
            >
              Pricing <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <section className="compare-page__hero" aria-labelledby="compare-title" data-testid="section-compare-hero">
          <div className="compare-page__hero-copy">
            <p className="compare-page__eyebrow"><span /> ROBOTICS TEAM TOOLS · SIDE BY SIDE</p>
            <h1 id="compare-title">
              Our workspace
              <em> vs. Robolyst.</em>
            </h1>
            <p className="compare-page__hero-intro">
              Compare our shared robotics workspace with Robolyst’s toolkit for FTC, FRC, FLL, and VEX teams.
              Robolyst’s competition sync, scouting, and live competition data are FTC-specific.
            </p>
            <a className="compare-page__hero-link" href="#public-info" data-testid="link-compare-explore">
              See the comparison <ArrowDownRight size={16} aria-hidden="true" />
            </a>
            <p className="compare-page__date-line" data-testid="text-compare-date">
              OFFICIAL PRODUCT PAGES REVIEWED <strong> NOV 17, 2026</strong>
            </p>
          </div>

          <aside className="compare-page__hero-note" data-testid="card-compare-principle">
            <div className="compare-page__note-mark" aria-hidden="true"><span /><span /><span /></div>
            <p className="compare-page__note-label">THE SHORT VERSION</p>
            <h2>Different strengths. Both free.</h2>
            <p>
              Our workspace connects team conversation to engineering, parts, and planning. Robolyst offers a
              toolkit for FTC, FRC, FLL, and VEX teams; its live FTC data and scouting tools serve FTC teams.
              Pick the tools that solve your team’s actual gaps.
            </p>
            <a href="https://robolyst.org/" target="_blank" rel="noreferrer" data-testid="link-compare-robolyst-note">
              Explore Robolyst <ExternalLink size={14} aria-hidden="true" />
            </a>
          </aside>

          <div className="compare-page__hero-index" aria-hidden="true"><span>01</span> / TEAM WORKFLOWS</div>
        </section>

        <section className="compare-page__signal-row" aria-label="Workspace overview" data-testid="section-compare-overview">
          <div><span>01 / OUR FOCUS</span><strong>Build tools connected to team chat</strong></div>
          <div><span>02 / ROBOLYST</span><strong>Multi-program toolkit; FTC scouting & data</strong></div>
          <div><span>03 / PRICE</span><strong>Both offer free team workspaces</strong></div>
        </section>

        <section id="public-info" className="compare-page__public" aria-labelledby="public-info-title" data-testid="section-compare-public-info">
          <div className="compare-page__public-heading">
            <p className="compare-page__kicker">THE ACTUAL PRODUCT DIFFERENCES</p>
            <h2 id="public-info-title">Compare the work, tool by tool.</h2>
            <p>
              Both offer free team workspaces, but their strongest features solve different problems. Robolyst’s
              general toolkit supports FTC, FRC, FLL, and VEX; its competition data and scouting are FTC-specific.
            </p>
          </div>

          <div className="compare-page__comparison" role="group" aria-label="Robotics team workspace and Robolyst feature comparison">
            <article id="our-workspace" className="compare-page__comparison-card compare-page__comparison-card--ours" data-testid="card-compare-our-workspace">
              <div className="compare-page__comparison-top">
                <span className="compare-page__comparison-mark"><BrandMark dataTestId="compare-card-brand-mark" /></span>
                <div>
                  <p>ROBOTICS TEAM WORKSPACE</p>
                  <h3>Robotics team workspace</h3>
                </div>
              </div>
              <p className="compare-page__comparison-summary">
                Best fit when your team wants conversations and robot-building tools together.
              </p>
              <ul className="compare-page__fact-list">
                <li><Check size={15} aria-hidden="true" /><span>Channels, direct messages, shared notes, and files with team context</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Live shared boards, spreadsheets, and custom team tools</span></li>
                <li><Check size={15} aria-hidden="true" /><span>FTC Java editing, project checkpoints, and hub deploy options</span></li>
                <li><Check size={15} aria-hidden="true" /><span>CAD library with browser 3D previews; supplier parts, stock, and reservations</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Attendance, public-display tools, and built-in AI assistance</span></li>
                <li><Check size={15} aria-hidden="true" /><span>One team plan: $0, with no payment card required</span></li>
              </ul>
              <Link href="/pricing" className="compare-page__card-link" data-testid="link-compare-our-pricing">
                See our plan <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>

            <article id="robolyst" className="compare-page__comparison-card compare-page__comparison-card--robolyst" data-testid="card-compare-robolyst">
              <div className="compare-page__comparison-top">
                <span className="compare-page__comparison-mark compare-page__comparison-mark--robolyst">
                  <img src="/robolyst-icon.svg" alt="Robolyst logo" data-testid="img-compare-robolyst-logo" />
                </span>
                <div>
                  <p>MULTI-PROGRAM TEAM TOOLKIT</p>
                  <h3>Robolyst</h3>
                </div>
                <a
                  className="compare-page__external-icon"
                  href="https://robolyst.org/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Visit Robolyst official platform"
                  data-testid="link-compare-robolyst-icon"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="compare-page__comparison-summary">
                The toolkit serves FTC, FRC, FLL, and VEX teams. Competition sync, live data, scouting, and public
                team pages are FTC-specific.
              </p>
              <ul className="compare-page__fact-list">
                <li><Check size={15} aria-hidden="true" /><span>Roster and roles; task boards with dependencies, meeting calendar, and checklists</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Engineering notebook, shared resources, and a 3D-print job queue</span></li>
                <li><Check size={15} aria-hidden="true" /><span>FTC pit and match scouting, team questions, picklists, and strategy board</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Public FTC team and event data, rankings, match results, and metrics from published FIRST results</span></li>
                <li><Check size={15} aria-hidden="true" /><span>FTC team sites and sponsor tools; shared inbox and Discord/Slack connections</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Team workspaces are free; optional fiscal sponsorship takes 4% of funds flowing through it, plus separate card-processing fees</span></li>
              </ul>
              <a
                href="https://robolyst.org/team-management/features"
                target="_blank"
                rel="noreferrer"
                className="compare-page__card-link compare-page__card-link--external"
                data-testid="link-compare-robolyst-features"
              >
                Explore Robolyst’s features <ExternalLink size={14} aria-hidden="true" />
              </a>
            </article>
          </div>
          <div className="compare-page__matrix-wrap" data-testid="table-compare-areas">
            <table className="compare-page__matrix">
              <caption className="sr-only">Published information by robotics work area</caption>
              <thead>
                <tr>
                  <th scope="col">Work area</th>
                  <th scope="col">Our workspace</th>
                  <th scope="col">Robolyst</th>
                </tr>
              </thead>
              <tbody>
                {comparisonAreas.map(({ area, workspace, robolyst }) => (
                  <tr key={area} data-testid={`row-compare-area-${area.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                    <th scope="row">{area}</th>
                    <td><span className="compare-page__matrix-label">Our workspace</span>{workspace}</td>
                    <td><span className="compare-page__matrix-label">Robolyst official sources</span>{robolyst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="compare-page__source-note" data-testid="text-compare-source-note">
            <span>01</span>
            <span>
              Sources reviewed Nov 17, 2026: our public platform, chat, code, CAD, parts, and pricing pages;
              Robolyst’s homepage, toolkit features, FTC scouting and metrics references, and Help fee information.
              Availability and features can change.
              {" "}
              <Link href="/" data-testid="source-workspace-platform">Workspace platform</Link>
              {" · "}
              <Link href="/chat-landing" data-testid="source-workspace-chat">Chat</Link>
              {" · "}
              <Link href="/code-landing" data-testid="source-workspace-code">Code</Link>
              {" · "}
              <Link href="/cad-landing" data-testid="source-workspace-cad">CAD</Link>
              {" · "}
              <Link href="/parts-landing" data-testid="source-workspace-parts">Parts</Link>
              {" · "}
              <Link href="/pricing" data-testid="source-workspace-pricing">Pricing</Link>
              {" · "}
              <a href="https://robolyst.org/" target="_blank" rel="noreferrer" data-testid="source-robolyst-home">Robolyst homepage</a>
              {" · "}
              <a href="https://robolyst.org/team-management/features" target="_blank" rel="noreferrer" data-testid="source-robolyst-toolkit">Team toolkit</a>
              {" · "}
              <a href="https://robolyst.org/team-management/features/scouting" target="_blank" rel="noreferrer" data-testid="source-robolyst-scouting">FTC scouting</a>
              {" · "}
              <a href="https://robolyst.org/ftc/scouting-metrics" target="_blank" rel="noreferrer" data-testid="source-robolyst-metrics">FTC metrics</a>
              {" · "}
              <a href="https://robolyst.org/help" target="_blank" rel="noreferrer" data-testid="source-robolyst-fees">Pricing and fees</a>
            </span>
          </p>
        </section>

        <section className="compare-page__closing" aria-labelledby="compare-closing-title" data-testid="section-compare-closing">
          <div className="compare-page__closing-copy">
            <p className="compare-page__kicker">PICK THE TOOLS THAT FIT</p>
            <h2 id="compare-closing-title">Build together.<br /><em>Run the season.</em></h2>
            <p>Use our workspace for team conversation and robot-building tools. Robolyst’s toolkit supports FTC, FRC, FLL, and VEX teams, with scouting and competition data for FTC.</p>
          </div>
          <div className="compare-page__closing-actions">
            <Link href="/pricing" className="compare-page__primary-link" data-testid="link-compare-closing-pricing">
              Explore our free plan <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="https://robolyst.org/" target="_blank" rel="noreferrer" className="compare-page__secondary-link" data-testid="link-compare-closing-platform">
              Explore Robolyst <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </section>

        <footer className="compare-page__footer" data-testid="footer-compare">
          <span>ROBOTICS TEAM WORKSPACE</span>
          <span>One shared home for the work behind the robot.</span>
          <div>
            <Link href="/" data-testid="link-compare-footer-home">Platform</Link>
            <Link href="/pricing" data-testid="link-compare-footer-pricing">Pricing</Link>
            <a href="https://robolyst.org/" target="_blank" rel="noreferrer" data-testid="link-compare-footer-robolyst">
              Robolyst <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
