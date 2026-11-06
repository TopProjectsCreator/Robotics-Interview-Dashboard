import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, ArrowRight, Boxes, Check, ChevronDown, Code2, Cpu, FileCode2,
  LayoutDashboard, MessageSquare, Package, Search, ShieldCheck, Sparkles,
  Wrench, CircleDot, CalendarDays, GitBranch, Eye,
} from "lucide-react";
import type { CustomWorkspace } from "@workspace/api-client-react";

export type DemoView =
  | "overview"
  | "chat"
  | "parts"
  | "code"
  | "cad"
  | "custom-build-tracker"
  | "custom-field-test-log";

export type DemoCustomWorkspace = Pick<
  CustomWorkspace,
  "id" | "title" | "description" | "status" | "iconDataUrl" | "tabs" | "html" | "capabilities"
> & { html: string };

export const DEMO_CUSTOM_WORKSPACES: DemoCustomWorkspace[] = [
  {
    id: "build-tracker",
    title: "Build Tracker",
    description: "Track robot milestones, owners, and next steps for build season.",
    status: "published",
    iconDataUrl: "/demo-build-tracker.svg",
    tabs: [],
    capabilities: [],
    html: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><main class="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div><p class="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">Custom workspace · sample app</p><h1 class="mt-2 text-3xl font-semibold tracking-tight">Build Tracker</h1><p class="mt-2 max-w-2xl text-sm text-muted-foreground">A fictional snapshot of this season’s robot milestones and build tasks.</p></div>
    <span class="rounded-full border px-3 py-1.5 text-xs font-semibold">Sample data · read-only</span>
  </header>
  <section class="grid gap-4 sm:grid-cols-3">
    <article class="rounded-2xl border bg-card p-5"><p class="text-sm text-muted-foreground">Milestones</p><p class="mt-2 text-3xl font-semibold">8</p><p class="mt-1 text-xs text-muted-foreground">3 complete · 3 active · 2 upcoming</p></article>
    <article class="rounded-2xl border bg-card p-5"><p class="text-sm text-muted-foreground">Next event</p><p class="mt-2 text-xl font-semibold">Scrimmage 01</p><p class="mt-1 text-xs text-muted-foreground">Saturday · sample schedule</p></article>
    <article class="rounded-2xl border bg-card p-5"><p class="text-sm text-muted-foreground">Robot status</p><p class="mt-2 text-xl font-semibold">Integration</p><p class="mt-1 text-xs text-muted-foreground">Drivebase and intake in progress</p></article>
  </section>
  <section class="overflow-hidden rounded-2xl border bg-card">
    <div class="border-b p-5"><p class="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">This week</p><h2 class="mt-1 text-lg font-semibold">Build milestones</h2></div>
    <div class="divide-y">
      <article class="flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 class="font-medium">Finish intake roller test</h3><p class="mt-1 text-sm text-muted-foreground">Maya Chen · Subsystem fit</p></div><span class="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">In progress</span></article>
      <article class="flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 class="font-medium">Run autonomous path on field tiles</h3><p class="mt-1 text-sm text-muted-foreground">Sam Rivera · Robot software</p></div><span class="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">Needs review</span></article>
      <article class="flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 class="font-medium">Label spare parts bins</h3><p class="mt-1 text-sm text-muted-foreground">Nora Patel · Shop organization</p></div><span class="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">Complete</span></article>
    </div>
  </section>
</main></body></html>`,
  },
  {
    id: "field-test-log",
    title: "Field Test Log",
    description: "Keep drive, mechanism, and autonomous test notes together.",
    status: "published",
    iconDataUrl: "/demo-field-test-log.svg",
    tabs: [],
    capabilities: [],
    html: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><main class="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div><p class="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">Custom workspace · sample app</p><h1 class="mt-2 text-3xl font-semibold tracking-tight">Field Test Log</h1><p class="mt-2 max-w-2xl text-sm text-muted-foreground">Fictional test runs that connect changes to repeatable results.</p></div>
    <span class="rounded-full border px-3 py-1.5 text-xs font-semibold">Sample data · read-only</span>
  </header>
  <section class="grid gap-4 sm:grid-cols-3">
    <article class="rounded-2xl border bg-card p-5"><p class="text-sm text-muted-foreground">Runs this week</p><p class="mt-2 text-3xl font-semibold">12</p></article>
    <article class="rounded-2xl border bg-card p-5"><p class="text-sm text-muted-foreground">Latest result</p><p class="mt-2 text-xl font-semibold">Autonomous path · pass</p></article>
    <article class="rounded-2xl border bg-card p-5"><p class="text-sm text-muted-foreground">Open follow-up</p><p class="mt-2 text-xl font-semibold">2 notes</p></article>
  </section>
  <section class="overflow-hidden rounded-2xl border bg-card">
    <div class="border-b p-5"><p class="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Recent sample runs</p><h2 class="mt-1 text-lg font-semibold">Test history</h2></div>
    <div class="overflow-x-auto"><table class="w-full min-w-[620px] text-left text-sm"><thead class="bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-5 py-3 font-medium">Run</th><th class="px-5 py-3 font-medium">Area</th><th class="px-5 py-3 font-medium">Result</th><th class="px-5 py-3 font-medium">Owner</th><th class="px-5 py-3 font-medium">Date</th></tr></thead><tbody class="divide-y">
      <tr><td class="px-5 py-4 font-medium">Autonomous path A</td><td class="px-5 py-4">Robot software</td><td class="px-5 py-4">Pass</td><td class="px-5 py-4">Sam Rivera</td><td class="px-5 py-4">Nov 5</td></tr>
      <tr><td class="px-5 py-4 font-medium">Intake transfer</td><td class="px-5 py-4">Mechanism</td><td class="px-5 py-4">Needs adjustment</td><td class="px-5 py-4">Maya Chen</td><td class="px-5 py-4">Nov 4</td></tr>
      <tr><td class="px-5 py-4 font-medium">Drivebase straight-line</td><td class="px-5 py-4">Drive</td><td class="px-5 py-4">Pass</td><td class="px-5 py-4">Leo Park</td><td class="px-5 py-4">Nov 3</td></tr>
    </tbody></table></div>
  </section>
</main></body></html>`,
  },
];

