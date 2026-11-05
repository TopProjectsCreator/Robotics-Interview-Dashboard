import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowDownRight,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  Code2,
  Cpu,
  ExternalLink,
  Menu,
  MessageSquare,
  Package,
  Radio,
  UsersRound,
  X,
} from "lucide-react";
import "./compare.css";

const pageMeta = [
  {
    attribute: "name",
    key: "description",
    content:
      "A careful look at the robotics team workspace and the public information currently available from Robolyst.",
  },
  {
    attribute: "property",
    key: "og:title",
    content: "A clear look at robotics team workspaces",
  },
  {
    attribute: "property",
    key: "og:description",
    content:
      "Review the tools in our shared robotics workspace and see what Robolyst currently publishes.",
  },
  {
    attribute: "name",
    key: "twitter:title",
    content: "A clear look at robotics team workspaces",
  },
  {
    attribute: "name",
    key: "twitter:description",
    content:
      "Review the tools in our shared robotics workspace and see what Robolyst currently publishes.",
  },
] as const;

const featureLinks = [
  {
    icon: MessageSquare,
    label: "Chat & collaboration",
    detail: "Channels, direct messages, shared notes, boards, and spreadsheets.",
    href: "/chat-landing",
    testId: "link-compare-chat",
  },
  {
    icon: Package,
    label: "Parts & inventory",
    detail: "Discover supplier parts, track owned stock, and reserve components.",
    href: "/parts-landing",
    testId: "link-compare-parts",
  },
  {
    icon: Code2,
    label: "FTC Java code",
    detail: "Collaborate on code with team deploy options.",
    href: "/code-landing",
    testId: "link-compare-code",
  },
  {
    icon: Cpu,
    label: "CAD & 3D",
    detail: "Organize shared CAD and review 3D previews together.",
    href: "/cad-landing",
    testId: "link-compare-cad",
  },
  {
    icon: UsersRound,
    label: "Team operations",
    detail: "Coordinate day-to-day work with attendance tools and public displays.",
    href: "/about",
    testId: "link-compare-operations",
  },
] as const;

