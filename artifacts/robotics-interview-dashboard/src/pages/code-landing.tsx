import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  FileCode2,
  FolderGit2,
  GitBranch,
  Menu,
  Rocket,
  SquareTerminal,
  Users,
  X,
} from "lucide-react";
import "./code-landing.css";

const pageMeta = [
  {
    attribute: "name",
    key: "description",
    content:
      "Explore how Wolverines Robotics writes FTC robot code together: BIOBUZZ SDK projects, Java editing, live collaboration, checkpoints, and hub deploys in a private team workspace.",
  },
  {
    attribute: "property",
    key: "og:title",
    content: "Robotics Code Workspace | Wolverines Team 23442",
  },
  {
    attribute: "property",
    key: "og:description",
    content: "FTC projects, collaborative Java editing, checkpoints, and hub deploys.",
  },
  {
    attribute: "name",
    key: "twitter:title",
    content: "Robotics Code Workspace | Wolverines Team 23442",
  },
  {
    attribute: "name",
    key: "twitter:description",
    content: "Collaborative FTC Java editing, checkpoints, and hub deploys.",
  },
] as const;

type DemoFile = {
  id: string;
  path: string;
  language: string;
  lines: { text: string; tokens?: { text: string; kind: string }[] }[];
  problems: string[];
};

const illustrativeFiles: DemoFile[] = [
  {
    id: "teleop",
    path: "TeamCode/BioBuzzTankTeleOp.java",
    language: "Java · Java 8",
    lines: [
      { text: "@TeleOp(name = \"BioBuzz Tank\", group = \"Starter\")" },
      { text: "public class BioBuzzTankTeleOp extends LinearOpMode {" },
      { text: "    private DcMotor leftDrive = null;" },
      { text: "    public void runOpMode() {" },
      { text: "        leftDrive = hardwareMap.get(DcMotor.class, \"left_drive\");" },
      { text: "        waitForStart();" },
      { text: "        while (opModeIsActive()) {" },
      { text: "            leftDrive.setPower(-gamepad1.left_stick_y);" },
      { text: "        }" },
      { text: "    }" },
      { text: "}" },
    ],
    problems: ["0 errors · Java 8 source level"],
  },
  {
    id: "auto",
    path: "TeamCode/BioBuzzAuto.java",
    language: "Java · Java 8",
    lines: [
      { text: "@Autonomous(name = \"BioBuzz Auto\", group = \" Comp\")" },
      { text: "public class BioBuzzAuto extends LinearOpMode {" },
      { text: "    public void runOpMode() {" },
      { text: "        telemetry.addData(\"Status\", \"Initialized\");" },
      { text: "        waitForStart();" },
      { text: "        driveForward(0.5, 1200);" },
      { text: "    }" },
      { text: "}" },
    ],
    problems: ["0 errors · starter template"],
  },
  {
    id: "readme",
    path: "README.md",
    language: "Markdown",
    lines: [
      { text: "# TeamCode" },
      { text: "" },
      { text: "BIOBUZZ SDK v12.0 · JDK 21 toolchain." },
      { text: "Rename the class AND the file together." },
      { text: "Hardware names must match the robot config." },
    ],
    problems: ["No lint for Markdown"],
  },
];

const workflow = [
  {
    number: "01",
    icon: FileCode2,
    title: "Edit real FTC Java",
    text: "Work in TeamCode projects on the BIOBUZZ SDK (v12.0) with Java 8 source-level lint, so starter TeleOp and Autonomous files stay OnBot-compatible.",
  },
  {
    number: "02",
    icon: Users,
    title: "Review together, checkpoint often",
    text: "See who is in the file, leave the code better than you found it, and save named checkpoints. Browser git can clone, pull, and push when the team is ready.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Send it to the robot",
    text: "Build on the hub, download a TeamCode ZIP for safekeeping, or export a single file for OnBot Java. The serial console is there when the cable is.",
  },
];

