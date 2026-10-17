import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Box,
  Boxes,
  Check,
  ChevronDown,
  CircleDot,
  Download,
  FileBox,
  Folder,
  FolderOpen,
  Menu,
  Rotate3d,
  Search,
  Upload,
  X,
} from "lucide-react";
import "./cad-landing.css";

const pageMeta = [
  {
    attribute: "name",
    key: "description",
    content:
      "Explore how robotics teams organize CAD for every robot: bots, folders, 3D model uploads, format-aware previews, and shared design context in a private team workspace.",
  },
  {
    attribute: "property",
    key: "og:title",
    content: "Robotics CAD Workspace",
  },
  {
    attribute: "property",
    key: "og:description",
    content: "Bots, folders, model uploads, and 3D previews for FTC design.",
  },
  {
    attribute: "name",
    key: "twitter:title",
    content: "Robotics CAD Workspace",
  },
  {
    attribute: "name",
    key: "twitter:description",
    content: "Organize bots, folders, and 3D model previews.",
  },
] as const;

type IllustrativeModel = {
  id: string;
  name: string;
  fileName: string;
  format: string;
  hint: string;
  size: string;
  location: string;
  tone: string;
};

const illustrativeModels: IllustrativeModel[] = [
  {
    id: "intake",
    name: "Intake Assembly",
    fileName: "intake-layout-v3.step",
    format: "STEP",
    hint: "Converted in your browser · drag to rotate",
    size: "2.4 MB",
    location: "Climber v2 / Intake",
    tone: "teal",
  },
  {
    id: "drivetrain",
    name: "Drivetrain Frame",
    fileName: "drivetrain-frame.stl",
    format: "STL",
    hint: "Mesh rendered in your browser · drag to rotate",
    size: "8.1 MB",
    location: "Drive Base",
    tone: "yellow",
  },
  {
    id: "claw",
    name: "Claw Gripper",
    fileName: "claw-gripper.glb",
    format: "GLB",
    hint: "Rendered directly · drag to rotate",
    size: "1.2 MB",
    location: "Unfiled",
    tone: "blue",
  },
  {
    id: "hub-mount",
    name: "Hub Mount Plate",
    fileName: "hub-mount.x_t",
    format: "Parasolid",
    hint: "Converted to a private preview on this server",
    size: "640 KB",
    location: "Climber v2",
    tone: "coral",
  },
];

const formatBoard = [
  { format: "GLB", behavior: "Rendered directly" },
  { format: "STL / OBJ / PLY / 3MF", behavior: "Mesh rendered in your browser" },
  { format: "STEP / IGES / BREP", behavior: "Converted in your browser" },
  { format: "Parasolid (X_T / X_B)", behavior: "Converted to a private preview on this server" },
];

const workflow = [
  {
    number: "01",
    icon: Boxes,
    title: "Give every model a home",
    text: "Organize designs under bots with nested folders. Anything without a spot yet waits in Unfiled — never lost in a chat thread.",
  },
  {
    number: "02",
    icon: Upload,
    title: "Drop the file, keep the context",
    text: "Upload from the button or drop onto the grid, a bot, or a folder. Name, notes, size, and uploader travel with the model.",
  },
  {
    number: "03",
    icon: Rotate3d,
    title: "Preview before you cut",
    text: "Open a model for a rotatable 3D preview with its real metadata, then download the original file when the shop is ready.",
  },
];