type WorkspaceView = "overview" | "chat" | "plan" | "parts" | "code" | "cad";

const tasks = [
  { id: "drivebase", title: "Re-square the west-side drive rail", owner: "Maya Chen", initials: "MC", status: "In progress", due: "Today", tone: "gold" },
  { id: "intake", title: "Tune intake roller spacing", owner: "Leo Park", initials: "LP", status: "Needs review", due: "Mon, Nov 9", tone: "teal" },
  { id: "auton", title: "Add park routine to autonomous", owner: "Sam Rivera", initials: "SR", status: "In progress", due: "Tue, Nov 10", tone: "gold" },
  { id: "pit-kit", title: "Pack spare belt and fastener kit", owner: "Nora Patel", initials: "NP", status: "Done", due: "Nov 5", tone: "green" },
  { id: "camera", title: "Confirm camera mount clearance", owner: "Maya Chen", initials: "MC", status: "Needs review", due: "Wed, Nov 11", tone: "teal" },
];

const messages = [
  { author: "Maya Chen", initials: "MC", color: "teal", time: "3:42 PM", text: "West rail is square again. I left the intake plate loose so we can check roller spacing before tightening everything down." },
  { author: "Leo Park", initials: "LP", color: "ochre", time: "3:36 PM", text: "Nice. Current gap is 18 mm at the center and 20 mm at the edges. I can shim the right bracket after the next fit check." },
  { author: "Sam Rivera", initials: "SR", color: "plum", time: "3:21 PM", text: "Auton branch has the new park routine. It runs clean in the short test; still want one full-field run before we call it done." },
  { author: "Nora Patel", initials: "NP", color: "blue", time: "3:08 PM", text: "Spare kit is packed and labeled in the gray drawer. Added two 3 mm spacers because we keep borrowing them." },
];

const buildLogMessages = [
  { author: "Nora Patel", initials: "NP", color: "blue", time: "2:14 PM", text: "Pit checklist is updated. The spare battery is on charge, and the driver station cable is back in the labeled case." },
  { author: "Sam Rivera", initials: "SR", color: "plum", time: "1:58 PM", text: "The short autonomous run passed. I added the test notes beside the park routine so we can compare it after the next change." },
  { author: "Maya Chen", initials: "MC", color: "teal", time: "1:41 PM", text: "CAD revision C is ready to review. The front crossbar clearance is marked in the design notes." },
];

const inventory = [
  { id: "goBilda-1175", name: "5202 Series Yellow Jacket motor", category: "Motion", qty: 6, status: "In stock", note: "2 assigned to drivebase" },
  { id: "rev-hex", name: "REV 5 mm hex shaft, 180 mm", category: "Hardware", qty: 3, status: "Low stock", note: "One full robot set recommended" },
  { id: "belt-144", name: "HTD 3 mm belt · 144 mm", category: "Motion", qty: 8, status: "In stock", note: "Drawer B / labeled bin" },
  { id: "spacer-3", name: "Aluminum spacer · 3 mm", category: "Hardware", qty: 12, status: "In stock", note: "Added to pit kit" },
  { id: "servo-25", name: "25 kg waterproof servo", category: "Electronics", qty: 1, status: "Low stock", note: "Reserved for intake" },
];

const navItems: { id: WorkspaceView; label: string; icon: typeof LayoutDashboard; count?: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "chat", label: "Team chat", icon: MessageSquare, count: "4" },
  { id: "plan", label: "Planning board", icon: Check, count: "5" },
  { id: "parts", label: "Parts room", icon: Boxes },
  { id: "code", label: "Code", icon: Code2 },
  { id: "cad", label: "CAD", icon: Cpu },
];

const viewTitles: Record<WorkspaceView, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "WORKSPACE / OVERVIEW", title: "Build night, in progress.", description: "A working snapshot from a team's current shop session." },
  chat: { eyebrow: "WORKSPACE / TEAM CHAT", title: "Shop floor", description: "The conversation around tonight's build." },
  plan: { eyebrow: "WORKSPACE / PLANNING BOARD", title: "This week at a glance.", description: "Small next steps, owned by the people doing the work." },
  parts: { eyebrow: "WORKSPACE / PARTS ROOM", title: "The bins that keep us moving.", description: "A little inventory context, before anyone orders another shaft." },
  code: { eyebrow: "WORKSPACE / CODE", title: "Autonomous, one routine at a time.", description: "A read-only peek at the team's current robot code." },
  cad: { eyebrow: "WORKSPACE / CAD", title: "Intake assembly · rev C.", description: "A design review note, connected to the build conversation." },
};

export function DemoBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfb84d]/40 bg-[#f1ca5b]/15 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[.12em] text-[#896514] dark:border-[#dfb84d]/30 dark:bg-[#dfb84d]/10 dark:text-[#f1cf6f]"><Eye size={11} /> Fictional demo · read-only</span>;
}

