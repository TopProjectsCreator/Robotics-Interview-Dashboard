import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  Check,
  Code2,
  Cpu,
  Menu,
  MessageSquare,
  Package,
  UsersRound,
  X,
} from "lucide-react";
import "./pricing.css";

const pageMeta = [
  {
    attribute: "name",
    key: "description",
    content:
      "One free shared workspace for robotics teams to collaborate on chat, CAD, code, parts, and team coordination. No payment card required.",
  },
  { attribute: "property", key: "og:title", content: "Pricing · Robotics Team Workspace" },
  {
    attribute: "property",
    key: "og:description",
    content: "One team plan. $0. A shared home for the work behind the robot.",
  },
  { attribute: "name", key: "twitter:title", content: "Pricing · Robotics Team Workspace" },
  {
    attribute: "name",
    key: "twitter:description",
    content: "One team plan. $0. No payment card required.",
  },
] as const;

const included = [
  { icon: MessageSquare, title: "Team chat", detail: "Keep build conversations and decisions together." },
  { icon: Cpu, title: "CAD & 3D", detail: "Review designs beside the discussion around them." },
  { icon: Code2, title: "Shared code", detail: "Work on robot code with the team in context." },
  { icon: Package, title: "Parts & inventory", detail: "Track the components that keep a build moving." },
  { icon: Boxes, title: "Shared tools", detail: "Plans, boards, files, and team information in one home." },
  { icon: UsersRound, title: "Team coordination", detail: "Make the next step clear to everyone." },
];