export default function CadLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFormat, setActiveFormat] = useState("All formats");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

  const formats = useMemo(
    () => ["All formats", ...Array.from(new Set(illustrativeModels.map((m) => m.format)))],
    [],
  );

  const filteredModels = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return illustrativeModels.filter((model) => {
      const matchesFormat = activeFormat === "All formats" || model.format === activeFormat;
      const matchesQuery =
        !query ||
        [model.name, model.fileName, model.location, model.format].some((field) =>
          field.toLowerCase().includes(query),
        );
      return matchesFormat && matchesQuery;
    });
  }, [searchTerm, activeFormat]);

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
    document.title = "Robotics CAD Workspace";
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
    <main className="cad-landing" data-testid="cad-landing">
      <div className="cad-landing__shell">
        <header className="cad-landing__nav">
          <Link href="/" className="cad-landing__brand" onClick={closeMenu} data-testid="link-cad-brand">
            <span className="cad-landing__brand-mark" aria-hidden="true">
              <CircleDot size={20} strokeWidth={2.4} />
            </span>
            <span className="cad-landing__brand-copy">
              <strong>ROBOTICS</strong>
              <small>TEAM WORKSPACE</small>
            </span>
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            className="cad-landing__menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="cad-landing-navigation"
            aria-expanded={menuOpen}
            data-testid="button-cad-menu"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          <nav
            id="cad-landing-navigation"
            className={`cad-landing__nav-links ${menuOpen ? "is-open" : ""}`}
            aria-label="CAD landing navigation"
          >
            <a href="#organize" onClick={closeMenu} data-testid="link-cad-organize">Organize</a>
            <a href="#formats" onClick={closeMenu} data-testid="link-cad-formats">Formats</a>
            <a href="#preview" onClick={closeMenu} data-testid="link-cad-preview">Preview</a>
            <Link href="/auth" onClick={closeMenu} className="cad-landing__nav-cta" data-testid="link-cad-nav-sign-in">
              Team sign in <ArrowRight size={14} />
            </Link>
          </nav>
        </header>

        <section className="cad-landing__hero" aria-labelledby="cad-landing-title">
          <div className="cad-landing__hero-copy">
            <p className="cad-landing__eyebrow">CAD workspace · bots, folders & 3D previews</p>
            <h1 id="cad-landing-title">
              Every model has <em>a home.</em>
            </h1>
            <p className="cad-landing__hero-intro">
              Keep FTC designs out of scattered drives: one library of bots
              and folders, uploads with real context, and a rotatable preview before
              anyone cuts material.
            </p>
            <div className="cad-landing__hero-actions">
              <Link href="/auth" className="cad-landing__primary-cta" data-testid="link-cad-hero-sign-in">
                Open the team workspace <ArrowRight size={16} />
              </Link>
              <a href="#organize" className="cad-landing__secondary-cta" data-testid="link-cad-explore">
                See the library <ChevronDown size={16} />
              </a>
            </div>
          </div>

          <div className="cad-landing__preview-wrap">
            <figure
              className="cad-landing__workspace"
              aria-labelledby="cad-preview-caption"
              data-testid="card-cad-library-preview"
            >
              <div className="cad-landing__workspace-top">
                <div>
                  <p className="cad-landing__workspace-kicker">Team CAD library</p>
                  <h2>Design library</h2>
                </div>
                <span className="cad-landing__preview-pill">STATIC VIEW</span>
              </div>

              <div className="cad-landing__search">
                <Search size={15} aria-hidden="true" />
                <label htmlFor="cad-demo-search" className="sr-only">Search models</label>
                <input
                  id="cad-demo-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search intake, frame, STEP..."
                  data-testid="input-cad-demo-search"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="cad-landing__clear"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear model search"
                    data-testid="button-clear-cad-search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <div className="cad-landing__filters" aria-label="Format filters">
                {formats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    className={`cad-landing__filter ${activeFormat === format ? "is-active" : ""}`}
                    onClick={() => setActiveFormat(format)}
                    aria-pressed={activeFormat === format}
                    data-testid={`button-cad-filter-${format.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  >
                    {format}
                  </button>
                ))}
              </div>

              <div className="cad-landing__result-meta" aria-live="polite" data-testid="status-cad-results">
                <span>{filteredModels.length} matches</span>
                <span>ILLUSTRATIVE MODELS</span>
              </div>

              <div className="cad-landing__workspace-body">
                <aside className="cad-landing__workspace-sidebar" aria-label="Bots and folders">
                  <span className="cad-landing__workspace-sidebar-label">BOTS</span>
                  <span className="cad-landing__tree-item is-active"><FolderOpen size={11} aria-hidden="true" /> Climber v2</span>
                  <span className="cad-landing__tree-nested"><Folder size={11} aria-hidden="true" /> Intake</span>
                  <span className="cad-landing__tree-item"><Box size={11} aria-hidden="true" /> Drive Base</span>
                  <span className="cad-landing__tree-item"><FileBox size={11} aria-hidden="true" /> Unfiled</span>
                </aside>
                <div className="cad-landing__grid">
                  {filteredModels.length ? (
                    filteredModels.map((model) => (
                      <article
                        key={model.id}
                        className="cad-result"
                        data-testid={`card-model-result-${model.id}`}
                      >
                        <span className={`cad-result__icon cad-result__icon--${model.tone}`}>
                          <Box size={15} aria-hidden="true" />
                        </span>
                        <div className="cad-result__body">
                          <div className="cad-result__name-row">
                            <h3>{model.name}</h3>
                            <span>{model.format}</span>
                          </div>
                          <p className="mono">{model.fileName} · {model.size}</p>
                          <p>{model.location}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="cad-landing__empty" data-testid="empty-cad-results">
                      <Search size={18} aria-hidden="true" />
                      <p>No matches. Try a different term or format.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="cad-landing__workspace-foot">
                <span>NO UPLOADS HERE</span>
                <span>DRAG TO ROTATE IN WORKSPACE</span>
              </div>
              <figcaption id="cad-preview-caption" className="sr-only">
                Illustrative CAD library with bots, folders, and sample models. Static view only.
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="organize" className="cad-landing__section" aria-labelledby="organize-title" data-testid="section-cad-workflow">
          <div className="cad-landing__section-heading">
            <div>
              <p className="cad-landing__section-kicker">01 / The useful loop</p>
              <h2 id="organize-title" tabIndex={-1}>From scattered files to a shared library.</h2>
            </div>
            <p>
              Design work moves fast at build time. Bots, nested folders, and Unfiled
              keep every revision findable when the next meeting starts.
            </p>
          </div>
          <div className="cad-landing__workflow-grid">
            {workflow.map(({ number, icon: Icon, title, text }) => (
              <article className="cad-workflow-card" key={number} data-testid={`card-cad-workflow-${number}`}>
                <div className="cad-workflow-card__top">
                  <span className="cad-workflow-card__icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="cad-workflow-card__number">{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="formats" className="cad-landing__formats" aria-labelledby="formats-title" data-testid="section-cad-formats">
          <div className="cad-landing__formats-copy">
            <p className="cad-landing__section-kicker">02 / Read the label</p>
            <h2 id="formats-title" tabIndex={-1}>Know how each file will preview.</h2>
            <p>
              The workspace detects the format from the file extension first, then falls
              back to the content type. Each format previews a little differently — the
              label sets the expectation before you open it.
            </p>
            <p className="cad-landing__honest-note">
              Uploads accept GLB, STL, OBJ, PLY, 3MF, STEP/STP, IGES/IGS, BREP/BRP, and
              X_T/X_B. Large Parasolid files convert on the server; mesh and STEP-family
              files render in the browser.
            </p>
          </div>
          <div className="cad-landing__format-board" data-testid="card-cad-format-board">
            <div className="cad-landing__format-board-top">
              <span>FORMAT MAP</span>
              <Rotate3d size={15} aria-hidden="true" />
            </div>
            {formatBoard.map((row) => (
              <div className="cad-format-row" key={row.format}>
                <strong>{row.format}</strong>
                <span><Check size={12} aria-hidden="true" /> {row.behavior}</span>
              </div>
            ))}
            <div className="cad-landing__format-board-foot">
              <span>Every preview supports drag to rotate.</span>
            </div>
          </div>
        </section>

        <section id="preview" className="cad-landing__preview-section" aria-labelledby="preview-title" data-testid="section-cad-preview">
          <div className="cad-landing__preview-copy">
            <p className="cad-landing__section-kicker">03 / Open it up</p>
            <h2 id="preview-title" tabIndex={-1}>A preview the whole crew can read.</h2>
            <p>
              Click a model for the 3D view plus the facts that matter: file name, size,
              format hint, location, and notes. Move it to the right folder, rename it,
              or download the original when it is time to build.
            </p>
          </div>
          <div className="cad-landing__model-card" data-testid="card-cad-model-preview">
            <div className="cad-landing__model-top">
              <span><Rotate3d size={15} aria-hidden="true" /> MODEL PREVIEW</span>
              <span>STEP</span>
            </div>
            <div className="cad-landing__model-view" aria-hidden="true">
              <Box size={42} strokeWidth={1.2} />
              <span>Drag to rotate in workspace</span>
            </div>
            <div className="cad-landing__model-meta">
              <div><strong>Intake Assembly</strong><small>intake-layout-v3.step · 2.4 MB</small></div>
            </div>
            <div className="cad-landing__model-rows">
              <div><span>Location</span><strong>Climber v2 / Intake</strong></div>
              <div><span>Action</span><strong><Download size={12} aria-hidden="true" /> Original file</strong></div>
            </div>
          </div>
        </section>

        <section className="cad-landing__cta" aria-labelledby="cad-cta-title" data-testid="section-cad-cta">
          <div>
            <p className="cad-landing__section-kicker">Your robotics team</p>
            <h2 id="cad-cta-title">Keep the design where the team can find it.</h2>
            <p>Enter the private team workspace to work with your actual bots, folders, and models.</p>
          </div>
          <Link href="/auth" className="cad-landing__primary-cta" data-testid="link-cad-cta-sign-in">
            Team sign in <ArrowRight size={16} />
          </Link>
        </section>

        <footer className="cad-landing__footer">
          <span>Robotics team workspace</span>
          <span><Link href="/" data-testid="link-cad-back-platform">Back to the public platform</Link></span>
        </footer>
      </div>
    </main>
  );
}