function Avatar({ initials, color = "teal", size = "md" }: { initials: string; color?: string; size?: "sm" | "md" }) {
  const palette: Record<string, string> = {
    teal: "bg-[#d8eeea] text-[#166c69] dark:bg-[#20464a] dark:text-[#9ce0d4]",
    ochre: "bg-[#f4e7c5] text-[#806218] dark:bg-[#493d24] dark:text-[#f0cf75]",
    plum: "bg-[#e8e0ee] text-[#674c7d] dark:bg-[#40324d] dark:text-[#cdb6e2]",
    blue: "bg-[#dce8ef] text-[#3f6578] dark:bg-[#29414c] dark:text-[#a8ccdc]",
  };
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-lg font-mono font-bold ${size === "sm" ? "size-7 text-[9px]" : "size-9 text-[10px]"} ${palette[color] || palette.teal}`}>{initials}</span>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3"><div><p className="font-mono text-[9px] font-semibold uppercase tracking-[.15em] text-[#168b94] dark:text-[#7edbd0]">{eyebrow}</p><h2 className="mt-1 text-[19px] font-semibold tracking-[-.045em] text-[#153642] dark:text-[#e3efeb]">{title}</h2></div>{action}</div>;
}

function StatusPill({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "gold" | "green" | "muted" }) {
  const styles = {
    teal: "bg-[#dff1ec] text-[#16766f] dark:bg-[#17443f] dark:text-[#8cdbce]",
    gold: "bg-[#fff0c6] text-[#87620b] dark:bg-[#4b3c1c] dark:text-[#f1cc67]",
    green: "bg-[#e3f0e4] text-[#40734c] dark:bg-[#253f30] dark:text-[#a5d6aa]",
    muted: "bg-[#edf1ef] text-[#64797b] dark:bg-[#26383a] dark:text-[#b2c5c1]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[tone]}`}>{children}</span>;
}

