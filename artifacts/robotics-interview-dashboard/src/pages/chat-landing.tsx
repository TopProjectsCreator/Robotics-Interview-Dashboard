import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  AtSign,
  BarChart3,
  Check,
  ChevronDown,
  CircleDot,
  FileCode2,
  FileText,
  FolderKanban,
  Hash,
  Menu,
  MessageCircle,
  PanelTop,
  X,
} from "lucide-react";
import "./chat-landing.css";

const channels = [
  { label: "build-notes", active: true },
  { label: "drive-review", active: false },
  { label: "event-planning", active: false },
];

const teamFeatures = [
  "Focused channels for the work in progress",
  "Mentions that bring the right teammate into context",
  "Decisions that remain easy to find after the meeting",
];

export default function ChatLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

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
    <main className="chat-landing" data-testid="chat-landing">
      <div className="chat-landing__shell">
        <header className="chat-landing__nav">
          <Link href="/" className="chat-landing__brand" onClick={closeMenu} data-testid="link-chat-brand">
            <span className="chat-landing__brand-mark" aria-hidden="true"><CircleDot size={20} strokeWidth={2.4} /></span>
            <span className="chat-landing__brand-copy">
              <strong>WOLVERINES</strong>
              <small>TEAM 23442 / ROBOTICS</small>
            </span>
          </Link>

          <nav
            className={`chat-landing__nav-links ${menuOpen ? "is-open" : ""}`}
            aria-label="Chat landing navigation"
            id="chat-landing-navigation"
          >
            <a href="#conversations" onClick={closeMenu} data-testid="link-chat-conversations">Conversations</a>
            <a href="#context" onClick={closeMenu} data-testid="link-chat-context">Context</a>
            <a href="#tools" onClick={closeMenu} data-testid="link-chat-tools">Connected tools</a>
            <Link href="/auth" onClick={closeMenu} className="chat-landing__nav-cta" data-testid="link-chat-nav-sign-in">
              Team sign in <ArrowRight size={14} />
            </Link>
          </nav>

          <button
            ref={menuButtonRef}
            type="button"
            className="chat-landing__menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="chat-landing-navigation"
            aria-expanded={menuOpen}
            data-testid="button-chat-menu"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </header>

        <section className="chat-landing__hero" aria-labelledby="chat-landing-title">
          <div className="chat-landing__hero-copy">
            <p className="chat-landing__eyebrow">A clearer team channel</p>
            <h1 id="chat-landing-title">Talk through the work, <em>together.</em></h1>
            <p className="chat-landing__hero-intro">
              Wolverines Chat gives Team 23442 a focused place for build conversations, direct questions, and the files that make each decision useful.
            </p>
            <div className="chat-landing__hero-actions">
              <Link href="/auth" className="chat-landing__primary-cta" data-testid="link-chat-hero-sign-in">
                Enter the team workspace <ArrowRight size={16} />
              </Link>
              <a href="#conversations" className="chat-landing__secondary-cta" data-testid="link-chat-explore">
                See how it works <ChevronDown size={16} />
              </a>
            </div>
          </div>

          <div className="chat-landing__preview-wrap">
            <figure className="chat-landing__workspace" aria-labelledby="chat-preview-caption" data-testid="card-chat-workspace-preview">
              <div className="chat-landing__workspace-top">
                <div>
                  <p className="chat-landing__workspace-kicker">Wolverines / Team 23442</p>
                  <h2>Team chat</h2>
                </div>
              </div>

              <div className="chat-landing__workspace-body">
                <aside className="chat-landing__workspace-sidebar" aria-label="Conversation list">
                  <span className="chat-landing__workspace-sidebar-label">CHANNELS</span>
                  <div className="chat-landing__channel-list">
                    {channels.map((channel) => (
                      <span className={`chat-landing__channel ${channel.active ? "is-active" : ""}`} key={channel.label}>
                        <Hash size={12} aria-hidden="true" /> {channel.label}
                      </span>
                    ))}
                  </div>
                  <p className="chat-landing__direct-heading"><span className="chat-landing__direct-dot" /> DIRECT</p>
                  <span className="chat-landing__channel"><MessageCircle size={12} aria-hidden="true" /> One-to-one</span>
                </aside>

                <div className="chat-landing__workspace-conversation">
                  <div className="chat-landing__conversation-head">
                    <strong># build-notes</strong>
                    <span>TEAM CHANNEL</span>
                  </div>
                  <div className="chat-landing__message">
                    <span className="chat-landing__message-avatar">B</span>
                    <div>
                      <div className="chat-landing__message-meta"><strong>Build crew</strong><time>09:42</time></div>
                      <p>Moved the intake layout into a smaller pass. <span className="chat-landing__mention">@design</span> can review the mounting points here.</p>
                      <div className="chat-landing__file-context">
                        <FileCode2 size={15} aria-hidden="true" />
                        <span><strong>intake-layout-v3.step</strong><small>linked design context</small></span>
                      </div>
                    </div>
                  </div>
                  <div className="chat-landing__message">
                    <span className="chat-landing__message-avatar">D</span>
                    <div>
                      <div className="chat-landing__message-meta"><strong>Drive crew</strong><time>09:48</time></div>
                      <p>Noted. I added the open question to our review list so the next test has a clear owner.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="chat-landing__workspace-foot">
                <span>STATIC VIEW</span>
              </div>
              <figcaption id="chat-preview-caption" className="sr-only">
                Team chat with generic channels, sample messages, and a file reference.
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="conversations" className="chat-landing__section" aria-labelledby="conversation-title" data-testid="section-chat-conversations">
          <div className="chat-landing__section-heading">
            <div>
              <p className="chat-landing__section-kicker">01 / Conversation structure</p>
              <h2 id="conversation-title">Make room for the right kind of conversation.</h2>
            </div>
            <p>Keep broad team thinking visible while giving focused questions a quieter lane.</p>
          </div>

          <div className="chat-landing__conversation-grid">
            <article className="chat-landing__feature-panel chat-landing__feature-panel--team" data-testid="card-team-conversations">
              <span className="chat-landing__feature-number">01 / TEAM CONVERSATIONS</span>
              <h3>Build in the open, without losing the thread.</h3>
              <p>Channels give each workstream a shared memory — from the first idea to the test result that changes the plan.</p>
              <div className="chat-landing__feature-list">
                {teamFeatures.map((feature) => <span key={feature}><Check size={13} aria-hidden="true" /> {feature}</span>)}
              </div>
            </article>
            <article className="chat-landing__feature-panel chat-landing__feature-panel--direct" data-testid="card-direct-conversations">
              <span className="chat-landing__feature-number">02 / DIRECT CONVERSATIONS</span>
              <h3>Ask a focused question, then bring it back when it matters.</h3>
              <p>Direct conversations keep a quick handoff or sensitive detail out of the main channel until it is ready to help the team.</p>
              <div className="chat-landing__mini-thread" aria-label="Direct conversation preview">
                <div><i aria-hidden="true" /> One-to-one question</div>
                <div><i aria-hidden="true" /> Clear next step</div>
              </div>
            </article>
          </div>
        </section>

        <section id="context" className="chat-landing__story" aria-labelledby="context-title" data-testid="section-chat-context">
          <div className="chat-landing__story-copy">
            <p className="chat-landing__section-kicker">02 / Context that travels</p>
            <h2 id="context-title">A message is more useful when the work is close by.</h2>
            <p>
              Keep a question beside the drawing, plan, or shared note it refers to. Teammates can understand the why before they act on the what.
            </p>
            <div className="chat-landing__story-points">
              <div className="chat-landing__story-point">
                <span><AtSign size={15} aria-hidden="true" /></span>
                <div><strong>Mentions with a purpose</strong><p>Point a teammate to the exact decision or question that needs their eyes.</p></div>
              </div>
              <div className="chat-landing__story-point">
                <span><FileText size={15} aria-hidden="true" /></span>
                <div><strong>Files with a little memory</strong><p>See why a file was shared, not just its filename, when you return to the thread.</p></div>
              </div>
            </div>
          </div>

          <div className="chat-landing__context-card" aria-label="File context preview" data-testid="card-file-context">
            <div className="chat-landing__context-top">
              <strong>Review thread</strong>
              <span>CONTEXT ATTACHED</span>
            </div>
            <div className="chat-landing__context-columns">
              <div>
                <div className="chat-landing__context-message">
                  <span className="chat-landing__context-avatar">R</span>
                  <div><strong>Review group</strong><p>Can we compare the clearance note with the latest intake layout before the next test?</p></div>
                </div>
                <div className="chat-landing__context-message">
                  <span className="chat-landing__context-avatar">T</span>
                  <div><strong>Test group</strong><p><b>@review-group</b> marked the open measurement for the next pass.</p></div>
                </div>
              </div>
              <div className="chat-landing__model-file">
                <span><FileCode2 size={16} aria-hidden="true" /></span>
                <strong>intake-layout-v3.step</strong>
                <small className="chat-landing__file-meta">design file</small>
              </div>
            </div>
          </div>
        </section>

        <section id="tools" className="chat-landing__tools" aria-labelledby="tools-title" data-testid="section-chat-tools">
          <div className="chat-landing__tools-copy">
            <p className="chat-landing__section-kicker">03 / Nearby tools</p>
            <h2 id="tools-title">Stay close to the tools that move the work forward.</h2>
            <p>Chat is the connective tissue. Open the relevant board, document, or dashboard without leaving the conversation’s orbit.</p>
          </div>
          <div className="chat-landing__tool-stack">
            <article className="chat-landing__tool-card" data-testid="card-linked-tool-board">
              <span className="chat-landing__tool-icon"><FolderKanban size={17} aria-hidden="true" /></span>
              <h3>Work boards</h3>
              <p>Turn a good conversation into a visible next step, with the team’s plan nearby.</p>
            </article>
            <article className="chat-landing__tool-card" data-testid="card-linked-tool-files">
              <span className="chat-landing__tool-icon"><PanelTop size={17} aria-hidden="true" /></span>
              <h3>Shared files</h3>
              <p>Keep design and planning references close to the thread.</p>
            </article>
            <article className="chat-landing__tool-card" data-testid="card-linked-tool-insights">
              <span className="chat-landing__tool-icon"><BarChart3 size={17} aria-hidden="true" /></span>
              <h3>Team insight</h3>
              <p>See useful patterns without turning every update into a meeting.</p>
            </article>
          </div>
        </section>

        <section className="chat-landing__cta" aria-labelledby="chat-cta-title" data-testid="section-chat-cta">
          <div className="chat-landing__cta-content">
            <div>
              <p className="chat-landing__section-kicker">Wolverines / Team 23442</p>
              <h2 id="chat-cta-title">Make the next conversation part of the build.</h2>
              <p>Sign in to the private team workspace to find your channels, direct conversations, linked files, and shared tools.</p>
            </div>
            <Link href="/auth" className="chat-landing__primary-cta" data-testid="link-chat-cta-sign-in">
              Team sign in <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <footer className="chat-landing__footer">
          <span>Wolverines Robotics · Team 23442</span>
          <span><Link href="/" data-testid="link-chat-back-platform">Back to the public platform</Link></span>
        </footer>
      </div>
    </main>
  );
}