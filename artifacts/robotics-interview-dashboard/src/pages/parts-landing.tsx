import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDownRight,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Database,
  ExternalLink,
  Filter,
  Menu,
  PackageCheck,
  Search,
  ShoppingCart,
  Tag,
  Wrench,
  X,
} from "lucide-react";
import "./parts-landing.css";

type Vendor = "All sources" | "REV Robotics" | "AndyMark" | "McMaster-Carr";

const pageMeta = [
  {
    attribute: "name",
    key: "description",
    content:
      "Explore how robotics teams organize supplier part discovery, owned and available inventory, and robot-build reservations in a private team workspace.",
  },
  {
    attribute: "property",
    key: "og:title",
    content: "Robotics Parts & Inventory Workspace",
  },
  {
    attribute: "property",
    key: "og:description",
    content:
      "Supplier discovery, team-owned stock, and robot-build reservations.",
  },
  {
    attribute: "name",
    key: "twitter:title",
    content: "Robotics Parts & Inventory Workspace",
  },
  {
    attribute: "name",
    key: "twitter:description",
    content:
      "Explore supplier discovery, team-owned stock, and robot-build reservations.",
  },
] as const;

const illustrativeParts = [
  {
    id: "rev-hex-12",
    name: "12 mm Hex Shaft",
    detail: "500 mm length · steel",
    vendor: "REV Robotics" as const,
    sku: "REV-41-1679",
    owned: 8,
    available: 5,
    tone: "teal",
  },
  {
    id: "am-chain-25",
    name: "25 Series Roller Chain",
    detail: "2 ft segment · #25",
    vendor: "AndyMark" as const,
    sku: "am-42-0104",
    owned: 3,
    available: 1,
    tone: "yellow",
  },
  {
    id: "mm-spacer-08",
    name: "Aluminum Spacer",
    detail: "8 mm ID · 12 mm OD",
    vendor: "McMaster-Carr" as const,
    sku: "90128A110",
    owned: 24,
    available: 18,
    tone: "blue",
  },
  {
    id: "rev-neo-550",
    name: "NEO 550 Motor",
    detail: "Brushless · 11.1 V",
    vendor: "REV Robotics" as const,
    sku: "REV-21-1651",
    owned: 6,
    available: 2,
    tone: "coral",
  },
];

const workflow = [
  {
    number: "01",
    icon: Search,
    title: "Search across the bench",
    text: "Find a name, SKU, or useful description across the vendor listings configured for your team.",
  },
  {
    number: "02",
    icon: Boxes,
    title: "Separate owned from found",
    text: "See what the team has on hand beside what a vendor listing describes. No guesswork in the build meeting.",
  },
  {
    number: "03",
    icon: ClipboardCheck,
    title: "Reserve for the robot",
    text: "Set aside an available quantity for a build so the next person knows what is spoken for.",
  },
];