function TaskList({ compact = false }: { compact?: boolean }) {
  const [filter, setFilter] = useState("All");
  const filtered = tasks.filter((task) => filter === "All" || task.status === filter);
  return <section aria-label="Team tasks" data-testid="section-demo-tasks">
    <SectionHeading eyebrow="Planning board" title="Next up" action={<button type="button" onClick={() => setFilter(filter === "All" ? "In progress" : "All")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#d5e2de] bg-[hsl(var(--card))] px-3 text-[10px] font-semibold text-[#526c70] transition hover:border-[#168b94] hover:text-[#167f88] dark:border-[#315057] dark:text-[#b6ceca]" data-testid="button-task-filter" aria-label={`Filter tasks, currently ${filter}`}>{filter === "All" ? "All tasks" : "In progress"} <ChevronDown size={13} /></button>} />
    <div className={`overflow-hidden rounded-xl border border-[#d9e6e1] bg-[hsl(var(--card))] dark:border-[#28464d] ${compact ? "" : "divide-y divide-[#e8efeb] dark:divide-[#28464d]"}`}>
      {filtered.map((task) => <article key={task.id} data-testid={`task-${task.id}`} className={`flex items-center gap-3 px-4 py-3.5 ${compact ? "border-b border-[#e8efeb] last:border-0 dark:border-[#28464d]" : ""}`}>
        <span className={`grid size-7 shrink-0 place-items-center rounded-full ${task.status === "Done" ? "bg-[#e3f0e4] text-[#54845d] dark:bg-[#253f30] dark:text-[#a5d6aa]" : "bg-[#edf4f1] text-[#8aa09b] dark:bg-[#1b3439] dark:text-[#90aaa6]"}`}>{task.status === "Done" ? <Check size={13} /> : <CircleDot size={13} />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-[#274650] dark:text-[#e3efeb]">{task.title}</p><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#71878a] dark:text-[#a1b7b5]"><span className="inline-flex items-center gap-1"><CalendarDays size={11} />{task.due}</span><span aria-hidden="true">·</span>{task.owner}</p></div>
        {!compact && <StatusPill tone={task.tone as "gold" | "teal" | "green"}>{task.status}</StatusPill>}
      </article>)}
      {filtered.length === 0 && <p className="p-5 text-sm text-muted-foreground">No tasks in this view.</p>}
    </div>
  </section>;
}

function ChatPanel({ compact = false }: { compact?: boolean }) {
  const [channel, setChannel] = useState("shop-floor");
  const visibleMessages = channel === "shop-floor" ? messages : buildLogMessages;
  return <section aria-label="Team chat" data-testid="section-demo-chat">
    <SectionHeading eyebrow="Team chat / #shop-floor" title="From the shop" action={<button type="button" onClick={() => setChannel(channel === "shop-floor" ? "build-log" : "shop-floor")} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d5e2de] bg-[hsl(var(--card))] px-3 text-[10px] font-semibold text-[#526c70] hover:border-[#168b94] dark:border-[#315057] dark:text-[#b6ceca]" data-testid="button-chat-channel"><span className="text-[#168b94]">#</span>{channel}<ChevronDown size={13} /></button>} />
    <div className={`rounded-xl border border-[#d9e6e1] bg-[hsl(var(--card))] p-4 dark:border-[#28464d] ${compact ? "space-y-4" : "space-y-5"}`}>
      {visibleMessages.slice(0, compact ? 3 : 4).map((message) => <article key={`${channel}-${message.initials}`} className="flex gap-3" data-testid={`message-${message.initials.toLowerCase()}`}>
        <Avatar initials={message.initials} color={message.color} size="sm" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2"><h3 className="text-[11px] font-bold text-[#274650] dark:text-[#e3efeb]">{message.author}</h3><time className="font-mono text-[9px] text-[#819497] dark:text-[#8fa8a9]">{message.time}</time></div><p className="mt-1 text-[11px] leading-[1.65] text-[#526c70] dark:text-[#b6ceca]">{message.text}</p></div>
      </article>)}
      <div className="flex items-center gap-2 border-t border-[#e8efeb] pt-3 font-mono text-[9px] uppercase tracking-[.1em] text-[#829799] dark:border-[#28464d] dark:text-[#8fa8a9]"><ShieldCheck size={12} className="text-[#168b94] dark:text-[#7edbd0]" /> Archived sample conversation</div>
    </div>
  </section>;
}

function PartsPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const results = useMemo(() => inventory.filter((part) => (category === "All" || part.category === category) && part.name.toLowerCase().includes(query.toLowerCase())), [category, query]);
  return <section data-testid="section-demo-parts">
    <SectionHeading eyebrow="Parts room / inventory" title="Stock on the shelf" />
    <div className="mb-3 flex flex-col gap-2 sm:flex-row">
      <label className="relative flex-1"><span className="sr-only">Search parts</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829799]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a part…" className="min-h-10 w-full rounded-lg border border-[#d5e2de] bg-[hsl(var(--card))] pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-[#91a2a2] focus:border-[#168b94] focus:ring-2 focus:ring-[#168b94]/15 dark:border-[#315057]" data-testid="input-parts-search" /></label>
      <select aria-label="Filter parts by category" value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-10 rounded-lg border border-[#d5e2de] bg-[hsl(var(--card))] px-3 text-xs text-foreground outline-none focus:border-[#168b94] dark:border-[#315057]" data-testid="select-parts-category"><option>All</option><option>Motion</option><option>Hardware</option><option>Electronics</option></select>
    </div>
    <div className="overflow-hidden rounded-xl border border-[#d9e6e1] bg-[hsl(var(--card))] dark:border-[#28464d]">
      <div className="hidden grid-cols-[1fr_90px_88px] gap-3 border-b border-[#e8efeb] bg-[#f2f6f3] px-4 py-2 font-mono text-[9px] uppercase tracking-[.12em] text-[#829799] dark:border-[#28464d] dark:bg-[#152d34] sm:grid"><span>Part / category</span><span>Quantity</span><span>Status</span></div>
      {results.map((part) => <article key={part.id} className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-[#e8efeb] px-4 py-3 last:border-0 dark:border-[#28464d] sm:grid-cols-[1fr_90px_88px] sm:gap-3" data-testid={`part-${part.id}`}>
        <div className="min-w-0"><h3 className="truncate text-[11px] font-semibold text-[#274650] dark:text-[#e3efeb]">{part.name}</h3><p className="mt-1 text-[10px] text-[#829799] dark:text-[#9bb0ae]">{part.category} · {part.note}</p></div>
        <span className="font-mono text-xs text-[#426168] dark:text-[#c5d6d2]">{part.qty} <span className="font-sans text-[9px] text-[#829799]">units</span></span>
        <StatusPill tone={part.status === "Low stock" ? "gold" : "green"}>{part.status}</StatusPill>
      </article>)}
      {results.length === 0 && <div className="px-5 py-8 text-center"><Package size={20} className="mx-auto text-[#8aa09b]" /><p className="mt-2 text-xs text-muted-foreground">No parts match that search.</p></div>}
    </div>
  </section>;
}

function CodePanel() {
  const [file, setFile] = useState("DriveTeleOp.java");
  const snippets: Record<string, string[]> = {
    "DriveTeleOp.java": ["@Override", "public void loop() {", "  double forward = -gamepad1.left_stick_y;", "  double turn = gamepad1.right_stick_x;", "", "  leftFront.setPower(forward + turn);", "  rightFront.setPower(forward - turn);", "  leftRear.setPower(forward + turn);", "  rightRear.setPower(forward - turn);", "", "  intake.setPower(gamepad1.right_trigger);", "}"],
    "ParkRoutine.java": ["public void parkFromObservationZone() {", "  drive.setTargetPosition(420);", "  drive.setMode(RUN_TO_POSITION);", "  drive.setPower(0.32);", "", "  while (opModeIsActive() && drive.isBusy()) {", "    telemetry.addData(\"Park\", \"moving\");", "    telemetry.update();", "  }", "  drive.setPower(0);", "}"],
    "RobotConfig.java": ["public final class RobotConfig {", "  public static final double DRIVE_SPEED = 0.72;", "  public static final double TURN_SPEED = 0.48;", "  public static final int INTAKE_LIMIT = 1800;", "", "  private RobotConfig() { }", "}"],
  };
  return <section data-testid="section-demo-code"><SectionHeading eyebrow="Code workspace / Java" title="A quick look at the robot code" />
    <div className="overflow-hidden rounded-xl border border-[#294b55] bg-[#153642] text-[#eaf5f0] shadow-[0_14px_35px_rgba(21,54,66,.12)] dark:border-[#31545c]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2"><FileCode2 size={15} className="text-[#7edbd0]" /><span className="font-mono text-[10px] text-[#d5e7e1]">Demo Robotics / robot-controller</span></div><span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-[#9dc7bf]"><GitBranch size={11} /> build-night</span></div>
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 pt-2">{Object.keys(snippets).map((name) => <button type="button" key={name} onClick={() => setFile(name)} className={`shrink-0 rounded-t-md px-3 py-2 font-mono text-[9px] transition ${file === name ? "bg-[#234b55] text-[#eff8f4]" : "text-[#91b4b1] hover:bg-white/5 hover:text-white"}`} data-testid={`button-code-file-${name}`}>{name}</button>)}</div>
      <pre className="overflow-x-auto p-4 text-[10px] leading-[1.9] text-[#bcd4ce]"><code>{snippets[file].map((line, index) => <span key={index} className="block whitespace-pre"><span className="mr-4 inline-block w-4 select-none text-right text-[#62848a]">{index + 1}</span><span className={line.includes("public") || line.includes("@Override") ? "text-[#efc34f]" : line.includes("gamepad") ? "text-[#8bd2e0]" : ""}>{line || " "}</span></span>)}</code></pre>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[9px] text-[#9dc7bf]"><span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Sample code · not connected to a repository</span><span className="font-mono">Java · FTC SDK</span></div>
    </div>
  </section>;
}

function CadPanel() {
  const [showNotes, setShowNotes] = useState(true);
  return <section data-testid="section-demo-cad"><SectionHeading eyebrow="CAD workspace / robot v3" title="Intake assembly · rev C" action={<button type="button" onClick={() => setShowNotes(!showNotes)} aria-expanded={showNotes} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d5e2de] bg-[hsl(var(--card))] px-3 text-[10px] font-semibold text-[#526c70] hover:border-[#168b94] dark:border-[#315057] dark:text-[#b6ceca]" data-testid="button-cad-notes"><Wrench size={13} />{showNotes ? "Hide notes" : "Show notes"}</button>} />
    <div className="overflow-hidden rounded-xl border border-[#d9e6e1] bg-[hsl(var(--card))] dark:border-[#28464d]">
      <div className="relative grid min-h-[245px] place-items-center overflow-hidden bg-[#eaf2ef] dark:bg-[#132a31]">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(22,139,148,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(22,139,148,.12)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div aria-hidden="true" className="relative flex h-[155px] w-[min(320px,80%)] items-center justify-center">
          <div className="absolute left-[12%] top-[16%] h-[68%] w-[76%] rotate-[-7deg] rounded-[22px] border-[7px] border-[#517b7d] bg-[#b5d1c8]/70 shadow-[8px_12px_0_rgba(33,78,81,.14)] dark:border-[#5b8886] dark:bg-[#26484a]" />
          <div className="absolute left-[22%] top-[29%] h-[45%] w-[57%] rotate-[6deg] rounded-[12px] border-[5px] border-[#c89635] bg-[#f0cc6b]/65 dark:border-[#c39c4b] dark:bg-[#624f2c]" />
          <div className="absolute left-[42%] top-[21%] h-[58%] w-5 rotate-[8deg] rounded-full border-2 border-[#34636a] bg-[#d9eae3] dark:bg-[#8db6ac]" />
          <div className="absolute left-[27%] top-[40%] h-3 w-[50%] rotate-[-8deg] rounded-full bg-[#6a9390] dark:bg-[#83b0a7]" />
          <span className="absolute left-[7%] top-0 font-mono text-[9px] uppercase tracking-[.12em] text-[#557477] dark:text-[#91b8b2]">Intake / 3D preview</span>
          <span className="absolute bottom-0 right-[3%] font-mono text-[9px] text-[#557477] dark:text-[#91b8b2]">REV C · 1:1</span>
        </div>
        <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md border border-[#d0dfd9] bg-[hsl(var(--card))]/90 px-2.5 py-1.5 font-mono text-[9px] text-[#567174] dark:border-[#35515a] dark:text-[#a8c0bc]"><Cpu size={12} /> Fictional model preview</div>
      </div>
      {showNotes && <div className="grid gap-4 border-t border-[#e5ede9] p-4 dark:border-[#28464d] sm:grid-cols-[1fr_auto] sm:items-start"><div><p className="font-mono text-[9px] uppercase tracking-[.13em] text-[#168b94] dark:text-[#7edbd0]">Design review · Feb 11</p><p className="mt-1.5 max-w-xl text-[11px] leading-5 text-[#526c70] dark:text-[#b6ceca]">The 2 mm spacer clears the front crossbar in the latest mock-up. Keep the plate slot open until the roller gap is checked on the real chassis.</p></div><div className="text-[10px] text-[#829799] dark:text-[#9bb0ae]"><span className="block font-semibold text-[#426168] dark:text-[#c5d6d2]">Model owner</span><span className="mt-1 block">Maya Chen</span></div></div>}
    </div>
  </section>;
}

export default function RoboticsDemoPage() {
  const [view, setView] = useState<WorkspaceView>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const active = viewTitles[view];
  const setActiveView = (next: WorkspaceView) => { setView(next); setMobileNavOpen(false); };
  useEffect(() => {
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const openGraphTitleMeta = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const openGraphDescriptionMeta = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const twitterTitleMeta = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    const twitterDescriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    const previousTitle = document.title;
    const previousDescription = descriptionMeta?.content;
    const previousOpenGraphTitle = openGraphTitleMeta?.content;
    const previousOpenGraphDescription = openGraphDescriptionMeta?.content;
    const previousTwitterTitle = twitterTitleMeta?.content;
    const previousTwitterDescription = twitterDescriptionMeta?.content;
    const description = "Explore a fictional, read-only robotics workspace. See teams connect chat, planning, CAD, code, and parts in one place—no sign-in or live team data needed.";
    const title = "Live demo · Robotics Team Workspace";
    document.title = title;
    if (descriptionMeta) descriptionMeta.content = description;
    if (openGraphTitleMeta) openGraphTitleMeta.content = title;
    if (openGraphDescriptionMeta) openGraphDescriptionMeta.content = description;
    if (twitterTitleMeta) twitterTitleMeta.content = title;
    if (twitterDescriptionMeta) twitterDescriptionMeta.content = description;
    return () => {
      document.title = previousTitle;
      if (descriptionMeta && previousDescription !== undefined) descriptionMeta.content = previousDescription;
      if (openGraphTitleMeta && previousOpenGraphTitle !== undefined) openGraphTitleMeta.content = previousOpenGraphTitle;
      if (openGraphDescriptionMeta && previousOpenGraphDescription !== undefined) openGraphDescriptionMeta.content = previousOpenGraphDescription;
      if (twitterTitleMeta && previousTwitterTitle !== undefined) twitterTitleMeta.content = previousTwitterTitle;
      if (twitterDescriptionMeta && previousTwitterDescription !== undefined) twitterDescriptionMeta.content = previousTwitterDescription;
    };
  }, []);

  return <main className="min-h-[100dvh] bg-[#f3f7f3] text-[#153642] dark:bg-[#0c1d24] dark:text-[#e3efeb]" data-testid="robotics-demo-page">
    <header className="border-b border-[#d9e6e1] bg-[#f8faf7]/90 dark:border-[#28464d] dark:bg-[#10272e]/95">
      <div className="mx-auto flex min-h-[68px] w-[min(1440px,calc(100%-28px))] items-center justify-between gap-3 sm:w-[min(1440px,calc(100%-48px))]">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#d7e4df] bg-[hsl(var(--card))] text-[#557477] transition hover:border-[#168b94] hover:text-[#168b94] dark:border-[#315057] dark:text-[#a9c3bd]" aria-label="Back to Robotics Dashboard home" data-testid="link-demo-home"><ArrowLeft size={16} /></Link>
          <div className="min-w-0"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-[#153642] text-[#efc34f] dark:bg-[#244751]"><Cpu size={15} /></span><span className="truncate text-[12px] font-bold tracking-[-.02em]">Robotics Dashboard</span></div><p className="mt-0.5 hidden font-mono text-[8px] uppercase tracking-[.12em] text-[#829799] sm:block">Fictional FTC workspace · sample records</p></div>
        </div>
        <div className="flex items-center gap-2"><DemoBadge /><Link href="/auth?createTeam=1" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#153642] px-3 text-[10px] font-bold text-white transition hover:bg-[#214b57] dark:bg-[#efc34f] dark:text-[#153642] dark:hover:bg-[#f4d477] sm:px-4" data-testid="link-demo-create-team">Create a team <ArrowRight size={13} /></Link></div>
      </div>
    </header>

    <div className="mx-auto w-[min(1440px,calc(100%-28px))] sm:w-[min(1440px,calc(100%-48px))]">
      <div className="grid gap-5 pb-12 pt-5 lg:grid-cols-[225px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
        <aside className="lg:sticky lg:top-5 lg:h-fit">
          <div className="rounded-xl border border-[#d9e6e1] bg-[hsl(var(--card))] p-3 dark:border-[#28464d]">
            <div className="flex items-center justify-between gap-2 px-2 pb-3 pt-1">
              <div><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#829799]">Team workspace</p><h2 className="mt-1 text-sm font-bold text-[#153642] dark:text-[#e3efeb]">Demo Robotics</h2></div>
              <span className="grid size-9 place-items-center rounded-lg bg-[#153642] font-mono text-[8px] font-bold text-[#efc34f] dark:bg-[#244751]">SAMPLE</span>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-[#f2f6f3] px-2.5 py-2 dark:bg-[#152d34]"><span className="size-1.5 rounded-full bg-[#64ae8e]" /><span className="font-mono text-[9px] text-[#607981] dark:text-[#aac1be]">2026–27 BUILD SEASON</span></div>
            <button type="button" className="mb-2 flex min-h-9 w-full items-center justify-between rounded-lg px-2 text-left text-[10px] font-semibold text-[#70868b] hover:bg-[#f2f6f3] dark:text-[#9bb0ae] dark:hover:bg-[#1b3439] lg:hidden" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-expanded={mobileNavOpen} aria-controls="demo-workspace-nav" data-testid="button-demo-mobile-nav">Workspace views <ChevronDown size={14} className={`transition-transform ${mobileNavOpen ? "rotate-180" : ""}`} /></button>
            <nav id="demo-workspace-nav" aria-label="Demo workspace sections" className={`${mobileNavOpen ? "grid" : "hidden"} grid-cols-2 gap-1 lg:grid lg:grid-cols-1`} data-testid="demo-workspace-nav">
              {navItems.map(({ id, label, icon: Icon, count }) => <button type="button" key={id} onClick={() => setActiveView(id)} aria-current={view === id ? "page" : undefined} className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-left text-[11px] font-semibold transition ${view === id ? "bg-[#e5f2ee] text-[#167f88] dark:bg-[#1d3e43] dark:text-[#7edbd0]" : "text-[#64797b] hover:bg-[#f2f6f3] hover:text-[#315d62] dark:text-[#a1b7b5] dark:hover:bg-[#1b3439] dark:hover:text-[#d5e8e3]"}`} data-testid={`button-demo-view-${id}`}><Icon size={15} /><span className="flex-1">{label}</span>{count && <span className="rounded-md bg-[hsl(var(--card))]/70 px-1.5 py-0.5 font-mono text-[9px] text-[#829799] dark:text-[#91aaa8]">{count}</span>}</button>)}
            </nav>
            <div className="mt-3 border-t border-[#e5ede9] px-2 pt-3 dark:border-[#28464d]"><p className="font-mono text-[8px] uppercase tracking-[.13em] text-[#829799]">People in this sample</p><div className="mt-2 flex items-center pl-1">{[["MC","teal"],["LP","ochre"],["SR","plum"],["NP","blue"]].map(([initials, color]) => <span key={initials} className="-ml-1 first:ml-0"><Avatar initials={initials} color={color} size="sm" /></span>)}<span className="ml-2 text-[9px] text-[#71878a] dark:text-[#a1b7b5]">4 teammates</span></div></div>
            <div className="mt-3 rounded-lg border border-[#e1ebe6] bg-[#f8faf7] p-2.5 dark:border-[#28464d] dark:bg-[#132a31]"><p className="flex items-center gap-1.5 font-mono text-[8px] font-semibold uppercase tracking-[.1em] text-[#a2771b] dark:text-[#efcf70]"><ShieldCheck size={11} /> Sample data only</p><p className="mt-1 text-[9px] leading-4 text-[#71878a] dark:text-[#a1b7b5]">Names, messages, plans, and records are fictional. Nothing here is connected to a team.</p></div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-col justify-between gap-4 border-b border-[#d9e6e1] pb-5 dark:border-[#28464d] sm:flex-row sm:items-end">
            <div><p className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-[#168b94] dark:text-[#7edbd0]">{active.eyebrow}</p><h1 className="mt-2 text-[clamp(27px,5vw,42px)] font-semibold leading-[1.04] tracking-[-.065em] text-[#153642] dark:text-[#e3efeb]" data-testid="text-demo-view-title">{active.title}</h1><p className="mt-2 max-w-2xl text-[12px] leading-5 text-[#607981] dark:text-[#aac1be]">{active.description}</p></div>
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto"><DemoBadge /></div>
          </div>

          {view === "overview" && <>
            <section className="mb-5 grid gap-3 sm:grid-cols-[1.35fr_.65fr]" aria-label="Team snapshot" data-testid="section-demo-snapshot">
              <article className="relative overflow-hidden rounded-xl bg-[#153642] p-5 text-[#eef8f3] sm:p-6">
                <div aria-hidden="true" className="absolute inset-0 opacity-[.12] [background-image:linear-gradient(rgba(157,221,210,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(157,221,210,.4)_1px,transparent_1px)] [background-size:27px_27px] [mask-image:linear-gradient(120deg,black,transparent_75%)]" />
                <div className="relative"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#9dc7bf]">Shop session · build night</span><span className="rounded-full border border-[#84b7a7]/40 bg-[#84b7a7]/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.1em] text-[#a7d7c8]">In the shop</span></div><h2 className="mt-5 max-w-xl text-2xl font-medium leading-tight tracking-[-.05em] sm:text-[31px]">The robot is starting to feel like a robot.</h2><p className="mt-2 max-w-lg text-[11px] leading-5 text-[#b2d0c8]">Tonight: finish the intake fit, run the new park routine, and get the pit kit back into one piece.</p>
                  <div className="mt-6 flex flex-wrap gap-5 border-t border-white/10 pt-4">{[["02","Active tasks"],["02","Ready for review"],["04","Teammates here"]].map(([value,label]) => <div key={label}><strong className="block font-mono text-xl font-medium text-[#efc34f]">{value}</strong><span className="mt-1 block text-[9px] text-[#a5c4bd]">{label}</span></div>)}</div>
                </div>
              </article>
              <article className="flex flex-col justify-between rounded-xl border border-[#d9e6e1] bg-[hsl(var(--card))] p-5 dark:border-[#28464d] sm:p-6" data-testid="card-demo-cad-summary">
                <div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#168b94] dark:text-[#7edbd0]">On the bench</p><h2 className="mt-2 text-lg font-semibold tracking-[-.04em] text-[#153642] dark:text-[#e3efeb]">Intake assembly · rev C</h2><p className="mt-2 text-[11px] leading-5 text-[#607981] dark:text-[#aac1be]">A 2 mm spacer clears the front crossbar. Check roller spacing before locking the plate.</p></div>
                <button type="button" onClick={() => setActiveView("cad")} className="mt-5 inline-flex min-h-9 items-center gap-2 self-start rounded-lg border border-[#d5e2de] px-3 text-[10px] font-bold text-[#167f88] transition hover:border-[#168b94] hover:bg-[#f2f7f4] dark:border-[#315057] dark:text-[#7edbd0] dark:hover:bg-[#1b3439]" data-testid="button-open-cad">Open CAD notes <ArrowRight size={13} /></button>
              </article>
            </section>
            <div className="grid gap-5 xl:grid-cols-[1.04fr_.96fr]"><TaskList compact /><ChatPanel compact /></div>
            <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Workspace quick links">
              {[{ id: "parts", title: "Parts on hand", detail: "Two bins need a restock check.", icon: Boxes, accent: "text-[#a2771b] bg-[#fff0c6] dark:bg-[#4b3c1c] dark:text-[#f1cc67]" }, { id: "code", title: "Robot code", detail: "Park routine is ready for a field run.", icon: Code2, accent: "text-[#167f88] bg-[#dff1ec] dark:bg-[#17443f] dark:text-[#7edbd0]" }, { id: "plan", title: "Build plan", detail: "Five small tasks, four teammates.", icon: Check, accent: "text-[#496d7d] bg-[#dceef5] dark:bg-[#183c49] dark:text-[#8bd2e0]" }].map(({ id, title, detail, icon: Icon, accent }) => <button type="button" key={id} onClick={() => setActiveView(id as WorkspaceView)} className="flex min-h-[86px] items-center gap-3 rounded-xl border border-[#d9e6e1] bg-[hsl(var(--card))] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#9ecdc9] dark:border-[#28464d] dark:hover:border-[#4b7778]" data-testid={`button-quick-${id}`}><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${accent}`}><Icon size={16} /></span><span className="min-w-0"><strong className="block text-[11px] text-[#274650] dark:text-[#e3efeb]">{title}</strong><span className="mt-1 block text-[10px] leading-4 text-[#71878a] dark:text-[#a1b7b5]">{detail}</span></span></button>)}
            </section>
          </>}
          {view === "chat" && <div className="max-w-3xl"><ChatPanel /></div>}
           {view === "plan" && <div className="max-w-4xl"><div className="mb-4 flex flex-wrap items-center gap-2"><StatusPill tone="gold">2 in progress</StatusPill><StatusPill tone="teal">2 need review</StatusPill><StatusPill tone="green">1 complete</StatusPill></div><TaskList /></div>}
          {view === "parts" && <div className="max-w-4xl"><PartsPanel /><p className="mt-3 flex items-center gap-2 text-[10px] text-[#829799] dark:text-[#9bb0ae]"><Package size={12} /> Quantity and status are fictional sample values.</p></div>}
          {view === "code" && <div className="max-w-4xl"><CodePanel /></div>}
          {view === "cad" && <div className="max-w-4xl"><CadPanel /></div>}

          <footer className="mt-9 flex flex-col gap-2 border-t border-[#d9e6e1] pt-4 text-[9px] text-[#829799] dark:border-[#28464d] dark:text-[#91aaa8] sm:flex-row sm:items-center sm:justify-between" data-testid="demo-footer"><span className="inline-flex items-center gap-1.5"><Sparkles size={12} className="text-[#168b94] dark:text-[#7edbd0]" /> A believable sample workspace, not a live team account.</span><Link href="/auth?createTeam=1" className="inline-flex min-h-9 items-center gap-1.5 self-start font-semibold text-[#167f88] hover:text-[#105c64] dark:text-[#7edbd0] dark:hover:text-[#b1f0e7]" data-testid="link-demo-footer-create-team">Make a workspace for your team <ArrowRight size={12} /></Link></footer>
        </div>
      </div>
    </div>
  </main>;
}

export function parseDemoView(search: string): DemoView {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const view = params.get("view");
  if (
    view === "chat" ||
    view === "parts" ||
    view === "code" ||
    view === "cad" ||
    view === "custom-build-tracker" ||
    view === "custom-field-test-log"
  ) return view;
  return "overview";
}

export function DemoMetadata() {
  useEffect(() => {
    const description = "Explore a fictional, read-only robotics workspace. See how teams connect chat, parts, CAD, code, and custom apps in one place—no sign-in or live team data needed.";
    const title = "Live demo · Robotics Team Workspace";
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const openGraphTitleMeta = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const openGraphDescriptionMeta = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const twitterTitleMeta = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    const twitterDescriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    const previousTitle = document.title;
    const previousDescription = descriptionMeta?.content;
    const previousOpenGraphTitle = openGraphTitleMeta?.content;
    const previousOpenGraphDescription = openGraphDescriptionMeta?.content;
    const previousTwitterTitle = twitterTitleMeta?.content;
    const previousTwitterDescription = twitterDescriptionMeta?.content;

    document.title = title;
    if (descriptionMeta) descriptionMeta.content = description;
    if (openGraphTitleMeta) openGraphTitleMeta.content = title;
    if (openGraphDescriptionMeta) openGraphDescriptionMeta.content = description;
    if (twitterTitleMeta) twitterTitleMeta.content = title;
    if (twitterDescriptionMeta) twitterDescriptionMeta.content = description;

    return () => {
      document.title = previousTitle;
      if (descriptionMeta && previousDescription !== undefined) descriptionMeta.content = previousDescription;
      if (openGraphTitleMeta && previousOpenGraphTitle !== undefined) openGraphTitleMeta.content = previousOpenGraphTitle;
      if (openGraphDescriptionMeta && previousOpenGraphDescription !== undefined) openGraphDescriptionMeta.content = previousOpenGraphDescription;
      if (twitterTitleMeta && previousTwitterTitle !== undefined) twitterTitleMeta.content = previousTwitterTitle;
      if (twitterDescriptionMeta && previousTwitterDescription !== undefined) twitterDescriptionMeta.content = previousTwitterDescription;
    };
  }, []);

  return null;
}

export function DemoWorkspaceContent({ view }: { view: "chat" | "parts" | "code" | "cad" }) {
  const active = viewTitles[view];
  return (
    <div className="fade-up" data-testid="robotics-demo-page">
      <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.22em] text-[#16869a] dark:text-[#73c9c0]">{active.eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-[-.045em] md:text-4xl" data-testid="text-demo-view-title">{active.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#718189] dark:text-[#afc1c9]">{active.description}</p>
        </div>
        <DemoBadge />
      </header>

      {view === "chat" && <div className="max-w-4xl"><ChatPanel /></div>}
      {view === "parts" && <div className="max-w-4xl"><PartsPanel /><p className="mt-3 flex items-center gap-2 text-xs text-[#718189] dark:text-[#afc1c9]"><Package size={14} /> All inventory values are fictional sample data.</p></div>}
      {view === "code" && <div className="max-w-4xl"><CodePanel /></div>}
      {view === "cad" && <div className="max-w-4xl"><CadPanel /></div>}
      <footer className="mt-9 border-t border-[#dce5e5] pt-4 text-xs text-[#718189] dark:border-[#2a3f52] dark:text-[#afc1c9]">
        Sample content only · No live team records or services are connected.
      </footer>
    </div>
  );
}