const comparisonAreas = [
  {
    area: "Team communication",
    workspace: "Channels, direct messages, and shared notes keep discussions close to the work.",
    robolyst: "No feature details are published on the official homepage.",
  },
  {
    area: "Robotics workspaces",
    workspace: "Shared boards, spreadsheets, and team information support work across the season.",
    robolyst: "No workspace details are published on the official homepage.",
  },
  {
    area: "Parts workflows",
    workspace: "Discover configured supplier listings, track owned stock, and reserve parts for builds.",
    robolyst: "No parts workflow details are published on the official homepage.",
  },
  {
    area: "Code and CAD",
    workspace: "Collaborate on FTC Java and organize shared CAD with browser-based 3D previews.",
    robolyst: "No coding or CAD details are published on the official homepage.",
  },
  {
    area: "Team operations",
    workspace: "Attendance and public-display tools help teams coordinate shared activities.",
    robolyst: "No team-operations details are published on the official homepage.",
  },
  {
    area: "Scouting and public information",
    workspace: "The public pages reviewed do not describe a dedicated scouting workflow or public team profile.",
    robolyst: "The official homepage does not publish details about scouting or public team information.",
  },
  {
    area: "Price and access",
    workspace: "The published team plan is $0 and does not require a payment card.",
    robolyst: "No public price or sign-up availability details are shown on the official homepage.",
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
    document.title = "Robotics team workspace · Public information";
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
            <a href="#workspace" onClick={closeMenu} data-testid="link-compare-workspace">Our workspace</a>
            <a href="#public-info" onClick={closeMenu} data-testid="link-compare-public-info">Public information</a>
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
            <p className="compare-page__eyebrow"><span /> A TRANSPARENT, PUBLIC LOOK</p>
            <h1 id="compare-title">
              Make room for
              <em> the work.</em>
            </h1>
            <p className="compare-page__hero-intro">
              Robotics teams deserve clear information. Here’s what our shared workspace brings together—and what
              Robolyst currently shares publicly.
            </p>
            <a className="compare-page__hero-link" href="#workspace" data-testid="link-compare-explore">
              Explore the workspace <ArrowDownRight size={16} aria-hidden="true" />
            </a>
            <p className="compare-page__date-line" data-testid="text-compare-date">
              PUBLIC INFORMATION CHECKED <strong> NOV 5, 2026</strong>
            </p>
          </div>

          <aside className="compare-page__hero-note" data-testid="card-compare-principle">
            <div className="compare-page__note-mark" aria-hidden="true"><span /><span /><span /></div>
            <p className="compare-page__note-label">A NOTE ON THIS PAGE</p>
            <h2>Facts, not guesses.</h2>
            <p>
              We describe our own workspace and link directly to Robolyst’s official site. Where public details
              aren’t available, we say so.
            </p>
            <a href="https://www.robolyst.com/" target="_blank" rel="noreferrer" data-testid="link-compare-robolyst-note">
              Visit Robolyst <ExternalLink size={14} aria-hidden="true" />
            </a>
          </aside>

          <div className="compare-page__hero-index" aria-hidden="true"><span>01</span> / OPEN INFORMATION</div>
        </section>

        <section className="compare-page__signal-row" aria-label="Workspace overview" data-testid="section-compare-overview">
          <div><span>01 / HOME</span><strong>One shared team workspace</strong></div>
          <div><span>02 / INCLUDED</span><strong>Chat, engineering, parts & coordination</strong></div>
          <div><span>03 / PRICE</span><strong>$0 · No payment card required</strong></div>
        </section>

        <section id="workspace" className="compare-page__workspace" aria-labelledby="workspace-title" data-testid="section-compare-workspace">
          <div className="compare-page__section-heading">
            <div>
              <p className="compare-page__kicker">OUR ROBOTICS TEAM WORKSPACE</p>
              <h2 id="workspace-title">Keep the moving parts connected.</h2>
            </div>
            <p>
              Conversations, engineering work, parts, and day-to-day coordination can live in one shared place.
              Start with the area your team needs.
            </p>
          </div>

          <div className="compare-page__workspace-layout">
            <div className="compare-page__workspace-visual" aria-label="Diagram of connected robotics team work" data-testid="visual-compare-workspace-map">
              <div className="compare-page__map-grid" aria-hidden="true" />
              <span className="compare-page__orbit compare-page__orbit--one" aria-hidden="true" />
              <span className="compare-page__orbit compare-page__orbit--two" aria-hidden="true" />
              <span className="compare-page__map-line compare-page__map-line--chat" aria-hidden="true" />
              <span className="compare-page__map-line compare-page__map-line--design" aria-hidden="true" />
              <span className="compare-page__map-line compare-page__map-line--parts" aria-hidden="true" />
              <span className="compare-page__map-line compare-page__map-line--plan" aria-hidden="true" />
              <div className="compare-page__map-center">
                <span><UsersRound size={20} aria-hidden="true" /></span>
                <strong>Your team</strong>
                <small>ONE SHARED HOME</small>
              </div>
              <div className="compare-page__map-node compare-page__map-node--chat"><MessageSquare size={15} aria-hidden="true" /> Chat</div>
              <div className="compare-page__map-node compare-page__map-node--design"><Cpu size={15} aria-hidden="true" /> CAD & 3D</div>
              <div className="compare-page__map-node compare-page__map-node--parts"><Package size={15} aria-hidden="true" /> Parts</div>
              <div className="compare-page__map-node compare-page__map-node--plan"><Boxes size={15} aria-hidden="true" /> Coordination</div>
              <p className="compare-page__map-caption"><Radio size={12} aria-hidden="true" /> WORK, IN CONTEXT</p>
            </div>

            <div className="compare-page__feature-list" data-testid="list-compare-features">
              {featureLinks.map(({ icon: Icon, label, detail, href, testId }, index) => (
                <article className="compare-page__feature" key={href} data-testid={`card-compare-feature-${index + 1}`}>
                  <span className={`compare-page__feature-icon compare-page__feature-icon--${index + 1}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div className="compare-page__feature-copy">
                    <h3>{label}</h3>
                    <p>{detail}</p>
                  </div>
                  <Link href={href} className="compare-page__feature-link" data-testid={testId}>
                    Details <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>

          <div className="compare-page__included-note" data-testid="text-compare-extra-tools">
            <Check size={16} aria-hidden="true" />
            <p><strong>And shared team tools:</strong> notes, boards, spreadsheets, and coordination tools sit alongside the engineering work.</p>
          </div>
        </section>

        <section id="public-info" className="compare-page__public" aria-labelledby="public-info-title" data-testid="section-compare-public-info">
          <div className="compare-page__public-heading">
            <p className="compare-page__kicker">WHAT’S PUBLICLY AVAILABLE</p>
            <h2 id="public-info-title">A careful side-by-side.</h2>
            <p>
              This page separates documented workspace details from what is currently published by Robolyst.
              It does not assume what either product may offer beyond those details.
            </p>
          </div>

          <div className="compare-page__comparison" role="group" aria-label="Public information for the robotics team workspace and Robolyst">
            <article className="compare-page__comparison-card compare-page__comparison-card--ours" data-testid="card-compare-our-workspace">
              <div className="compare-page__comparison-top">
                <span className="compare-page__comparison-mark"><BrandMark dataTestId="compare-card-brand-mark" /></span>
                <div>
                  <p>OUR WORKSPACE</p>
                  <h3>Robotics team workspace</h3>
                </div>
              </div>
              <p className="compare-page__comparison-summary">
                A shared home for robotics team collaboration, engineering work, parts, and coordination.
              </p>
              <ul className="compare-page__fact-list">
                <li><Check size={15} aria-hidden="true" /><span>Team chat, channels, direct messages, and shared notes</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Shared boards, spreadsheets, and team information</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Supplier parts discovery, owned stock, and reservations</span></li>
                <li><Check size={15} aria-hidden="true" /><span>FTC Java collaboration and deploy options</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Shared CAD organization and 3D previews</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Attendance and public-display tools</span></li>
                <li><Check size={15} aria-hidden="true" /><span>Team workspace: $0; no payment card required</span></li>
              </ul>
              <Link href="/pricing" className="compare-page__card-link" data-testid="link-compare-our-pricing">
                See workspace pricing <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>

            <article className="compare-page__comparison-card compare-page__comparison-card--robolyst" data-testid="card-compare-robolyst">
              <div className="compare-page__comparison-top">
                <div>
                  <p>OFFICIAL PUBLIC INFORMATION</p>
                  <h3>Robolyst</h3>
                </div>
                <a
                  className="compare-page__external-icon"
                  href="https://www.robolyst.com/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Visit Robolyst official homepage"
                  data-testid="link-compare-robolyst-icon"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="compare-page__brand-line">“AI Driven. Risk Defined.”</p>
              <div className="compare-page__public-limit" data-testid="notice-compare-public-limit">
                <span className="compare-page__limit-indicator" aria-hidden="true"><ChevronDown size={15} /></span>
                <div>
                  <strong>Feature and pricing details aren’t published.</strong>
                  <p>
                    As of Nov 5, 2026, the official homepage displays the brand line above. Public feature and
                    pricing information is not available there; the <code>/features</code> and <code>/pricing</code> paths are not published.
                  </p>
                  <p className="compare-page__limit-conclusion">
                    That means we can’t make a feature, availability, or price comparison from public information.
                  </p>
                </div>
              </div>
              <a
                href="https://www.robolyst.com/"
                target="_blank"
                rel="noreferrer"
                className="compare-page__card-link compare-page__card-link--external"
                data-testid="link-compare-robolyst-homepage"
              >
                Visit Robolyst’s official homepage <ExternalLink size={14} aria-hidden="true" />
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
                  <th scope="col">Robolyst’s official homepage</th>
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
            <span>01</span> Information checked Nov 5, 2026. For current public information about Robolyst, visit its official homepage.
          </p>
        </section>

        <section className="compare-page__closing" aria-labelledby="compare-closing-title" data-testid="section-compare-closing">
          <div className="compare-page__closing-copy">
            <p className="compare-page__kicker">YOUR TEAM’S WORK, TOGETHER</p>
            <h2 id="compare-closing-title">One workspace.<br /><em>Room to build.</em></h2>
            <p>Bring the conversations, designs, parts, and next steps into a shared home built for robotics teams.</p>
          </div>
          <div className="compare-page__closing-actions">
            <Link href="/pricing" className="compare-page__primary-link" data-testid="link-compare-closing-pricing">
              See the $0 team plan <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/" className="compare-page__secondary-link" data-testid="link-compare-closing-platform">
              Explore the workspace <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <footer className="compare-page__footer" data-testid="footer-compare">
          <span>ROBOTICS TEAM WORKSPACE</span>
          <span>One shared home for the work behind the robot.</span>
          <div>
            <Link href="/" data-testid="link-compare-footer-home">Platform</Link>
            <Link href="/pricing" data-testid="link-compare-footer-pricing">Pricing</Link>
            <a href="https://www.robolyst.com/" target="_blank" rel="noreferrer" data-testid="link-compare-footer-robolyst">
              Robolyst <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
