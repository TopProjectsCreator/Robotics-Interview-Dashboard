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
      "Compare our FTC team workspace with Robolyst’s season management, scouting, live competition data, and public team tools.",
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
      "A sourced, feature-by-feature comparison of build collaboration tools and Robolyst’s FTC season platform.",
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
      "Compare build collaboration, FTC season management, scouting, public competition data, and pricing.",
  },
] as const;

const comparisonAreas = [
  {
    area: "Core focus",
    workspace:
      "A shared team workspace connecting conversations with FTC code, CAD, parts, boards, and spreadsheets.",
    robolyst:
      "An FTC season-management platform with team operations, scouting, live competition data, and public team tools.",
  },
  {
    area: "Planning and coordination",
    workspace:
      "Channels, direct messages, shared notes, live boards and spreadsheets, attendance, and public displays.",
    robolyst:
      "Roster and roles; task boards, lists, and timelines with dependencies; meeting calendars; checklists; and Discord or Slack notifications.",
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
      "Supplier part discovery, team-owned inventory, and reservations for robot builds.",
    robolyst:
      "Parts orders, expenses, budgets, and optional fiscal sponsorship.",
  },
  {
    area: "Scouting and match data",
    workspace:
      "Focuses on team build collaboration—code, CAD, inventory, and planning—rather than event-wide scouting and match analytics.",
    robolyst:
      "Pit sheets, stand scouting, picklists, and a strategy board, alongside public team and event results, rankings, and FTC metrics.",
  },
  {
    area: "Public presence",
    workspace:
      "Public display tools for sharing selected team information.",
    robolyst:
      "An FTC team directory and public team websites for rosters, robots, awards, sponsors, and forms.",
  },
  {
    area: "Pricing",
    workspace:
      "One team plan: $0, with no payment card required.",
    robolyst:
      "Team workspaces are free. Fiscal sponsorship is optional and charges 4% of funds processed; Stripe card-processing fees are separate.",
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
            <p className="compare-page__eyebrow"><span /> FTC TEAM TOOLS · SIDE BY SIDE</p>
            <h1 id="compare-title">
              Our workspace
              <em> vs. Robolyst.</em>
            </h1>
            <p className="compare-page__hero-intro">
              Compare the work each product puts in one place: our build-collaboration workspace and Robolyst’s
              FTC season-management, scouting, and competition-data platform.
            </p>
            <a className="compare-page__hero-link" href="#public-info" data-testid="link-compare-explore">
              See the comparison <ArrowDownRight size={16} aria-hidden="true" />
            </a>
            <p className="compare-page__date-line" data-testid="text-compare-date">
              OFFICIAL PRODUCT PAGES REVIEWED <strong> NOV 4, 2026</strong>
            </p>
          </div>

          <aside className="compare-page__hero-note" data-testid="card-compare-principle">
            <div className="compare-page__note-mark" aria-hidden="true"><span /><span /><span /></div>
            <p className="compare-page__note-label">THE SHORT VERSION</p>
            <h2>Different strengths. Both free.</h2>
            <p>
              Our workspace connects team conversation to code, CAD, and parts. Robolyst adds season operations,
              scouting, public FTC results, and team websites. Pick the tools that solve your team’s actual gaps.
            </p>
            <a href="https://robolyst.org/" target="_blank" rel="noreferrer" data-testid="link-compare-robolyst-note">
              Explore Robolyst <ExternalLink size={14} aria-hidden="true" />
            </a>
          </aside>

          <div className="compare-page__hero-index" aria-hidden="true"><span>01</span> / FTC WORKFLOWS</div>
        </section>

        <section className="compare-page__signal-row" aria-label="Workspace overview" data-testid="section-compare-overview">
          <div><span>01 / OUR FOCUS</span><strong>Build tools connected to team chat</strong></div>
          <div><span>02 / ROBOLYST</span><strong>Season operations, scouting & FTC data</strong></div>
          <div><span>03 / PRICE</span><strong>Both offer free team workspaces</strong></div>
        </section>

        <section id="public-info" className="compare-page__public" aria-labelledby="public-info-title" data-testid="section-compare-public-info">
          <div className="compare-page__public-heading">
            <p className="compare-page__kicker">THE ACTUAL PRODUCT DIFFERENCES</p>
            <h2 id="public-info-title">Compare the work, tool by tool.</h2>
            <p>
              Both support FTC teams, but their strongest features solve different problems. Here’s what each
              product’s own pages say it does.
            </p>
          </div>

          <div className="compare-page__comparison" role="group" aria-label="Robotics team workspace and Robolyst feature comparison">
            <article id="our-workspace" className="compare-page__comparison-card compare-page__comparison-card--ours" data-testid="card-compare-our-workspace">
              <div className="compare-page__comparison-top">
                <span className="compare-page__comparison-mark"><BrandMark dataTestId="compare-card-brand-mark" /></span>
                <div>
                  <p>BUILD COLLABORATION</p>
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
                  <p>FTC SEASON OPERATIONS + SCOUTING</p>
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
                Best fit for teams that want season management, scouting, and public FTC competition information.
              </p>
              <ul className="compare-page__fact-list">
                <li><Check size={15} aria-hidden="true" /><span>Roster and roles; task boards with dependencies, meeting calendar, and checklists</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Engineering notebook, shared resources, and a 3D-print job queue</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Pit sheets, stand scouting, team questions, picklists, and strategy board</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Public team and event directory, rankings, live match results, and scouting metrics</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Team websites, sponsor tools, shared inbox, and Discord/Slack connections</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Team workspaces are free; optional fiscal sponsorship costs 4% plus card-processing fees</span></li>
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
                    <td><span className="compare-page__matrix-label">Robolyst’s homepage</span>{robolyst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="compare-page__source-note" data-testid="text-compare-source-note">
            <span>01</span>
            <span>
              Sources reviewed Nov 4, 2026: our public product pages and pricing; Robolyst’s official Team HQ,
              scouting, competition-data, and help pages. Feature availability can change.
              {" "}
              <a href="https://robolyst.org/team-management/features" target="_blank" rel="noreferrer">Team HQ features</a>
              {" · "}
              <a href="https://robolyst.org/team-management/features/scouting" target="_blank" rel="noreferrer">Scouting</a>
              {" · "}
              <a href="https://robolyst.org/ftc/scouting-metrics" target="_blank" rel="noreferrer">FTC metrics</a>
              {" · "}
              <a href="https://robolyst.org/help" target="_blank" rel="noreferrer">Pricing and fees</a>
            </span>
          </p>
        </section>

        <section className="compare-page__closing" aria-labelledby="compare-closing-title" data-testid="section-compare-closing">
          <div className="compare-page__closing-copy">
            <p className="compare-page__kicker">PICK THE TOOLS THAT FIT</p>
            <h2 id="compare-closing-title">Build together.<br /><em>Run the season.</em></h2>
            <p>Use our workspace for team conversation and robot-building tools. Use Robolyst for season workflows, scouting, and public FTC data.</p>
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