export default function PartsLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [vendor, setVendor] = useState<Vendor>("All sources");

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
    document.title = "Robotics Parts & Inventory Workspace";

    return () => {
      document.title = previousTitle;
      previousMeta.forEach(({ meta, previousContent, created }) => {
        if (created) {
          meta.remove();
        } else if (previousContent === null) {
          meta.removeAttribute("content");
        } else {
          meta.setAttribute("content", previousContent);
        }
      });
    };
  }, []);

  const filteredParts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return illustrativeParts.filter((part) => {
      const matchesVendor = vendor === "All sources" || part.vendor === vendor;
      const matchesQuery =
        !query ||
        [part.name, part.detail, part.vendor, part.sku].some((field) =>
          field.toLowerCase().includes(query),
        );
      return matchesVendor && matchesQuery;
    });
  }, [searchTerm, vendor]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="parts-landing" data-testid="parts-landing">
      <div className="parts-landing__texture" aria-hidden="true" />
      <div className="parts-landing__orbit parts-landing__orbit--one" aria-hidden="true" />
      <div className="parts-landing__orbit parts-landing__orbit--two" aria-hidden="true" />

      <div className="parts-landing__shell">
        <header className="parts-landing__nav">
          <Link
            href="/"
            className="parts-landing__brand"
            onClick={closeMenu}
            data-testid="link-parts-brand"
          >
            <span className="parts-landing__brand-mark" aria-hidden="true">
              <CircleDot size={20} strokeWidth={2.4} />
            </span>
            <span className="parts-landing__brand-copy">
              <strong>ROBOTICS</strong>
              <small>TEAM WORKSPACE</small>
            </span>
          </Link>

          <nav
            id="parts-landing-navigation"
            className={`parts-landing__nav-links ${menuOpen ? "is-open" : ""}`}
            aria-label="Parts workspace navigation"
          >
            <a href="#workflow" onClick={closeMenu} data-testid="link-parts-workflow">
              How it works
            </a>
            <a href="#coverage" onClick={closeMenu} data-testid="link-parts-coverage">
              Vendor coverage
            </a>
            <Link
              href="/auth"
              className="parts-landing__nav-cta"
              onClick={closeMenu}
              data-testid="link-parts-nav-sign-in"
            >
              Team sign in <ArrowRight size={14} />
            </Link>
          </nav>

          <button
            type="button"
            className="parts-landing__menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="parts-landing-navigation"
            aria-expanded={menuOpen}
            data-testid="button-parts-menu"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </header>

        <section className="parts-landing__hero" aria-labelledby="parts-landing-title">
          <div className="parts-landing__hero-copy">
            <p className="parts-landing__eyebrow">
              <span className="parts-landing__eyebrow-dot" aria-hidden="true" />
              Parts & inventory workspace
            </p>
            <h1 id="parts-landing-title">
              Search the shelves.
              <em>Keep the build moving.</em>
            </h1>
            <p className="parts-landing__hero-intro">
              A practical companion for your team: discover a part across configured
              vendors, see what the team owns, and reserve the pieces your robot needs next.
            </p>
            <div className="parts-landing__hero-actions">
              <Link
                href="/auth"
                className="parts-landing__primary-cta"
                data-testid="link-parts-hero-sign-in"
              >
                Open the team workspace <ArrowRight size={16} />
              </Link>
              <a
                href="#demo"
                className="parts-landing__secondary-cta"
                data-testid="link-parts-hero-demo"
              >
                See the bench view <ChevronDown size={16} />
              </a>
            </div>
          </div>

          <div className="parts-landing__hero-figure" id="demo">
            <div className="parts-landing__corner parts-landing__corner--top" aria-hidden="true" />
            <div className="parts-landing__corner parts-landing__corner--bottom" aria-hidden="true" />
            <figure
              className="parts-console"
              aria-labelledby="parts-console-title"
              data-testid="card-parts-console"
            >
              <div className="parts-console__header">
                <div>
                  <p className="parts-console__kicker">TEAM PARTS DESK</p>
                  <h2 id="parts-console-title">Find a part</h2>
                </div>
              </div>

              <div className="parts-console__search">
                <Search size={16} aria-hidden="true" />
                <label htmlFor="parts-demo-search" className="sr-only">
                  Search parts
                </label>
                <input
                  id="parts-demo-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search shaft, motor, SKU..."
                  data-testid="input-parts-demo-search"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="parts-console__clear"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear parts search"
                    data-testid="button-clear-parts-search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <div className="parts-console__filters" aria-label="Vendor filters">
                <Filter size={13} aria-hidden="true" />
                {(["All sources", "REV Robotics", "AndyMark", "McMaster-Carr"] as Vendor[]).map(
                  (source) => (
                    <button
                      type="button"
                      className={`parts-console__filter ${vendor === source ? "is-active" : ""}`}
                      key={source}
                      onClick={() => setVendor(source)}
                      aria-pressed={vendor === source}
                      data-testid={`button-parts-filter-${source.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                    >
                      {source === "All sources" ? "All" : source}
                    </button>
                  ),
                )}
              </div>

              <div className="parts-console__result-meta" aria-live="polite" data-testid="status-parts-results">
                <span>{filteredParts.length} matches</span>
                <span>STATIC VIEW</span>
              </div>

              <div className="parts-console__results">
                {filteredParts.length ? (
                  filteredParts.map((part) => (
                    <article className="parts-result" key={part.id} data-testid={`card-part-result-${part.id}`}>
                      <span className={`parts-result__icon parts-result__icon--${part.tone}`}>
                        <Wrench size={16} aria-hidden="true" />
                      </span>
                      <div className="parts-result__body">
                        <div className="parts-result__name-row">
                          <h3>{part.name}</h3>
                          <span>{part.vendor}</span>
                        </div>
                        <p>{part.detail}</p>
                        <div className="parts-result__meta">
                          <span className="mono">{part.sku}</span>
                          <span>
                            <b>{part.available}</b> available / {part.owned} owned
                          </span>
                        </div>
                      </div>
                      <span className="parts-result__arrow" aria-hidden="true">
                        <ArrowDownRight size={15} />
                      </span>
                    </article>
                  ))
                ) : (
                  <div className="parts-console__empty" data-testid="empty-parts-results">
                    <Search size={18} aria-hidden="true" />
                    <p>No matches. Try a different term or source.</p>
                  </div>
                )}
              </div>

              <div className="parts-console__footer">
                <span>NO CHECKOUT</span>
              </div>
              <figcaption className="sr-only">
                Static parts search with sample vendor listings and team quantities.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="parts-landing__signal-band" aria-label="Parts workspace principles" data-testid="section-parts-signals">
          <div>
            <span className="parts-landing__signal-number">01</span>
            <strong>Discover</strong>
            <p>Search configured sources</p>
          </div>
          <div>
            <span className="parts-landing__signal-number">02</span>
            <strong>Account</strong>
            <p>Know what is on hand</p>
          </div>
          <div>
            <span className="parts-landing__signal-number">03</span>
            <strong>Commit</strong>
            <p>Reserve for the build</p>
          </div>
          <div className="parts-landing__signal-note">
            <Tag size={16} aria-hidden="true" />
            <span>Designed for the handoff between scouting, sourcing, and build.</span>
          </div>
        </section>

        <section id="workflow" className="parts-landing__section" aria-labelledby="workflow-title" data-testid="section-parts-workflow">
          <div className="parts-landing__section-heading">
            <div>
              <p className="parts-landing__section-kicker">01 / The useful loop</p>
              <h2 id="workflow-title">From “where do we get one?” to “it’s set aside.”</h2>
            </div>
            <p>
              Parts work is rarely one clean list. This workspace keeps the vendor trail,
              the real shelf, and the next robot task close enough to act on.
            </p>
          </div>

          <div className="parts-landing__workflow-grid">
            {workflow.map(({ number, icon: Icon, title, text }) => (
              <article className="workflow-card" key={number} data-testid={`card-parts-workflow-${number}`}>
                <div className="workflow-card__top">
                  <span className="workflow-card__icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="workflow-card__number">{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="workflow-card__line" aria-hidden="true" />
              </article>
            ))}
          </div>
        </section>

        <section id="coverage" className="parts-landing__coverage" aria-labelledby="coverage-title" data-testid="section-parts-coverage">
          <div className="parts-landing__coverage-copy">
            <p className="parts-landing__section-kicker">02 / Read the label</p>
            <h2 id="coverage-title">Useful coverage, without pretending the catalog is infinite.</h2>
            <p>
              Search can discover product listings across the vendors your team has
              configured. Complete catalog sync is available only for some sources, and
              vendor coverage varies by setup.
            </p>
            <p>
              Treat vendor results as a starting point for identification and sourcing
              conversations — not as live supplier pricing, current supplier stock,
              checkout, or an exhaustive catalog.
            </p>
            <Link href="/auth" className="parts-landing__text-link" data-testid="link-parts-coverage-sign-in">
              Check your team’s configured sources <ArrowRight size={15} />
            </Link>
          </div>

          <div className="parts-landing__vendor-board" data-testid="card-parts-vendor-board">
            <div className="parts-landing__vendor-board-top">
              <span className="parts-landing__board-label">SOURCE MAP</span>
              <Database size={16} aria-hidden="true" />
            </div>
            <div className="vendor-row">
              <span className="vendor-row__mark vendor-row__mark--am">A</span>
              <div><strong>AndyMark</strong><small>Listing discovery + sync</small></div>
              <span className="vendor-row__status vendor-row__status--sync"><Check size={12} /> SYNC</span>
            </div>
            <div className="vendor-row">
              <span className="vendor-row__mark vendor-row__mark--rev">R</span>
              <div><strong>REV Robotics</strong><small>Listing discovery</small></div>
              <span className="vendor-row__status vendor-row__status--search"><Search size={12} /> SEARCH</span>
            </div>
            <div className="vendor-row">
              <span className="vendor-row__mark vendor-row__mark--mm">M</span>
              <div><strong>McMaster-Carr</strong><small>Listing discovery</small></div>
              <span className="vendor-row__status vendor-row__status--search"><Search size={12} /> SEARCH</span>
            </div>
            <div className="parts-landing__vendor-board-foot">
              <ExternalLink size={13} aria-hidden="true" />
              <span>Source coverage and sync behavior depend on the team configuration.</span>
            </div>
          </div>
        </section>

        <section className="parts-landing__reservation" aria-labelledby="reservation-title" data-testid="section-parts-reservation">
          <div className="reservation-story">
            <p className="parts-landing__section-kicker">03 / Make a claim on the shelf</p>
            <h2 id="reservation-title">A reservation is a promise to the next builder.</h2>
            <p>
              When a drivetrain, intake, or practice bot needs a finite part, mark the
              quantity for that build. The team gets a shared answer before somebody
              walks to the storage bin.
            </p>
            <div className="reservation-story__quote">
              <span aria-hidden="true">“</span>
              <p>Reserve the last two for the climber prototype.</p>
            </div>
          </div>
          <div className="reservation-card" data-testid="card-parts-reservation-preview">
            <div className="reservation-card__header">
              <span><PackageCheck size={16} aria-hidden="true" /> BUILD HOLD</span>
            </div>
            <div className="reservation-card__part">
              <span className="reservation-card__part-icon"><ShoppingCart size={17} aria-hidden="true" /></span>
              <div><strong>NEO 550 Motor</strong><small>REV-21-1651 · 6 owned</small></div>
            </div>
            <div className="reservation-card__meter">
              <div className="reservation-card__meter-label"><span>Reserved for Climber v2</span><strong>4 / 6</strong></div>
              <div className="reservation-card__meter-track"><span /></div>
            </div>
            <div className="reservation-card__rows">
              <div><span>Available after hold</span><strong>2</strong></div>
              <div><span>Requested by</span><strong>Build crew</strong></div>
            </div>
          </div>
        </section>

        <section className="parts-landing__cta" aria-labelledby="parts-cta-title" data-testid="section-parts-cta">
          <div>
            <p className="parts-landing__section-kicker">Your robotics team</p>
            <h2 id="parts-cta-title">Put the right part in the right build.</h2>
            <p>Enter the private team workspace to work with your actual inventory and reservations.</p>
          </div>
          <Link href="/auth" className="parts-landing__primary-cta" data-testid="link-parts-cta-sign-in">
            Team sign in <ArrowRight size={16} />
          </Link>
        </section>

        <footer className="parts-landing__footer">
          <span>Robotics team workspace</span>
        </footer>
      </div>
    </main>
  );
}