export default function Pricing() {
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
    document.title = "Pricing · Robotics Team Workspace";
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
    <main className="pricing-page" data-testid="pricing-page">
      <div className="pricing-page__shell">
        <header className="pricing-page__nav">
          <Link href="/" className="pricing-page__brand" onClick={closeMenu} data-testid="link-pricing-brand">
            <BrandMark />
            <span className="pricing-page__brand-copy">
              <strong>ROBOTICS</strong>
              <small>TEAM WORKSPACE</small>
            </span>
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            className="pricing-page__menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="pricing-navigation"
            aria-expanded={menuOpen}
            data-testid="button-pricing-menu"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <nav
            id="pricing-navigation"
            className={`pricing-page__nav-links ${menuOpen ? "is-open" : ""}`}
            aria-label="Pricing navigation"
          >
            <a href="#included" onClick={closeMenu} data-testid="link-pricing-included">What’s included</a>
            <a href="#one-plan" onClick={closeMenu} data-testid="link-pricing-plan">The plan</a>
            <Link href="/compare" onClick={closeMenu} data-testid="link-pricing-compare">Compare</Link>
            <Link href="/auth" className="pricing-page__nav-cta" onClick={closeMenu} data-testid="link-pricing-nav-auth">
              Open your workspace <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <section className="pricing-page__hero" aria-labelledby="pricing-title">
          <div className="pricing-page__hero-copy">
            <p className="pricing-page__eyebrow"><span /> ONE PLAN FOR THE WHOLE TEAM</p>
            <h1 id="pricing-title">
              The work behind the robot.
              <em> All together. $0.</em>
            </h1>
            <p className="pricing-page__intro">
              A shared home for your robotics team’s conversations, designs, code, parts, and coordination.
              Bring the crew in and get back to building.
            </p>
            <div className="pricing-page__hero-actions">
              <Link href="/auth" className="pricing-page__primary-cta" data-testid="link-pricing-hero-auth">
                Set up your team <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#one-plan" className="pricing-page__text-link" data-testid="link-pricing-see-plan">
                See the one plan <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
            <p className="pricing-page__card-note"><Check size={14} aria-hidden="true" /> No payment card required</p>
            <p className="pricing-page__creator-credit">
              Made by <strong>Team 23442</strong>, for robotics teams like yours.
            </p>
          </div>

          <aside className="pricing-page__price-panel" aria-label="Team plan price">
            <div className="pricing-page__panel-top">
              <span>THE TEAM PLAN</span>
              <span className="pricing-page__live-mark"><i /> AVAILABLE NOW</span>
            </div>
            <div className="pricing-page__price">
              <span className="pricing-page__currency">$</span>
              <strong>0</strong>
              <span className="pricing-page__per">for your<br />team</span>
            </div>
            <p className="pricing-page__price-caption">One plan. The shared workspace.</p>
            <div className="pricing-page__panel-rule" />
            <ul className="pricing-page__quick-list">
              <li><Check size={15} aria-hidden="true" /> All your teammates, together</li>
              <li><Check size={15} aria-hidden="true" /> Tools for the work behind the robot</li>
              <li><Check size={15} aria-hidden="true" /> No payment card required</li>
            </ul>
            <Link href="/auth" className="pricing-page__panel-cta" data-testid="link-pricing-panel-auth">
              Start your team workspace <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <p className="pricing-page__panel-foot">A place for the whole team to build.</p>
            <div aria-hidden="true" className="pricing-page__panel-orbit pricing-page__panel-orbit--one" />
            <div aria-hidden="true" className="pricing-page__panel-orbit pricing-page__panel-orbit--two" />
          </aside>
          <div className="pricing-page__hero-index" aria-hidden="true"><span>01</span> / 01</div>
        </section>

        <section className="pricing-page__signal-band" aria-label="Plan summary">
          <div><span>01 / PRICE</span><strong>$0</strong></div>
          <div><span>02 / PLAN</span><strong>One team plan</strong></div>
          <div><span>03 / ACCESS</span><strong>No payment card required</strong></div>
        </section>

        <section id="included" className="pricing-page__included" aria-labelledby="included-title">
          <div className="pricing-page__section-heading">
            <div>
              <p className="pricing-page__section-kicker">A shared home, not scattered tools</p>
              <h2 id="included-title">Everything the team needs to move the build forward.</h2>
            </div>
            <p>One place to share progress, make decisions, and keep the work connected to the people doing it.</p>
          </div>
          <div className="pricing-page__included-layout">
            <div className="pricing-page__included-visual" aria-label="A map of connected team work">
              <div className="pricing-page__map-grid" aria-hidden="true" />
              <div className="pricing-page__map-center">
                <span className="pricing-page__map-center-icon"><UsersRound size={21} aria-hidden="true" /></span>
                <strong>Your team</strong>
                <small>ONE SHARED WORKSPACE</small>
              </div>
              <div className="pricing-page__map-node pricing-page__map-node--chat"><MessageSquare size={15} /><span>Chat</span></div>
              <div className="pricing-page__map-node pricing-page__map-node--cad"><Cpu size={15} /><span>CAD</span></div>
              <div className="pricing-page__map-node pricing-page__map-node--code"><Code2 size={15} /><span>Code</span></div>
              <div className="pricing-page__map-node pricing-page__map-node--parts"><Package size={15} /><span>Parts</span></div>
              <span className="pricing-page__map-line pricing-page__map-line--a" aria-hidden="true" />
              <span className="pricing-page__map-line pricing-page__map-line--b" aria-hidden="true" />
              <span className="pricing-page__map-line pricing-page__map-line--c" aria-hidden="true" />
              <span className="pricing-page__map-line pricing-page__map-line--d" aria-hidden="true" />
              <p className="pricing-page__map-caption">THE WORK CONNECTS HERE</p>
            </div>
            <div className="pricing-page__included-list">
              {included.map(({ icon: Icon, title, detail }, index) => (
                <article className="pricing-page__included-item" key={title} data-testid={`item-pricing-included-${index + 1}`}>
                  <span className={`pricing-page__item-icon pricing-page__item-icon--${index + 1}`}><Icon size={17} aria-hidden="true" /></span>
                  <div><h3>{title}</h3><p>{detail}</p></div>
                  <span className="pricing-page__item-number">{String(index + 1).padStart(2, "0")}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="one-plan" className="pricing-page__plan-section" aria-labelledby="plan-title">
          <div className="pricing-page__plan-intro">
            <p className="pricing-page__section-kicker">Simple by design</p>
            <h2 id="plan-title">One plan.<br /><em>Your whole team.</em></h2>
            <p>No tier maze. No extras to piece together. Just a shared workspace for the people building together.</p>
          </div>
          <article className="pricing-page__plan-card" aria-label="The robotics team workspace plan">
            <div className="pricing-page__plan-card-head">
              <div>
                <span className="pricing-page__plan-tag">THE TEAM PLAN</span>
                <h3>Robotics team workspace</h3>
              </div>
              <span className="pricing-page__plan-stamp"><Check size={15} aria-hidden="true" /> ONE PLAN</span>
            </div>
            <div className="pricing-page__plan-price"><strong>$0</strong><span>for your team</span></div>
            <p className="pricing-page__plan-description">A shared home for the work behind the robot.</p>
            <div className="pricing-page__plan-divider" />
            <ul className="pricing-page__plan-features">
              {[
                "Team chat and shared context",
                "CAD, code, and design collaboration",
                "Parts, plans, and team coordination",
                "One workspace for the whole crew",
              ].map((feature) => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}
            </ul>
            <Link href="/auth" className="pricing-page__plan-cta" data-testid="link-pricing-plan-auth">
              Set up your team <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <p className="pricing-page__no-card">No payment card required.</p>
          </article>
        </section>

        <section className="pricing-page__closing" aria-labelledby="pricing-closing-title">
          <div className="pricing-page__closing-mark" aria-hidden="true"><span /><span /><span /></div>
          <p className="pricing-page__section-kicker">Made for the people building together</p>
          <h2 id="pricing-closing-title">Bring the whole team<br />into the work.</h2>
          <p>Give every conversation, design, and next step a shared place to live.</p>
          <Link href="/auth" className="pricing-page__primary-cta pricing-page__primary-cta--closing" data-testid="link-pricing-closing-auth">
            Open your team workspace <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>

        <footer className="pricing-page__footer">
          <span>ROBOTICS TEAM WORKSPACE</span>
          <span>One team plan · $0 · No payment card required</span>
          <Link href="/" data-testid="link-pricing-footer-home">Back to the platform <ArrowRight size={13} aria-hidden="true" /></Link>
        </footer>
      </div>
    </main>
  );
}
