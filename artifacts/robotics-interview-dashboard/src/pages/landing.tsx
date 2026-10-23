import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, ChevronRight, ClipboardCheck, Menu, Monitor, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const closeMenu = () => setMenuOpen(false);
  const workflow = [
    { number: "01", title: "Check the room in", copy: "One arrival view gives your front desk a clean handoff: who is here, who is next, and what needs attention.", label: "Arrival desk", tone: "yellow" },
    { number: "02", title: "Move the queue", copy: "Advance applicants with one deliberate action. The team sees the same lane, without radio chatter or hallway guesswork.", label: "Interview bay", tone: "teal" },
    { number: "03", title: "Keep the room aligned", copy: "The public display turns the next instruction into a shared source of truth for applicants, families, and volunteers.", label: "Big screen", tone: "mint" },
  ];
  const faqs = [
    { q: "Who is this built for?", a: "Robotics team admins who need a calm, shared operating view while interviews are moving." },
    { q: "Does the public display expose applicant details?", a: "No. The display is intentionally limited to the current instruction and the names or lanes you choose to show." },
    { q: "Can two admins work at once?", a: "Yes. The admin workspace is designed for a front desk and a room lead to stay in step as the queue changes." },
  ];
  return (
    <main className="landing-page noise min-h-[100dvh] overflow-x-clip bg-[#f4f7f4] text-[#182232]" data-testid="landing-page">
      <div className="landing-orbit landing-orbit-one" aria-hidden="true" />
      <div className="landing-orbit landing-orbit-two" aria-hidden="true" />
      <header className="landing-nav-wrap">
        <nav className="landing-nav" aria-label="Primary navigation">
          <Link href="/" onClick={closeMenu} className="landing-brand" data-testid="link-landing-brand">
            <BrandMark />
            <span><b>ROBOTICS</b><small className="mono">TRYOUT CONTROL</small></span>
          </Link>
          <div className={`landing-nav-links ${menuOpen ? "is-open" : ""}`}>
            <a href="#how-it-works" onClick={closeMenu} data-testid="link-how-it-works">How it works</a>
            <a href="#control-room" onClick={closeMenu} data-testid="link-control-room">Control room</a>
            <a href="#questions" onClick={closeMenu} data-testid="link-questions">Questions</a>
            <Link href="/display" target="_blank" onClick={closeMenu} className="landing-nav-display" data-testid="link-public-display"><Monitor size={14} /> Public display</Link>
          </div>
          <Link href="/auth" onClick={closeMenu} className="landing-nav-cta" data-testid="link-coordinator-login">Admin login <ArrowRight size={15} /></Link>
          <button className="landing-menu-button" onClick={() => setMenuOpen(value => !value)} aria-label="Toggle navigation" aria-expanded={menuOpen} data-testid="button-landing-menu"><Menu size={20} /></button>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy fade-up">
          <div className="landing-kicker"><span className="landing-live-dot" /> Live event operations <span className="landing-kicker-rule" /> Built for robotics teams</div>
          <h1>Make the room<br /><em>feel ready.</em></h1>
          <p className="landing-lede">A precise control room for robotics tryouts — from the first arrival to the final interview, every handoff stays visible.</p>
          <div className="landing-actions">
            <Link href="/auth" className="landing-primary-button" data-testid="link-hero-coordinator-login">Open admin workspace <ArrowRight size={17} /></Link>
            <a href="#control-room" className="landing-secondary-button" data-testid="link-see-control-room">See the operating view <ChevronRight size={16} /></a>
          </div>
          <p className="mt-5 inline-flex rounded-full border border-[#cbded7] bg-white/70 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-[#315d62]" data-testid="landing-creator-credit">Created by Team 23442 · Ishaan Bansal</p>
          <div className="landing-hero-note"><ShieldCheck size={15} /><span>Private admin workspace</span><span className="landing-note-separator" /><span>No applicant data on the public display</span></div>
        </div>
        <div className="landing-hero-visual fade-up delay-2" aria-label="Illustration of the live interview control room">
          <div className="landing-visual-label mono"><span className="landing-live-dot" /> EVENT LINK / ACTIVE</div>
          <div className="landing-control-card">
            <div className="landing-control-top">
              <div><p className="mono landing-micro-label">ROBOTICS TEAM</p><h2>Interview queue</h2></div>
              <span className="landing-sync"><span /> Synced now</span>
            </div>
            <div className="landing-queue-summary">
              <div><strong>04</strong><span>in the room</span></div>
              <div><strong>02</strong><span>interviewing</span></div>
              <div><strong>11</strong><span>remaining</span></div>
            </div>
            <div className="landing-queue-head mono"><span>NOW MOVING</span><span>LANE</span></div>
            <div className="landing-queue-row landing-row-active"><span className="landing-avatar landing-avatar-yellow">JM</span><div><b>Jordan M.</b><small>Grade 8 · Build / CAD</small></div><span className="landing-lane">Bay 02</span><Check size={15} /></div>
            <div className="landing-queue-row"><span className="landing-avatar landing-avatar-teal">AR</span><div><b>Alex R.</b><small>Grade 9 · Programming</small></div><span className="landing-lane">Bay 01</span><ChevronRight size={15} /></div>
            <div className="landing-queue-row"><span className="landing-avatar landing-avatar-mint">SK</span><div><b>Sam K.</b><small>Grade 7 · First-year</small></div><span className="landing-lane">Next</span><ChevronRight size={15} /></div>
            <div className="landing-control-footer"><span className="landing-footer-signal"><span /> Room status: steady</span><span className="mono">08:42 LOCAL</span></div>
          </div>
          <div className="landing-display-float">
            <div className="landing-display-bar"><span className="landing-display-dot" /><span className="mono">PUBLIC DISPLAY</span><span className="landing-display-bars">•••</span></div>
            <p>Please come to your<br /><strong>corresponding interviewer</strong></p>
            <small>Your interview team is ready for you.</small>
          </div>
        </div>
      </section>

      <section className="landing-signal-strip" aria-label="Event operating signals">
        <div><span className="mono">07:45</span><p>doors open</p></div><i /><div><span className="mono">1 view</span><p>for every handoff</p></div><i /><div><span className="mono">0 guesswork</span><p>in the hallway</p></div><i /><div><span className="mono">1 team</span><p>built for your team</p></div>
      </section>

      <section id="how-it-works" className="landing-section landing-workflow">
        <div className="landing-section-intro"><p className="landing-eyebrow mono">A calmer tryout day</p><h2>Operations, not ornament.</h2><p>Tryout days have enough variables. This gives the people running them one shared rhythm — clear enough to move quickly, quiet enough to think.</p></div>
        <div className="landing-workflow-list">{workflow.map((item, index) => <article className={`landing-workflow-item landing-tone-${item.tone}`} key={item.number} data-testid={`workflow-step-${index + 1}`}><span className="landing-step-number mono">{item.number}</span><div className="landing-step-line" /><div><span className="landing-step-label mono">{item.label}</span><h3>{item.title}</h3><p>{item.copy}</p></div><ArrowRight size={19} className="landing-step-arrow" /></article>)}</div>
      </section>

      <section id="control-room" className="landing-section landing-room-section">
        <div className="landing-room-heading"><div><p className="landing-eyebrow mono">Inside the control room</p><h2>The room has a pulse.<br /><span>You can see it.</span></h2></div><p>Not another applicant database. A live operating surface for the few decisions that keep a tryout moving.</p></div>
        <div className="landing-room-grid">
          <div className="landing-room-panel landing-room-panel-large">
            <div className="landing-panel-heading"><div><span className="landing-panel-icon"><ClipboardCheck size={17} /></span><div><h3>Attendance, at a glance</h3><p>Know who has arrived before the next name is called.</p></div></div><span className="mono landing-panel-time">08:42</span></div>
            <div className="landing-attendance"><div className="landing-attendance-number">18<span>/24</span></div><div className="landing-progress"><div><span>Applicants checked in</span><b>75%</b></div><i><span /></i><small>6 expected in the next 20 minutes</small></div></div>
            <div className="landing-mini-table"><div className="mono"><span>APPLICANT</span><span>STATUS</span></div><div><span><b className="landing-mini-avatar">JM</b> Jordan M.</span><strong className="landing-status-ready">Ready</strong></div><div><span><b className="landing-mini-avatar">AR</b> Alex R.</span><strong className="landing-status-bay">In bay 01</strong></div><div><span><b className="landing-mini-avatar">SK</b> Sam K.</span><strong className="landing-status-waiting">Waiting</strong></div></div>
          </div>
          <div className="landing-room-panel landing-room-panel-display">
            <div className="landing-panel-heading"><div><span className="landing-panel-icon landing-panel-icon-yellow"><Monitor size={17} /></span><div><h3>Public display</h3><p>One instruction. Everyone aligned.</p></div></div><span className="landing-live-pill"><span />Live</span></div>
            <div className="landing-display-preview"><p className="mono">LIVE INTERVIEW QUEUE</p><strong>Now calling</strong><b>Jordan M.</b><small>Corresponding interviewer · Bay 02</small><div /></div>
          </div>
          <div className="landing-room-panel landing-room-panel-quote">
            <span className="landing-quote-mark">“</span><blockquote>The best event tool is the one people stop talking about because the room simply works.</blockquote><div><span className="landing-quote-avatar">RT</span><span><b>Robotics team</b><small>Tryout operations</small></span></div>
          </div>
        </div>
      </section>

      <section className="landing-image-story">
        <div className="landing-image-collage">
          <div className="landing-image-main flex flex-col justify-between rounded-2xl border border-[#45636a] bg-[#153642] p-6 text-white">
            <div className="flex items-center justify-between"><span className="mono text-[10px] uppercase tracking-[.18em] text-[#9dc7bf]">Team operations</span><span className="h-2 w-2 rounded-full bg-[#51d2ad]" /></div>
            <div><p className="text-3xl font-semibold tracking-[-.04em]">One team.<br />One shared view.</p><div className="mt-5 flex gap-2"><span className="rounded-lg bg-white/10 px-3 py-2 text-xs">Queue</span><span className="rounded-lg bg-white/10 px-3 py-2 text-xs">Chat</span><span className="rounded-lg bg-white/10 px-3 py-2 text-xs">Parts</span></div></div>
          </div>
          <div className="landing-image-small flex items-end rounded-2xl border border-[#c5d9d3] bg-[linear-gradient(145deg,#dceee7,#b8d7d1)] p-4 text-[#153642]"><span className="mono text-[10px] uppercase tracking-[.16em]">Built for your robotics team</span></div>
          <span className="landing-image-caption mono">TEAM WORKSPACE / LIVE</span>
        </div>
        <div className="landing-image-copy"><p className="landing-eyebrow mono">The point is the people</p><h2>More attention<br /><em>where it counts.</em></h2><p>When the queue is legible, admins get their eyes back. On the applicant who needs a second look. On the teammate who needs a hand. On making a good team.</p><div className="landing-proof-list"><div><Check size={16} /><span>Designed around real room handoffs</span></div><div><Check size={16} /><span>Shared state for admins and display</span></div><div><Check size={16} /><span>Focused on the next useful action</span></div></div></div>
      </section>

      <section className="landing-trust-section">
        <div className="landing-trust-intro"><p className="landing-eyebrow mono">Made for event day</p><h2>Quietly capable.<br /><span>Deliberately specific.</span></h2></div>
        <div className="landing-trust-items"><div><strong>01</strong><p>One event view</p><span>No hunting across tabs when the room gets busy.</span></div><div><strong>02</strong><p>Clear public signal</p><span>Applicants know where to go without asking twice.</span></div><div><strong>03</strong><p>Human decisions first</p><span>Tools support your judgment; they do not replace it.</span></div></div>
      </section>

      <section id="questions" className="landing-section landing-faq-section">
        <div className="landing-section-intro"><p className="landing-eyebrow mono">Useful before doors open</p><h2>Good questions<br />make good systems.</h2></div>
        <div className="landing-faq-list">{faqs.map((faq, index) => <div className={`landing-faq ${activeFaq === index ? "is-active" : ""}`} key={faq.q}><button onClick={() => setActiveFaq(activeFaq === index ? null : index)} aria-expanded={activeFaq === index} data-testid={`button-faq-${index + 1}`}><span className="mono">0{index + 1}</span><b>{faq.q}</b><span className="landing-faq-plus">{activeFaq === index ? "−" : "+"}</span></button>{activeFaq === index && <p>{faq.a}</p>}</div>)}</div>
      </section>

      <section className="landing-final-cta">
        <div><p className="landing-eyebrow mono">Before the first applicant arrives</p><h2>Put the room<br /><em>on the same page.</em></h2></div>
        <div className="landing-final-actions"><p>Open the admin workspace or preview the public display. The operating view is ready when you are.</p><Link href="/auth" className="landing-primary-button" data-testid="link-final-coordinator-login">Enter admin workspace <ArrowRight size={17} /></Link><Link href="/display" target="_blank" className="landing-final-display-link" data-testid="link-final-public-display"><Monitor size={15} /> Preview public display</Link></div>
      </section>

      <footer className="landing-footer"><div className="landing-brand landing-footer-brand"><BrandMark /><span><b>ROBOTICS</b><small className="mono">TRYOUT CONTROL</small></span></div><div className="flex gap-4"><a href="/privacy" className="mono landing-footer-meta underline-offset-4 hover:underline">Privacy</a><a href="/terms" className="mono landing-footer-meta underline-offset-4 hover:underline">Terms</a></div><div className="mono landing-footer-meta">ROBOTICS TEAM OPERATIONS</div><span className="mono landing-footer-status"><span /> SYSTEM READY</span></footer>
    </main>
  );
}