export default function CodeLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFileId, setActiveFileId] = useState(illustrativeFiles[0].id);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

  const activeFile =
    illustrativeFiles.find((file) => file.id === activeFileId) ?? illustrativeFiles[0];

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
    document.title = "Robotics Code Workspace | Wolverines Team 23442";
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
    <main className="code-landing" data-testid="code-landing">
      <div className="code-landing__shell">
        <header className="code-landing__nav">
          <Link href="/" className="code-landing__brand" onClick={closeMenu} data-testid="link-code-brand">
            <span className="code-landing__brand-mark" aria-hidden="true">
              <CircleDot size={20} strokeWidth={2.4} />
            </span>
            <span className="code-landing__brand-copy">
              <strong>WOLVERINES</strong>
              <small>TEAM 23442 / ROBOTICS</small>
            </span>
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            className="code-landing__menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="code-landing-navigation"
            aria-expanded={menuOpen}
            data-testid="button-code-menu"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          <nav
            id="code-landing-navigation"
            className={`code-landing__nav-links ${menuOpen ? "is-open" : ""}`}
            aria-label="Code landing navigation"
          >
            <a href="#workflow" onClick={closeMenu} data-testid="link-code-workflow">Workflow</a>
            <a href="#collab" onClick={closeMenu} data-testid="link-code-collab">Collaboration</a>
            <a href="#deploy" onClick={closeMenu} data-testid="link-code-deploy">Deploy</a>
            <Link href="/auth" onClick={closeMenu} className="code-landing__nav-cta" data-testid="link-code-nav-sign-in">
              Team sign in <ArrowRight size={14} />
            </Link>
          </nav>
        </header>

        <section className="code-landing__hero" aria-labelledby="code-landing-title">
          <div className="code-landing__hero-copy">
            <p className="code-landing__eyebrow">Code workspace · BIOBUZZ SDK v12.0</p>
            <h1 id="code-landing-title">
              Write the robot&apos;s code, <em>together.</em>
            </h1>
            <p className="code-landing__hero-intro">
              Team 23442&apos;s shared home for FTC Java: TeamCode projects, a focused
              editor with Java 8 lint, live teammates in the file, checkpoints you can
              return to, and a path to the hub when the code is ready.
            </p>
            <div className="code-landing__hero-actions">
              <Link href="/auth" className="code-landing__primary-cta" data-testid="link-code-hero-sign-in">
                Open the team workspace <ArrowRight size={16} />
              </Link>
              <a href="#workflow" className="code-landing__secondary-cta" data-testid="link-code-explore">
                See how it works <ChevronDown size={16} />
              </a>
            </div>
          </div>

          <div className="code-landing__preview-wrap">
            <figure
              className="code-landing__workspace"
              aria-labelledby="code-preview-caption"
              data-testid="card-code-editor-preview"
            >
              <div className="code-landing__workspace-top">
                <div>
                  <p className="code-landing__workspace-kicker">Wolverines / TeamCode</p>
                  <h2>Code workspace</h2>
                </div>
                <span className="code-landing__preview-pill">STATIC VIEW</span>
              </div>

              <div className="code-landing__file-tabs" role="tablist" aria-label="Illustrative files">
                {illustrativeFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    role="tab"
                    aria-selected={activeFile.id === file.id}
                    className={`code-landing__file-tab ${activeFile.id === file.id ? "is-active" : ""}`}
                    onClick={() => setActiveFileId(file.id)}
                    data-testid={`button-code-file-${file.id}`}
                  >
                    <FileCode2 size={12} aria-hidden="true" />
                    {file.path.split("/").pop()}
                  </button>
                ))}
              </div>

              <div className="code-landing__workspace-body">
                <aside className="code-landing__workspace-sidebar" aria-label="Project files">
                  <span className="code-landing__workspace-sidebar-label">TEAMCODE</span>
                  {illustrativeFiles.map((file) => (
                    <span
                      key={file.id}
                      className={`code-landing__tree-item ${activeFile.id === file.id ? "is-active" : ""}`}
                    >
                      <FileCode2 size={11} aria-hidden="true" /> {file.path.split("/").pop()}
                    </span>
                  ))}
                  <span className="code-landing__tree-item">
                    <GitBranch size={11} aria-hidden="true" /> main
                  </span>
                </aside>

                <div className="code-landing__editor" aria-live="polite" data-testid="status-code-editor">
                  <div className="code-landing__editor-head">
                    <strong>{activeFile.path}</strong>
                    <span>{activeFile.language}</span>
                  </div>
                  <pre className="code-landing__editor-lines">
                    {activeFile.lines.map((line, index) => (
                      <span key={`${activeFile.id}-${index}`} className="code-landing__editor-line">
                        <i>{index + 1}</i>
                        {line.text || " "}
                      </span>
                    ))}
                  </pre>
                  <div className="code-landing__editor-foot">
                    <span>
                      <SquareTerminal size={12} aria-hidden="true" /> Problems: {activeFile.problems[0]}
                    </span>
                    <span>2 HERE</span>
                  </div>
                </div>
              </div>

              <div className="code-landing__workspace-foot">
                <span>NO HUB CONNECTION</span>
                <span>ILLUSTRATIVE FILES ONLY</span>
              </div>
              <figcaption id="code-preview-caption" className="sr-only">
                Illustrative FTC Java files with tabs, a project tree, and problem status. Static view only.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="code-landing__signal-band" aria-label="Code workspace principles" data-testid="section-code-signals">
          <div>
            <span className="code-landing__signal-number">01</span>
            <strong>Edit</strong>
            <p>Java 8 lint in the editor</p>
          </div>
          <div>
            <span className="code-landing__signal-number">02</span>
            <strong>Checkpoint</strong>
            <p>Named revisions to return to</p>
          </div>
          <div>
            <span className="code-landing__signal-number">03</span>
            <strong>Deploy</strong>
            <p>Hub builds and TeamCode ZIPs</p>
          </div>
        </section>

        <section id="workflow" className="code-landing__section" aria-labelledby="workflow-title" data-testid="section-code-workflow">
          <div className="code-landing__section-heading">
            <div>
              <p className="code-landing__section-kicker">01 / The useful loop</p>
              <h2 id="workflow-title" tabIndex={-1}>From starter file to running robot.</h2>
            </div>
            <p>
              Robot code work is edit, check, and deliver. This workspace keeps the
              project, the review, and the deploy close enough to keep building.
            </p>
          </div>
          <div className="code-landing__workflow-grid">
            {workflow.map(({ number, icon: Icon, title, text }) => (
              <article className="code-workflow-card" key={number} data-testid={`card-code-workflow-${number}`}>
                <div className="code-workflow-card__top">
                  <span className="code-workflow-card__icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="code-workflow-card__number">{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="collab" className="code-landing__collab" aria-labelledby="collab-title" data-testid="section-code-collab">
          <div className="code-landing__collab-copy">
            <p className="code-landing__section-kicker">02 / Better together</p>
            <h2 id="collab-title" tabIndex={-1}>Two pairs of eyes, one file, no overwrites.</h2>
            <p>
              Presence shows who is in the project, collaborative editing merges keystrokes,
              and the AI assistant can read the open file for context when the team asks
              for help. Browser git keeps a history when the work needs to travel.
            </p>
            <div className="code-landing__checklist">
              <span><Check size={13} aria-hidden="true" /> Live presence and shared cursors</span>
              <span><Check size={13} aria-hidden="true" /> File-aware AI help with insert actions</span>
              <span><Check size={13} aria-hidden="true" /> Clone, pull, and push from the browser</span>
            </div>
          </div>
          <div className="code-landing__collab-card" data-testid="card-code-collab-preview">
            <div className="code-landing__collab-top">
              <span><Users size={15} aria-hidden="true" /> PROGRAMMERS / 2 HERE</span>
              <span className="code-landing__collab-branch"><GitBranch size={12} aria-hidden="true" /> main</span>
            </div>
            <div className="code-landing__collab-row">
              <span className="code-landing__avatar">J</span>
              <div><strong>Drive crew</strong><p>Tuned turn power for the practice bot.</p></div>
            </div>
            <div className="code-landing__collab-row">
              <span className="code-landing__avatar">A</span>
              <div><strong>Auto crew</strong><p><Bot size={12} aria-hidden="true" /> AI suggestion: extract driveForward helper.</p></div>
            </div>
            <div className="code-landing__collab-foot">
              <FolderGit2 size={13} aria-hidden="true" />
              <span>Checkpoint saved · “Tuned turn power”</span>
            </div>
          </div>
        </section>

        <section id="deploy" className="code-landing__deploy" aria-labelledby="deploy-title" data-testid="section-code-deploy">
          <div className="code-landing__deploy-copy">
            <p className="code-landing__section-kicker">03 / To the field</p>
            <h2 id="deploy-title" tabIndex={-1}>Deliver code the way the robot needs it.</h2>
            <p>
              Upload and build on the hub over its address, keep a TeamCode ZIP as the
              team backup, export one file for OnBot Java, or open the serial console
              when only a cable will do.
            </p>
            <p className="code-landing__honest-note">
              Hub builds, serial, and USB need the real robot and a supported browser on
              the team&apos;s network. This page never connects to a hub — it only
              illustrates the workflow.
            </p>
          </div>
          <div className="code-landing__deploy-card" data-testid="card-code-deploy-preview">
            <div className="code-landing__deploy-top">
              <span><Rocket size={15} aria-hidden="true" /> DEPLOY TARGETS</span>
            </div>
            <div className="code-landing__deploy-row"><strong>Hub build</strong><small>Upload + build at the hub address</small></div>
            <div className="code-landing__deploy-row"><strong>TeamCode ZIP</strong><small>Full project backup download</small></div>
            <div className="code-landing__deploy-row"><strong>OnBot export</strong><small>Single-file export for OnBot Java</small></div>
            <div className="code-landing__deploy-row"><strong>Serial console</strong><small>115200 8N1 over USB cable</small></div>
          </div>
        </section>

        <section className="code-landing__cta" aria-labelledby="code-cta-title" data-testid="section-code-cta">
          <div>
            <p className="code-landing__section-kicker">Wolverines / Team 23442</p>
            <h2 id="code-cta-title">Put the next change in the robot.</h2>
            <p>Enter the private team workspace to work with your actual TeamCode projects and checkpoints.</p>
          </div>
          <Link href="/auth" className="code-landing__primary-cta" data-testid="link-code-cta-sign-in">
            Team sign in <ArrowRight size={16} />
          </Link>
        </section>

        <footer className="code-landing__footer">
          <span>Wolverines Robotics · Team 23442</span>
          <span><Link href="/" data-testid="link-code-back-platform">Back to the public platform</Link></span>
        </footer>
      </div>
    </main>
  );
}
