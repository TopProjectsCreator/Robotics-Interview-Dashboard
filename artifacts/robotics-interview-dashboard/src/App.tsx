import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Link, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import {
  AlertCircle, ArrowRight, Bot, Check, ChevronRight, CircleDot, ClipboardList,
  FileUp, Filter, GripVertical, LayoutDashboard, LogOut, Mail, Menu, Monitor, PhoneCall, Printer,
  RefreshCw, Search, ShieldCheck, Sparkles, TimerReset, UsersRound, Volume2, X,
} from "lucide-react";
import {
  getGetApplicantQueryKey, getGetAssistantHistoryQueryKey, getGetDashboardSummaryQueryKey, getGetDisplayStateQueryKey,
  getGetInterviewChatQueryKey, getGetQueueQueryKey, getGetSessionQueryKey, getListApplicantsQueryKey, getListImportHistoryQueryKey,
  useAskAssistant, useAdvanceQueue, useCommitImport, useGetApplicant, useGetAssistantHistory, useGetDashboardSummary,
  useGetDisplayState, useGetInterviewChat, useGetQueue, useGetSession, useListApplicants, useListImportHistory,
  useLogin, useLogout, usePreviewImport, useReorderQueue, useRequestUploadUrl, useResetQueue, useSendInterviewChat,
  useUpdateQueueSettings,
  useUpdateApplicant,
} from "@workspace/api-client-react";
import type { Applicant, ApplicantUpdate, DashboardCount, DisplayState, ImportPreview, QueueApplicant } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import "@/index.css";

const queryClient = new QueryClient();
const categories = ["advance", "hold", "decline", "unranked"];
const statuses = ["queued", "in_progress", "completed"];
const officialDisplayImages = [
  "https://pinelakeroboticsteam.lovable.app/assets/team-photo-2025-DGc7DRd2.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/team-workspace-CNGT9Dwn.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/team-building-BVvSQr-U.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/maksim-BgBGtyX4.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/sim-mKNQ9QdF.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/janya-BMty1X_H.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/abhi-WpSQcuUd.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/ishaan-CBI5NMTe.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/arya-CgvuUuOT.jpg",
  "https://pinelakeroboticsteam.lovable.app/assets/page-3-C4L_XZ_M.jpg",
];

function Logo({ dark = false }: { dark?: boolean }) {
  return <div className="flex items-center gap-2.5" data-testid="brand-robotics">
    <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl ${dark ? "bg-[#f8c84a] text-[#182232]" : "bg-[#163247] text-[#f8c84a]"}`}>
      <CircleDot size={20} strokeWidth={2.4} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-current" />
    </span>
    <span className={`leading-none ${dark ? "text-white" : "text-[#182232]"}`}><b className="block text-[15px] tracking-[.18em]">ROBOTICS</b><small className="mono text-[9px] uppercase tracking-[.3em] opacity-60">Tryout control</small></span>
  </div>;
}

function IconButton({ label, children, onClick, testId }: { label: string; children: ReactNode; onClick?: () => void; testId: string }) {
  return <button aria-label={label} data-testid={testId} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-white text-[#436070] transition hover:border-[#16869a] hover:text-[#16869a]">{children}</button>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "teal" | "yellow" | "red" | "blue" }) {
  const colors = { neutral: "bg-[#edf1f3] text-[#4f626b]", teal: "bg-[#dff4f2] text-[#12737d]", yellow: "bg-[#fff3cf] text-[#805c08]", red: "bg-[#fbe4e2] text-[#9f3b33]", blue: "bg-[#e2ebfa] text-[#375e93]" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.08em] ${colors[tone]}`}>{children}</span>;
}

function Skeleton({ className = "" }: { className?: string }) { return <div className={`animate-pulse rounded-lg bg-[#dfe7ea] ${className}`} />; }
function ErrorState({ onRetry, compact = false }: { onRetry?: () => void; compact?: boolean }) {
  return <div className={`flex ${compact ? "min-h-[160px]" : "min-h-[320px]"} flex-col items-center justify-center gap-3 text-center`} data-testid="status-error"><AlertCircle className="text-[#bd5047]" /><p className="font-semibold">Control link unavailable</p><p className="text-sm text-[#63747c]">The live event data could not be reached.</p>{onRetry && <button onClick={onRetry} data-testid="button-retry" className="rounded-lg bg-[#183a4b] px-4 py-2 text-sm font-semibold text-white">Retry connection</button>}</div>;
}

function Login() {
  const [password, setPassword] = useState("");
  const [location, setLocation] = useLocation();
  const qc = useQueryClient();
  const passwordRef = useRef<HTMLInputElement>(null);
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const login = useLogin();
  useEffect(() => { if (session.data?.authenticated && location === "/") setLocation("/dashboard"); }, [session.data, location, setLocation]);
  useEffect(() => {
    // Browsers may ignore autoFocus in an iframe until the document has
    // mounted, so focus again after the login view is ready.
    const frame = window.requestAnimationFrame(() => passwordRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const submit = (e: React.FormEvent) => { e.preventDefault(); login.mutate({ data: { password } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSessionQueryKey() }); setLocation("/dashboard"); } }); };
  return <main className="noise relative flex min-h-[100dvh] overflow-hidden bg-[#172a3a] text-white">
    <div className="absolute -right-40 -top-40 h-[680px] w-[680px] rounded-full border border-[#387182]/30" /><div className="absolute -right-20 -top-20 h-[440px] w-[440px] rounded-full border border-[#387182]/30" />
    <div className="relative z-10 grid w-full lg:grid-cols-[1fr_480px]">
      <section className="hidden flex-col justify-between p-12 lg:flex xl:p-20"><Logo dark /><div><p className="mono mb-5 text-xs uppercase tracking-[.28em] text-[#f8c84a]">Wolverines / Team 23442</p><h1 className="max-w-xl text-6xl font-semibold leading-[.95] tracking-[-.05em] xl:text-8xl">Build the<br /><span className="text-[#f8c84a]">next team.</span></h1><p className="mt-8 max-w-md text-lg leading-7 text-[#abc0c7]">A quiet control room for sharp eyes, honest signals, and the people ready to build.</p></div><div className="mono flex flex-wrap gap-3 text-[10px] uppercase tracking-[.2em] text-[#76929c]"><span>All Claws on Deck!</span><span>·</span><span>PLMS · Sammamish, Washington</span><span>·</span><span>Coordinator access</span></div></section>
      <section className="flex flex-col justify-center bg-[#f3f6f5] px-7 py-12 text-[#182232] sm:px-14"><div className="mb-16 lg:hidden"><Logo /></div><div className="mx-auto w-full max-w-[350px]"><Badge tone="teal">Coordinator access</Badge><h2 className="mt-5 text-4xl font-semibold tracking-[-.05em]">Welcome back.</h2><p className="mt-3 text-sm leading-6 text-[#63747c]">Enter the event passcode to open the tryout control room.</p><form onSubmit={submit} className="mt-9 space-y-5"><input name="username" autoComplete="username" tabIndex={-1} aria-label="Coordinator" className="sr-only" value="coordinator" readOnly /><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Event passcode</span><input ref={passwordRef} id="event-passcode" name="password" autoFocus autoComplete="current-password" inputMode="text" enterKeyHint="done" type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" aria-label="Event passcode" className="h-14 w-full rounded-xl border border-[#cbd7da] bg-white px-4 text-lg tracking-[.25em] outline-none focus:border-[#16869a] focus:ring-4 focus:ring-[#16869a]/10" placeholder="••••••••" /></label>{login.isError && <p className="text-sm text-[#b34a42]" data-testid="login-error">Passcode not recognized. Check with the event lead.</p>}<button disabled={login.isPending || !password} data-testid="button-login" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#16869a] font-semibold text-white transition hover:bg-[#106d7a] disabled:cursor-not-allowed disabled:opacity-50">{login.isPending ? "Unlocking control room..." : <>Enter control room <ArrowRight size={17} /></>}</button></form><div className="mt-10 flex items-start gap-3 border-t border-[#d7e0e0] pt-5 text-xs leading-5 text-[#728289]"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#16869a]" />Private session. This workspace is only for the two event coordinators.</div></div></section>
    </div>
  </main>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const logout = useLogout();
  if (session.isLoading) return <div className="min-h-[100dvh] bg-[#f3f6f5] p-8"><Skeleton className="h-10 w-44" /><Skeleton className="mt-10 h-40 w-full" /></div>;
  if (!session.data?.authenticated) return <Login />;
  const nav = [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/applicants", label: "Applicants", icon: UsersRound }, { href: "/queue", label: "Interview queue", icon: ClipboardList }, { href: "/assistant", label: "AI assistant", icon: Bot }];
  return <div className="min-h-[100dvh] bg-[#f3f6f5] text-[#182232]"><aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-[#172a3a] px-4 py-5 text-[#d4e0e2] transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}><div className="px-3"><Logo dark /></div><div className="mono mb-3 mt-12 px-3 text-[9px] uppercase tracking-[.24em] text-[#78949d]">Event command</div><nav className="space-y-1">{nav.map(({ href, label, icon: I }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMobileNav(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${location.startsWith(href) ? "bg-[#f8c84a] text-[#1d2c36]" : "text-[#a7bdc3] hover:bg-[#243d4d] hover:text-white"}`}><I size={18} /><span>{label}</span>{href === "/queue" && <span className="ml-auto h-2 w-2 rounded-full bg-[#f8c84a]" />}</Link>)}</nav><div className="mt-auto rounded-2xl border border-[#365161] bg-[#1d3545] p-4"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 animate-pulse rounded-full bg-[#51d2ad]" />Live event link</div><p className="mt-2 text-[11px] leading-5 text-[#87a3ac]">Changes sync to the big screen and interview bay.</p><Link href="/display" target="_blank" data-testid="link-open-display" className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#f8c84a]">Open display <ArrowRight size={13} /></Link></div><button onClick={() => logout.mutate(undefined, { onSuccess: () => setLocation("/") })} data-testid="button-logout" className="mt-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#a7bdc3] hover:bg-[#243d4d] hover:text-white"><LogOut size={18} />End session</button></aside><div className="lg:pl-[248px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#dce5e5] bg-[#f3f6f5]/90 px-5 backdrop-blur-md lg:px-9"><button onClick={() => setMobileNav(!mobileNav)} data-testid="button-mobile-menu" className="mr-3 text-[#365965] lg:hidden"><Menu /></button><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[#7c8c91]">Wolverines / Team 23442</p><p className="text-sm font-semibold">Coordinator workspace</p></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-xs text-[#60757c] sm:flex"><span className="h-2 w-2 rounded-full bg-[#28a47f]" /> Synced moments ago</div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dcecea] text-xs font-bold text-[#176a77]">MZ</div></div></header><main className="mx-auto max-w-[1500px] p-5 lg:p-9">{children}</main></div></div>;
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.22em] text-[#16869a]">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-[-.045em] md:text-4xl">{title}</h1>{detail && <p className="mt-2 max-w-2xl text-sm text-[#718189]">{detail}</p>}</div>{action}</div>;
}
function StatCard({ label, value, suffix, tone = "teal", note }: { label: string; value: ReactNode; suffix?: string; tone?: "teal" | "yellow" | "navy" | "red"; note?: string }) {
  const c = { teal: "border-t-[#16869a]", yellow: "border-t-[#f0b82e]", navy: "border-t-[#263e60]", red: "border-t-[#bd5047]" };
  return <div className={`rounded-2xl border border-[#dce5e5] border-t-4 bg-white p-5 shadow-[0_3px_12px_rgba(26,49,60,.04)] ${c[tone]}`} data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#72838a]">{label}</p><div className="mt-3 flex items-baseline gap-1"><strong className="text-3xl tracking-[-.05em]">{value}</strong>{suffix && <span className="text-sm text-[#718189]">{suffix}</span>}</div>{note && <p className="mt-2 text-xs text-[#718189]">{note}</p>}</div>;
}
function Section({ title, kicker, children, className = "" }: { title: string; kicker?: string; children: ReactNode; className?: string }) { return <section className={`rounded-2xl border border-[#dce5e5] bg-white p-5 shadow-[0_3px_12px_rgba(26,49,60,.035)] ${className}`}><div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold">{title}</h2>{kicker && <p className="mt-1 text-xs text-[#7c8c91]">{kicker}</p>}</div></div>{children}</section>; }

function Dashboard() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  if (summary.isLoading) return <><PageHeading eyebrow="Live overview" title="Good morning, coordinators." /><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div></>;
  if (summary.isError || !summary.data) return <ErrorState onRetry={() => summary.refetch()} />;
  const d = summary.data;
  return <div className="fade-up"><PageHeading eyebrow="Live overview / 08:42 local" title="Good morning, coordinators." detail="The room is calm. Here is the signal across the applicant field." action={<Link href="/display" target="_blank" data-testid="link-launch-display" className="flex items-center gap-2 rounded-xl bg-[#183a4b] px-4 py-3 text-sm font-semibold text-white shadow-sm"><Monitor size={16} /> Launch big screen</Link>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total applicants" value={d.total} tone="navy" note={`${d.reviewed} reviewed so far`} /><StatCard label="Average AI score" value={d.averageScore.toFixed(1)} suffix="/ 100" tone="yellow" note="Across valid applications" /><StatCard label="Interview complete" value={d.interviewProgress.completed} suffix={` / ${d.interviewProgress.completed + d.interviewProgress.remaining}`} tone="teal" note={`${d.interviewProgress.remaining} still in the queue`} /><StatCard label="Needs attention" value={d.invalid} tone="red" note="Invalid or incomplete records" /></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Section title="Score distribution" kicker="AI signal across the current intake"><Bars data={d.scoreBuckets} max={Math.max(...d.scoreBuckets.map(x => x.value), 1)} color="teal" /></Section><Section title="Recommendation signal" kicker="Review the edges first"><Bars data={d.recommendations} max={Math.max(...d.recommendations.map(x => x.value), 1)} color="yellow" /></Section></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><Section title="Grade mix"><Bars data={d.grades} max={Math.max(...d.grades.map(x => x.value), 1)} color="blue" /></Section><Section title="Commitment signal"><Bars data={d.commitments} max={Math.max(...d.commitments.map(x => x.value), 1)} color="green" /></Section><Section title="Queue pulse" kicker="Individual applicant progression"><div className="flex items-end justify-between"><div><p className="mono text-5xl font-medium tracking-[-.08em] text-[#16869a]">{d.interviewProgress.completed}</p><p className="mt-2 text-sm text-[#718189]">applicants cleared</p></div><div className="h-24 w-24 rounded-full p-2" style={{ background: `conic-gradient(#16869a ${Math.round((d.interviewProgress.completed / Math.max(d.interviewProgress.completed + d.interviewProgress.remaining, 1)) * 100)}%, #e4eceb 0)` }}><div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold">{Math.round((d.interviewProgress.completed / Math.max(d.interviewProgress.completed + d.interviewProgress.remaining, 1)) * 100)}%</div></div></div><Link href="/queue" data-testid="link-view-queue" className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#16869a]">Open interview queue <ChevronRight size={15} /></Link></Section></div></div>;
}
function Bars({ data, max, color }: { data: DashboardCount[]; max: number; color: "teal" | "yellow" | "blue" | "green" }) { const c = { teal: "bg-[#16869a]", yellow: "bg-[#edb52c]", blue: "bg-[#466896]", green: "bg-[#3aa582]" }; return <div className="space-y-4">{data.length ? data.map((item, i) => <div key={`${item.label}-${i}`} data-testid={`bar-${item.label}`}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-[#52666e]">{item.label}</span><span className="mono text-[#7b8a8f]">{item.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1f1]"><div className={`h-full rounded-full ${c[color]} transition-all`} style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }} /></div></div>) : <p className="text-sm text-[#7c8c91]">No signal yet.</p>}</div>; }

function Applicants() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [grade, setGrade] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const params = useMemo(() => ({ search: search || undefined, category: category || undefined, grade: grade || undefined, sort: "rank" }), [search, category, grade]);
  const list = useListApplicants(params, { query: { queryKey: getListApplicantsQueryKey(params) } });
  const update = useUpdateApplicant();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const onDrop = (cat: string) => {
    if (dragId) {
      update.mutate({ id: dragId, data: { category: cat } }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListApplicantsQueryKey(params) });
          setDragId(null);
        },
      });
    }
  };
  return <div className="fade-up">
    <PageHeading eyebrow="Applicant review / triage" title="The applicant field." detail="Rank with your co-coordinator. Drag a candidate into a decision lane when the signal is clear." action={<div className="flex flex-wrap gap-2">
      <button onClick={() => setPrintOpen(true)} data-testid="button-print-roster" className="flex items-center gap-2 rounded-xl border border-[#cbd9da] bg-white px-4 py-3 text-sm font-semibold text-[#385762]"><Printer size={16} /> Print roster</button>
      <button onClick={() => setImportOpen(!importOpen)} data-testid="button-import" className="flex items-center gap-2 rounded-xl border border-[#cbd9da] bg-white px-4 py-3 text-sm font-semibold text-[#385762]"><FileUp size={16} /> Import roster</button>
    </div>} />
    {importOpen && <ImportPanel onClose={() => setImportOpen(false)} />}
    {list.isLoading ? <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div> : list.isError ? <ErrorState compact onRetry={() => list.refetch()} /> : <>
      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-[#dce5e5] bg-white p-3">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-3 text-[#819198]" /><input value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-applicants" placeholder="Search name, email, experience..." className="h-10 w-full rounded-lg border border-[#dce5e5] pl-9 pr-3 text-sm outline-none focus:border-[#16869a]" /></div>
        <select value={category} onChange={e => setCategory(e.target.value)} data-testid="select-category-filter" className="h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm"><option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={grade} onChange={e => setGrade(e.target.value)} data-testid="select-grade-filter" className="h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm"><option value="">All grades</option>{["6th","7th"].map(g => <option key={g} value={g}>{g}</option>)}</select>
        <button onClick={() => { setSearch(""); setCategory(""); setGrade(""); }} data-testid="button-reset-filters" className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-[#60757c] hover:bg-[#edf2f2]"><RefreshCw size={14} /> Reset</button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <div className="overflow-hidden rounded-2xl border border-[#dce5e5] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5ecec] px-5 py-4"><div><h2 className="font-semibold">Review queue <span className="mono ml-2 text-xs text-[#16869a]">{list.data?.total ?? 0}</span></h2></div><span className="flex items-center gap-2 text-xs text-[#7c8c91]"><Filter size={14} /> filtered view</span></div>
          {!list.data?.items.length ? <div className="p-12 text-center"><UsersRound className="mx-auto text-[#b8c6c9]" /><p className="mt-3 font-semibold">No applicants match these filters.</p><p className="mt-1 text-sm text-[#7c8c91]">Try widening the field or reset the filters.</p></div> : <div className="divide-y divide-[#edf1f1]">{list.data.items.map((a, i) => <ApplicantRow key={a.id} applicant={a} index={i} onSelect={() => setSelected(a.id)} onDragStart={() => setDragId(a.id)} />)}</div>}
        </div>
        <div className="space-y-3">{categories.slice(0,3).map(cat => <DropLane key={cat} category={cat} applicants={list.data?.items.filter(a => a.category === cat) ?? []} onDrop={() => onDrop(cat)} onSelect={setSelected} />)}</div>
      </div>
    </>}
    {selected && <ApplicantDetail id={selected} onClose={() => setSelected(null)} />}
    {printOpen && <PrintRoster applicants={list.data?.items ?? []} onClose={() => setPrintOpen(false)} />}
  </div>;
}
function ApplicantRow({ applicant: a, index, onSelect, onDragStart }: { applicant: Applicant; index: number; onSelect: () => void; onDragStart: () => void }) { const tone = a.aiRecommendation.toLowerCase().includes("advance") ? "teal" : a.aiRecommendation.toLowerCase().includes("decline") ? "red" : "yellow"; return <div draggable onDragStart={onDragStart} data-testid={`row-applicant-${a.id}`} className="group flex cursor-grab items-center gap-3 px-5 py-4 transition hover:bg-[#f6f9f8]"><GripVertical size={15} className="shrink-0 text-[#b4c1c4]" /><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#dcecea] text-sm font-bold text-[#176a77]">{a.name.split(" ").map(x => x[0]).join("").slice(0,2)}</div><button onClick={onSelect} data-testid={`button-open-applicant-${a.id}`} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{a.name}</p><Badge tone={tone}>{a.aiRecommendation}</Badge></div><p className="mt-1 truncate text-xs text-[#7a8b90]">Grade {a.grade} · {a.roboticsExperience || "No robotics experience noted"}</p></button><div className="hidden text-right sm:block"><p className="mono text-lg font-medium text-[#183a4b]">{a.aiScore.toFixed(1)}</p><p className="text-[10px] uppercase tracking-[.1em] text-[#9aa7aa]">AI score</p></div><ChevronRight size={16} className="text-[#b4c1c4]" /></div>; }
function DropLane({ category, applicants, onDrop, onSelect }: { category: string; applicants: Applicant[]; onDrop: () => void; onSelect: (id: string) => void }) { const labels: Record<string,string> = { advance: "Advance", hold: "Hold & discuss", decline: "Decline" }; return <div onDragOver={e => e.preventDefault()} onDrop={onDrop} data-testid={`drop-lane-${category}`} className="rounded-2xl border border-dashed border-[#c5d5d7] bg-[#eef4f3] p-3"><div className="flex items-center justify-between px-2 py-1"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4f6870]">{labels[category]}</p><span className="mono text-xs text-[#809196]">{applicants.length}</span></div><p className="px-2 pb-2 pt-1 text-[11px] text-[#819196]">Drop candidates here</p>{applicants.slice(0,4).map(a => <button key={a.id} onClick={() => onSelect(a.id)} data-testid={`lane-applicant-${a.id}`} className="mb-2 flex w-full items-center justify-between rounded-xl border border-[#d7e4e3] bg-white px-3 py-3 text-left shadow-sm"><span className="truncate text-xs font-semibold">{a.name}</span><span className="mono text-xs text-[#16869a]">{a.aiScore.toFixed(1)}</span></button>)}</div>; }
function ImportPanel({ onClose }: { onClose: () => void }) {
  const upload = useRequestUploadUrl();
  const commit = useCommitImport();
  const preview = usePreviewImport();
  const history = useListImportHistory({ query: { queryKey: getListImportHistoryQueryKey() } });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<{ file: File; objectPath: string; preview: ImportPreview }[]>([]);
  const submit = async () => {
    if (!files.length) return;
    setError("");
    try {
      const next: { file: File; objectPath: string; preview: ImportPreview }[] = [];
      for (const file of files) {
        const requested = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || "text/csv" } });
        const response = await fetch(requested.uploadURL, { method: "PUT", headers: { "Content-Type": file.type || "text/csv" }, body: file });
        if (!response.ok) throw new Error("Upload failed");
        const text = await file.text();
        const rowCount = Math.max(0, text.split(/\r?\n/).filter(Boolean).length - 1);
        const filePreview = await preview.mutateAsync({ data: { objectPath: requested.objectPath, fileName: file.name, rowCount } });
        next.push({ file, objectPath: requested.objectPath, preview: filePreview });
        setPreviews([...next]);
      }
    } catch {
      setError("The roster could not be uploaded. Check the file and try again.");
    }
  };
  const confirmImport = async () => {
    if (!previews.length) return;
    try {
      for (const item of previews) {
        await commit.mutateAsync({ data: { objectPath: item.objectPath, fileName: item.file.name, rowCount: item.preview.rowCount } });
      }
      await history.refetch();
    } catch {
      setError("The roster previewed successfully, but the commit failed.");
    }
  };
  const pending = upload.isPending || preview.isPending || commit.isPending;
  const totals = previews.reduce((total, item) => ({
    added: total.added + item.preview.diff.added,
    updated: total.updated + item.preview.diff.updated,
    unchanged: total.unchanged + item.preview.diff.unchanged,
    missing: total.missing + item.preview.diff.missingFromUpload,
  }), { added: 0, updated: 0, unchanged: 0, missing: 0 });
  return <div className="mb-5 rounded-2xl border border-[#b9d9d7] bg-[#eaf7f5] p-5">
    <div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Roster ingestion</p><h2 className="mt-1 font-semibold">Import one or more roster files</h2><p className="mt-1 text-xs text-[#587278]">CSV, TSV, comma, semicolon, quoted, and mixed-delimiter rows are recovered before commit.</p></div><IconButton label="Close import" testId="button-close-import" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><input type="file" multiple accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={e => { setFiles(Array.from(e.target.files ?? [])); setPreviews([]); setError(""); }} data-testid="input-import-file" className="max-w-full rounded-lg border border-[#c4dcda] bg-white px-3 py-2 text-sm" /><button disabled={!files.length || pending} onClick={submit} data-testid="button-preview-import" className="rounded-lg bg-[#16869a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Reading files..." : `Preview ${files.length || ""} file${files.length === 1 ? "" : "s"}`}</button></div>
    {files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map(file => <span key={`${file.name}-${file.lastModified}`} className="rounded-full bg-white px-3 py-1 text-xs text-[#587278]">{file.name} · {Math.ceil(file.size / 1024)} KB</span>)}</div>}
    {previews.length > 0 && <div className="mt-4 rounded-xl border border-[#b9d9d7] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">{previews.length} preview{previews.length === 1 ? "" : "s"} ready</p><p className="mt-1 text-xs text-[#718189]">Review each file’s detected format and diff, then commit them together.</p></div><button disabled={commit.isPending || previews.length !== files.length} onClick={confirmImport} data-testid="button-commit-import" className="rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{commit.isPending ? "Committing..." : `Commit ${previews.length} file${previews.length === 1 ? "" : "s"}`}</button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Added", totals.added, "text-[#168069]"], ["Updated", totals.updated, "text-[#466896]"], ["Unchanged", totals.unchanged, "text-[#718189]"], ["Missing from files", totals.missing, "text-[#bd5047]"]].map(([label, value, tone]) => <div key={String(label)} className="rounded-lg bg-[#f4f8f7] p-3"><p className="text-[10px] uppercase tracking-[.1em] text-[#7c8c91]">{label}</p><p className={`mono mt-1 text-xl ${tone}`}>{value}</p></div>)}</div><div className="mt-4 space-y-2">{previews.map(item => <div key={item.objectPath} className="rounded-lg border border-[#e3ebeb] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold">{item.file.name}</span><span className="text-[11px] text-[#7c8c91]">{item.preview.rowCount} valid rows · delimiter: {item.preview.delimiter === "tab" ? "TAB" : item.preview.delimiter}</span></div>{item.preview.warnings.length > 0 && <p className="mt-2 text-xs text-[#805c08]">{item.preview.warnings.join(" ")}</p>}</div>)}</div></div>}
    {commit.isSuccess && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#168069]"><Check size={14} /> Import committed successfully and saved to history.</p>}
    {history.data?.items.length ? <div className="mt-5 border-t border-[#c9e0de] pt-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#587278]">Saved import history</p><div className="mt-2 space-y-2">{history.data.items.slice(0, 4).map(item => <div key={item.importId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs"><span className="font-semibold">{item.fileName}</span><span className="text-[#718189]">{item.imported} rows · {item.diff.added} added · {item.diff.updated} updated · {new Date(item.createdAt).toLocaleDateString()}</span></div>)}</div></div> : null}
    {error && <p className="mt-3 text-xs text-[#ad4b43]" data-testid="import-error">{error}</p>}
  </div>;
}

type PrintField = "name" | "grade" | "score" | "recommendation" | "category" | "status" | "email" | "notes";
const printFieldOptions: { key: PrintField; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "grade", label: "Grade" },
  { key: "score", label: "AI score" },
  { key: "recommendation", label: "Recommendation" },
  { key: "category", label: "Category" },
  { key: "status", label: "Interview status" },
  { key: "email", label: "Email" },
  { key: "notes", label: "Coordinator notes" },
];

function PrintRoster({ applicants, onClose }: { applicants: Applicant[]; onClose: () => void }) {
  const [fields, setFields] = useState<Record<PrintField, boolean>>({
    name: true, grade: true, score: true, recommendation: true,
    category: false, status: false, email: false, notes: false,
  });
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [printing]);
  const selectedFields = printFieldOptions.filter(({ key }) => fields[key]);
  const valueFor = (applicant: Applicant, key: PrintField) => ({
    name: applicant.name,
    grade: applicant.grade,
    score: applicant.aiScore < 0 ? "Invalid" : applicant.aiScore.toFixed(1),
    recommendation: applicant.aiRecommendation,
    category: applicant.category || "Unranked",
    status: applicant.interviewStatus,
    email: applicant.email || "—",
    notes: applicant.notes || "—",
  }[key]);
  return <div className="print-modal fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/45 p-5" onClick={onClose}>
    <section onClick={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#16869a]">Output / roster</p><h2 className="mt-2 text-2xl font-semibold">Choose what to print</h2><p className="mt-1 text-sm text-[#718189]">This prints the current filtered applicant list, not the entire private file by default.</p></div><IconButton label="Close print options" testId="button-close-print" onClick={onClose}><X size={16} /></IconButton></div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{printFieldOptions.map(({ key, label }) => <label key={key} className="flex items-center gap-2 rounded-lg border border-[#e1e9e8] px-3 py-2 text-xs font-medium"><input type="checkbox" checked={fields[key]} onChange={e => setFields(current => ({ ...current, [key]: e.target.checked }))} className="h-4 w-4 accent-[#16869a]" />{label}</label>)}</div>
      <div className="mt-6 overflow-hidden rounded-xl border border-[#dce5e5]"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#f3f7f6]"><tr>{selectedFields.map(field => <th key={field.key} className="whitespace-nowrap px-3 py-3 font-semibold text-[#52666e]">{field.label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf1f1]">{applicants.slice(0, 12).map(applicant => <tr key={applicant.id}>{selectedFields.map(field => <td key={field.key} className="max-w-[220px] truncate px-3 py-3 text-[#52666e]">{valueFor(applicant, field.key)}</td>)}</tr>)}</tbody></table></div>{applicants.length > 12 && <p className="border-t border-[#edf1f1] px-3 py-2 text-[11px] text-[#7c8c91]">Preview shows 12 rows. Printing includes all {applicants.length} filtered applicants.</p>}</div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#60757c]">Cancel</button><button disabled={!selectedFields.length || !applicants.length || printing} onClick={() => setPrinting(true)} data-testid="button-print-selected-roster" className="flex items-center gap-2 rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Printer size={15} /> Print selected fields</button></div>
    </section>
    <div className="print-only">
      <h1>Robotics tryout applicant roster</h1>
      <p>Generated {new Date().toLocaleString()} · {applicants.length} applicants</p>
      <table><thead><tr>{selectedFields.map(field => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{applicants.map(applicant => <tr key={applicant.id}>{selectedFields.map(field => <td key={field.key}>{valueFor(applicant, field.key)}</td>)}</tr>)}</tbody></table>
    </div>
  </div>;
}

function ApplicantDetail({ id, onClose }: { id: string; onClose: () => void }) { const detail = useGetApplicant(id, { query: { enabled: Boolean(id), queryKey: getGetApplicantQueryKey(id) } }); const update = useUpdateApplicant(); const [notes, setNotes] = useState(""); useEffect(() => { if (detail.data) setNotes(detail.data.notes); }, [detail.data]); if (detail.isLoading) return <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[500px] bg-white p-6 shadow-2xl"><Skeleton className="h-8 w-40" /><Skeleton className="mt-8 h-28 w-full" /></div>; if (!detail.data) return null; const a = detail.data; const save = (data: ApplicantUpdate) => update.mutate({ id: a.id, data }); return <div className="fixed inset-0 z-40 bg-[#112433]/25" onClick={onClose}><aside onClick={e => e.stopPropagation()} className="absolute inset-y-0 right-0 w-full max-w-[520px] overflow-y-auto bg-[#f8faf9] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#16869a]">Applicant file / {a.id.slice(0,8)}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.05em]">{a.name}</h2><p className="mt-1 text-sm text-[#718189]">Grade {a.grade} · {a.email || "No email provided"}</p></div><IconButton label="Close applicant detail" testId="button-close-detail" onClick={onClose}><X size={17} /></IconButton></div><div className="mt-7 grid grid-cols-2 gap-3"><StatCard label="AI score" value={a.aiScore.toFixed(1)} suffix="/ 10" tone="yellow" /><div className="rounded-2xl border border-[#dce5e5] bg-white p-4"><p className="text-xs uppercase tracking-[.12em] text-[#72838a]">Recommendation</p><div className="mt-3"><Badge tone={a.aiRecommendation.toLowerCase().includes("advance") ? "teal" : "yellow"}>{a.aiRecommendation}</Badge></div></div></div><div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><h3 className="font-semibold">AI readout</h3><p className="mt-3 text-sm leading-6 text-[#52666e]">{a.aiSummary || "No summary available."}</p><div className="mt-4 grid gap-3 text-xs"><div><p className="font-bold uppercase tracking-[.1em] text-[#16869a]">Strengths</p><p className="mt-1 text-[#64777d]">{a.aiStrengths || "Not listed"}</p></div><div><p className="font-bold uppercase tracking-[.1em] text-[#bd5047]">Concerns</p><p className="mt-1 text-[#64777d]">{a.aiConcerns || "Not listed"}</p></div></div></div><div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Coordinator decision</h3>{update.isSuccess && <span className="text-xs font-semibold text-[#168069]">Saved</span>}</div><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[#63747c]">Category<select defaultValue={a.category} onChange={e => save({ category: e.target.value })} data-testid="select-detail-category" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-2 text-sm text-[#182232]"><option value="">Unranked</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label><label className="text-xs font-semibold text-[#63747c]">Interview status<select defaultValue={a.interviewStatus} onChange={e => save({ interviewStatus: e.target.value })} data-testid="select-detail-status" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-2 text-sm text-[#182232]">{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></label></div><label className="mt-4 block text-xs font-semibold text-[#63747c]">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} data-testid="textarea-applicant-notes" className="mt-1 min-h-[110px] w-full resize-y rounded-lg border border-[#d5e0e0] bg-white p-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" placeholder="Capture the human signal..." /></label><button onClick={() => save({ notes })} data-testid="button-save-notes" className="mt-3 flex items-center gap-2 rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white"><Check size={15} /> Save notes</button></div><div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><h3 className="font-semibold">Application evidence</h3><p className="mt-3 text-sm leading-6 text-[#64777d]">{a.transcript || "No transcript attached."}</p></div></aside></div>; }

function Queue() {
  const queue = useGetQueue({ query: { queryKey: getGetQueueQueryKey(), refetchInterval: 3000 } });
  const chat = useGetInterviewChat({ query: { queryKey: getGetInterviewChatQueryKey(), refetchInterval: 3000 } });
  const advance = useAdvanceQueue();
  const reorder = useReorderQueue();
  const updateApplicant = useUpdateApplicant();
  const updateSettings = useUpdateQueueSettings();
  const resetQueue = useResetQueue();
  const sendChat = useSendInterviewChat();
  const ask = useAskAssistant();
  const qc = useQueryClient();
  const [order, setOrder] = useState<QueueApplicant[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("selected-interviewer") || "");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!queue.data) return;
    setOrder(queue.data.nextApplicants);
    setLabels(queue.data.interviewerLabels);
  }, [queue.data]);
  if (queue.isLoading) return <><PageHeading eyebrow="Interview bay / live" title="Queue control" /><Skeleton className="h-64" /></>;
  if (queue.isError || !queue.data) return <ErrorState onRetry={() => queue.refetch()} />;
  const q = queue.data;
  const visibleApplicants = selectedInterviewer
    ? q.currentApplicants.filter(applicant => applicant.interviewer === selectedInterviewer)
    : [];
  const unassignedApplicant = q.currentApplicants.find(applicant => !applicant.interviewer);
  const saveNote = (id: string, note: string, original: string) => {
    if (note !== original) updateApplicant.mutate({ id, data: { notes: note } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }) });
  };
  const assignInterviewer = (id: string, interviewer: string) => {
    updateApplicant.mutate({ id, data: { interviewer } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }) });
  };
  const finishApplicant = (id: string) => {
    advance.mutate({ data: { applicantId: id } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }) });
  };
  const move = (id: string, direction: -1 | 1) => {
    const index = order.findIndex(item => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setOrder(next);
    reorder.mutate({ data: { applicantIds: [...q.currentApplicants.map(item => item.id), ...next.map(item => item.id)] } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }) });
  };
  const saveLabels = () => {
    const clean = [...new Set(labels.map(label => label.trim()).filter(Boolean))];
    if (clean.length) updateSettings.mutate({ data: { interviewerLabels: clean } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }) });
  };
  const resetInterviewProgress = () => {
    if (!window.confirm("Reset interview progress for all applicants? Applicant data, notes, and decisions will be preserved.")) return;
    resetQueue.mutate(undefined, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }) });
  };
  const submitChat = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    const submitted = message.trim();
    setMessage("");
    if (/@ai\b/i.test(submitted)) {
      const question = submitted.replace(/@ai\b/ig, "").trim() || "Give me a quick read on the active applicants.";
      ask.mutate({ data: { question, applicantIds: visibleApplicants.map(applicant => applicant.id) } }, {
        onSuccess: response => sendChat.mutate({ data: { author: "AI assistant", message: response.answer } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey() }) }),
      });
      return;
    }
    sendChat.mutate({ data: { author: selectedInterviewer || "Interviewer", message: submitted } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey() }) });
  };
  return <div className="fade-up">
    <PageHeading eyebrow="Interview bay / live queue" title="Interview workspace" detail="Choose your interviewer identity, review the complete applicant file, and keep the other interviewer in the loop." action={<div className="flex flex-wrap items-center gap-3 text-xs text-[#60757c]"><span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[#28a47f]" />Live sync every 3 seconds</span><button onClick={resetInterviewProgress} disabled={resetQueue.isPending} data-testid="button-reset-interview-progress" className="flex items-center gap-1.5 rounded-lg border border-[#d7b0ad] px-3 py-2 font-semibold text-[#a14b43] hover:bg-[#fff2f0] disabled:opacity-50"><RefreshCw size={13} />{resetQueue.isPending ? "Resetting..." : "Reset progress"}</button></div>} />
    <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dce5e5] bg-white p-4">
      <div><p className="text-sm font-semibold">I am working as</p><p className="mt-1 text-xs text-[#7c8c91]">This controls which assigned applicant files you see and labels your chat messages.</p></div>
      <div className="flex flex-wrap items-center gap-2">{q.interviewerLabels.map(label => <button key={label} onClick={() => { setSelectedInterviewer(label); window.localStorage.setItem("selected-interviewer", label); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${selectedInterviewer === label ? "border-[#16869a] bg-[#e3f4f2] text-[#12737d]" : "border-[#d5e0e0] bg-white text-[#52666e] hover:border-[#16869a]"}`} data-testid={`button-select-${label.toLowerCase().replaceAll(" ", "-")}`}>{label}</button>)}<a href="#interviewer-settings" className="rounded-xl border border-dashed border-[#b8cbcc] px-3 py-2 text-xs font-semibold text-[#527079] hover:border-[#16869a] hover:text-[#16869a]">+ Add interviewer</a></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="relative overflow-hidden rounded-3xl bg-[#172a3a] p-7 text-white">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full border border-[#f8c84a]/20" />
        <div className="relative">
          <div className="flex items-center justify-between"><Badge tone="yellow">Interviewing now</Badge><span className="mono text-xs text-[#89a4ab]">{visibleApplicants.length} assigned to you / {q.currentApplicants.length} active</span></div>
          <div className={`mt-8 grid gap-4 ${visibleApplicants.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
            {visibleApplicants.length ? visibleApplicants.map((applicant, index) => <InterviewApplicantCard key={applicant.id} applicant={applicant} index={index} interviewerLabels={q.interviewerLabels} onAssign={assignInterviewer} onSaveNote={saveNote} onFinish={finishApplicant} onUpdate={data => updateApplicant.mutate({ id: applicant.id, data }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }) })} />) : <div className="py-10 text-[#acc2c7]"><p>{selectedInterviewer ? `No applicant is assigned to ${selectedInterviewer} right now.` : "Select your interviewer identity to see your applicant."}</p>{selectedInterviewer && unassignedApplicant && <button onClick={() => assignInterviewer(unassignedApplicant.id, selectedInterviewer)} disabled={updateApplicant.isPending} data-testid="button-claim-next-applicant" className="mt-4 rounded-lg bg-[#f8c84a] px-4 py-2.5 text-xs font-bold text-[#182232] disabled:opacity-50">Claim next available applicant</button>}</div>}
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-[#dce5e5] bg-white p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">Interviewer chat</h2><p className="mt-1 text-xs text-[#7c8c91]">Type <strong>@ai</strong> for an applicant-aware response.</p></div><Bot size={20} className="text-[#16869a]" /></div>
        <div className="mt-4 h-[330px] space-y-3 overflow-y-auto rounded-xl bg-[#f5f8f7] p-3">{chat.data?.items.length ? chat.data.items.map(item => <div key={item.id} className="rounded-xl border border-[#e1e9e8] bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#183a4b]">{item.author}</span><span className="text-[10px] text-[#8a999d]">{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><p className="mt-1 text-sm leading-5 text-[#52666e]">{item.message}</p></div>) : <p className="py-24 text-center text-sm text-[#7c8c91]">No messages yet. Leave a note for the other interviewer.</p>}</div>
        <form onSubmit={submitChat} className="mt-3 space-y-2"><div className="flex gap-2"><span className="flex h-10 w-32 items-center rounded-lg border border-[#d5e0e0] bg-[#f7faf9] px-3 text-xs font-semibold text-[#52666e]">{selectedInterviewer || "Choose role"}</span><input value={message} onChange={event => setMessage(event.target.value)} data-testid="input-interviewer-chat" className="h-10 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] px-3 text-sm outline-none focus:border-[#16869a]" placeholder="Message the other interviewer or type @ai..." /><button disabled={!message.trim() || sendChat.isPending || ask.isPending} data-testid="button-send-interviewer-chat" className="rounded-lg bg-[#183a4b] px-3 text-xs font-semibold text-white disabled:opacity-50">Send</button></div></form>
      </section>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <Section title="Queue progress" kicker="Applicants advance independently">
        <div className="flex items-end justify-between"><div><p className="mono text-5xl text-[#183a4b]">{q.remainingCount}</p><p className="mt-1 text-sm text-[#718189]">remaining applicants</p></div><div className="text-right"><p className="mono text-2xl text-[#16869a]">{q.completedCount}</p><p className="text-xs text-[#718189]">completed</p></div></div>
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#e8eeee]"><div className="h-full rounded-full bg-[#16869a]" style={{ width: `${(q.completedCount / Math.max(q.completedCount + q.remainingCount, 1)) * 100}%` }} /></div>
        <div className="mt-6 border-t border-[#edf1f1] pt-5"><p className="mono text-[10px] uppercase tracking-[.18em] text-[#16869a]">Up next</p>{q.nextApplicants.length ? q.nextApplicants.map(applicant => <div key={applicant.id} className="mt-3 flex items-center gap-3" data-testid={`next-applicant-${applicant.id}`}><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5f3f1] text-xs font-bold text-[#16869a]">{applicant.name.slice(0, 1)}</div><div><p className="text-sm font-semibold">{applicant.name}</p><p className="text-xs text-[#7c8c91]">Grade {applicant.grade} · score {applicant.aiScore < 0 ? "invalid" : applicant.aiScore.toFixed(1)}</p></div></div>) : <p className="mt-3 text-sm text-[#7c8c91]">Queue is empty.</p>}</div>
      </Section>
      <Section title="Corresponding interviewers" kicker="Add as many interviewers as you need; these labels also appear on the public display.">
        <div id="interviewer-settings" />
        <div className="space-y-2">
          {labels.map((label, index) => <div key={`${label}-${index}`} className="flex items-center gap-2"><span className="mono w-6 text-xs text-[#16869a]">{String(index + 1).padStart(2, "0")}</span><input value={label} onChange={event => setLabels(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="h-10 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] px-3 text-sm outline-none focus:border-[#16869a]" /><button disabled={labels.length <= 1} onClick={() => setLabels(current => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-2 text-xs text-[#bd5047] disabled:opacity-30">Remove</button></div>)}
          <div className="flex flex-wrap gap-2 pt-2"><button onClick={() => setLabels(current => [...current, `Interviewer ${current.length + 1}`])} className="rounded-lg border border-[#cbd9da] px-3 py-2 text-xs font-semibold text-[#385762]">+ Add interviewer</button><button onClick={saveLabels} disabled={updateSettings.isPending} data-testid="button-save-interviewer-labels" className="rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{updateSettings.isPending ? "Saving..." : "Save labels"}</button></div>
        </div>
      </Section>
    </div>
    <section className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Reorder upcoming applicants</h2><p className="mt-1 text-xs text-[#7c8c91]">Reorder the next handoffs without linking applicants into pairs.</p></div><TimerReset size={20} className="text-[#16869a]" /></div><div className="mt-4 grid gap-2 md:grid-cols-2">{order.map((applicant, index) => <div key={applicant.id} draggable onDragStart={() => setDrag(applicant.id)} onDragOver={event => event.preventDefault()} onDrop={() => { if (!drag) return; const from = order.findIndex(item => item.id === drag); const next = [...order]; const [item] = next.splice(from, 1); next.splice(index, 0, item); setOrder(next); setDrag(null); reorder.mutate({ data: { applicantIds: [...q.currentApplicants.map(current => current.id), ...next.map(item => item.id)] } }); }} className="flex items-center gap-3 rounded-xl border border-[#e1e9e8] p-3" data-testid={`queue-order-${applicant.id}`}><GripVertical size={15} className="text-[#b5c3c6]" /><span className="mono w-5 text-xs text-[#16869a]">{String(index + 1).padStart(2, "0")}</span><span className="flex-1 text-sm font-semibold">{applicant.name}</span><button onClick={() => move(applicant.id, -1)} data-testid={`button-move-up-${applicant.id}`} className="text-[#779096] hover:text-[#16869a]">↑</button><button onClick={() => move(applicant.id, 1)} data-testid={`button-move-down-${applicant.id}`} className="text-[#779096] hover:text-[#16869a]">↓</button></div>)}</div></section>
  </div>;
}

const interviewDecisions = ["Undecided", "Strong Yes", "Yes", "Maybe", "No", "Strong No"];

function readableTranscript(raw: string | null | undefined): Array<{ question: string; type: string; typeLabel: string; answer: string; options: string[]; selected: string[] }> {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((entry, index) => {
      if (!entry || typeof entry !== "object") return { question: `Response ${index + 1}`, type: "unknown", typeLabel: "Response", answer: String(entry), options: [], selected: [String(entry)] };
      const record = entry as Record<string, unknown>;
      const answer = record.answer ?? record.response ?? record.value ?? record.text ?? "";
      const type = String(record.type ?? "text").toLowerCase();
      const typeLabel = type === "multi" ? "Choose all that apply" : type === "choice" ? "Choose one" : type === "text" ? "Written response" : type;
      const options = Array.isArray(record.options) ? record.options.map(String) : [];
      const rawAnswer = record.raw ?? answer;
      return {
        question: String(record.question ?? record.prompt ?? record.label ?? `Response ${index + 1}`),
        type,
        typeLabel,
        answer: typeof answer === "string" ? answer : JSON.stringify(answer, null, 2),
        options,
        selected: Array.isArray(rawAnswer) ? rawAnswer.map(String) : [String(rawAnswer)],
      };
    });
  } catch {
    return [{ question: "Submitted responses", type: "unknown", typeLabel: "Response", answer: raw, options: [], selected: [raw] }];
  }
}

function InterviewApplicantCard({ applicant, index, interviewerLabels, onAssign, onSaveNote, onFinish, onUpdate }: {
  applicant: QueueApplicant;
  index: number;
  interviewerLabels: string[];
  onAssign: (id: string, interviewer: string) => void;
  onSaveNote: (id: string, note: string, original: string) => void;
  onFinish: (id: string) => void;
  onUpdate: (data: ApplicantUpdate) => void;
}) {
  const detail = useGetApplicant(applicant.id, { query: { queryKey: getGetApplicantQueryKey(applicant.id), refetchInterval: 5000 } });
  const [notes, setNotes] = useState(applicant.notes);
  useEffect(() => setNotes(detail.data?.notes ?? applicant.notes), [detail.data?.notes, applicant.notes]);
  const a = detail.data;
  const transcript = readableTranscript(a?.transcript);
  const looksMalformed = Boolean(a && (/https?:\/\//i.test(a.name) || /@/.test(a.name) || a.name.length > 60));
  const displayName = looksMalformed ? "Record needs review" : a?.name ?? applicant.name;
  return <article className="rounded-2xl border border-[#365968] bg-[#1d3545] p-5" data-testid={`current-applicant-${applicant.id}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="mono text-[10px] uppercase tracking-[.2em] text-[#7f9da6]">Applicant {index + 1}</p><h2 className="mt-2 break-words text-2xl font-semibold tracking-[-.05em]">{displayName}</h2><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#acc2c7]"><span>Grade {a?.grade ?? applicant.grade}</span><span>·</span><span>{applicant.aiScore < 0 ? "invalid score" : `${applicant.aiScore.toFixed(1)} AI score`}</span></p>{looksMalformed && <p className="mt-2 break-all text-xs text-[#d2e1e3]">Imported name: {a?.name}</p>}{looksMalformed && <p className="mt-2 text-xs font-semibold text-[#f8c84a]">This applicant record looks malformed. Verify it before making a decision.</p>}</div>
      <div className="flex shrink-0 gap-2"><button onClick={() => onUpdate({ callbackRequested: !applicant.callbackRequested })} data-testid={`button-callback-${applicant.id}`} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${applicant.callbackRequested ? "border-[#f8c84a] bg-[#fff3cf] text-[#805c08]" : "border-[#668795] text-[#d2e1e3]"}`}><PhoneCall size={13} />{applicant.callbackRequested ? "Callback requested" : "Request callback"}</button><button onClick={() => onFinish(applicant.id)} disabled={detail.isLoading} data-testid={`button-finish-applicant-${applicant.id}`} className="rounded-lg bg-[#f8c84a] px-3 py-2 text-xs font-bold text-[#182232] disabled:opacity-50">Finish</button></div>
    </div>
    {detail.isLoading ? <div className="mt-5 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-24" /></div> : a && <details open className="mt-5 rounded-xl border border-[#486b77] bg-[#162d3d] p-4"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-[.12em] text-[#d2e1e3]">Full applicant file</summary>
      <div className="mt-4 grid gap-4 text-sm text-[#d2e1e3]">
        <div className="grid gap-2 sm:grid-cols-2"><p className="flex min-w-0 items-start gap-2 break-all"><Mail size={14} className="mt-0.5 shrink-0 text-[#f8c84a]" />{a.email || "No email provided"}</p><p className="text-[#acc2c7]">Interview status: <strong className="text-white">{a.interviewStatus}</strong></p></div>
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#f8c84a]">Application responses</p><div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-[#1d3545] p-3"><p className="text-[10px] uppercase text-[#7f9da6]">Robotics experience</p><p className="mt-1">{a.roboticsExperience || "Not provided"}</p></div><div className="rounded-lg bg-[#1d3545] p-3"><p className="text-[10px] uppercase text-[#7f9da6]">10-hour commitment</p><p className="mt-1">{a.commit10Hours || "Not provided"}</p></div><div className="rounded-lg bg-[#1d3545] p-3"><p className="text-[10px] uppercase text-[#7f9da6]">Parent volunteer</p><p className="mt-1">{a.parentVolunteer || "Not provided"}</p></div></div></div>
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#f8c84a]">Questions, types, choices, and submitted answers</p>{transcript.length ? <div className="space-y-3">{transcript.map((item, responseIndex) => <div key={`${item.question}-${responseIndex}`} className="rounded-lg bg-[#1d3545] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 flex-1 break-words text-sm font-semibold text-white">{item.question}</p><span className="shrink-0 rounded-full border border-[#5d8790] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#a8c8cb]">{item.typeLabel}</span></div>{item.options.length > 0 && <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7f9da6]">Choices</p><div className="mt-2 flex flex-wrap gap-2">{item.options.map(option => <span key={option} className={`rounded-md border px-2 py-1 text-xs ${item.selected.includes(option) ? "border-[#51d2ad] bg-[#204f50] text-[#d8fff0]" : "border-[#486b77] text-[#a9c0c4]"}`}>{item.selected.includes(option) ? "✓ " : ""}{option}</span>)}</div></div>}<p className="mt-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#7f9da6]">Submitted answer</p><p className="mt-1 whitespace-pre-wrap break-words leading-6 text-[#d2e1e3]">{item.answer || "No answer provided."}</p></div>)}</div> : <p className="leading-6 text-[#d2e1e3]">No transcript or additional responses were provided.</p>}</div>
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#f8c84a]">AI readout</p><p className="leading-6">{a.aiSummary || "No AI summary available."}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p><strong className="text-[#51d2ad]">Strengths:</strong> {a.aiStrengths || "Not listed"}</p><p><strong className="text-[#ff9b8f]">Concerns:</strong> {a.aiConcerns || "Not listed"}</p></div></div>
      </div>
    </details>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold text-[#b6cbd0]">Corresponding interviewer<select value={applicant.interviewer} onChange={event => onAssign(applicant.id, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#486b77] bg-[#162d3d] px-3 text-sm text-white"><option value="">Unassigned</option>{interviewerLabels.map(label => <option key={label} value={label}>{label}</option>)}</select></label><label className="block text-xs font-semibold text-[#b6cbd0]">Interview decision<select value={applicant.interviewDecision} onChange={event => onUpdate({ interviewDecision: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#486b77] bg-[#162d3d] px-3 text-sm font-semibold text-white">{interviewDecisions.map(decision => <option key={decision} value={decision}>{decision}</option>)}</select></label></div>
    <label className="mt-4 block text-xs font-semibold text-[#b6cbd0]">Private interviewer notes<textarea value={notes} onChange={event => setNotes(event.target.value)} onBlur={() => onSaveNote(applicant.id, notes, applicant.notes)} placeholder="Capture interview signal..." className="mt-1 min-h-[82px] w-full resize-y rounded-lg border border-[#486b77] bg-[#162d3d] p-3 text-sm font-normal text-white outline-none placeholder:text-[#74919a] focus:border-[#f8c84a]" /></label>
  </article>;
}

function DisplayGallery() {
  return <div className="mx-auto mt-6 grid max-h-[24vh] max-w-6xl grid-cols-2 gap-3 overflow-hidden text-left md:grid-cols-6">
    {officialDisplayImages.slice(1).map((src, index) => <img key={src} src={src} alt={`Official Wolverines team and portfolio image ${index + 1}`} className={`${index === 0 ? "col-span-2 row-span-2 aspect-[4/3] md:col-span-2 md:row-span-2" : "aspect-[4/3]"} w-full rounded-2xl border border-[#39616d] object-cover opacity-80 transition-opacity hover:opacity-100`} />)}
  </div>;
}

function Display() {
  const display = useGetDisplayState({ query: { queryKey: getGetDisplayStateQueryKey(), refetchInterval: 3000 } }); const lastUpdate = useRef(""); const audioRef = useRef<HTMLAudioElement>(null); const [audioReady, setAudioReady] = useState(false);
  useEffect(() => { if (display.data && display.data.updatedAt !== lastUpdate.current) { if (lastUpdate.current && audioReady) { const audio = audioRef.current; if (audio) { audio.src = `${import.meta.env.BASE_URL}api/display/announcement`; audio.play().catch(() => undefined); } } lastUpdate.current = display.data.updatedAt; } }, [display.data, audioReady]);
  if (display.isLoading) return <div className="min-h-[100dvh] bg-[#0d1b28] p-12 text-white"><Skeleton className="h-10 w-48" /></div>; if (display.isError || !display.data) return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0d1b28] text-white"><ErrorState compact onRetry={() => display.refetch()} /></div>;
  const d = display.data as DisplayState; const applicants = d.currentApplicants ?? [];
  return <main className="display-grid noise relative flex h-[100dvh] flex-col overflow-hidden bg-[#0d1b28] text-white" data-testid="display-screen"><div className="scanline absolute left-0 top-[31%] h-px w-full opacity-50" /><header className="relative flex shrink-0 items-center justify-between p-5 md:p-7"><Logo dark /><div className="flex items-center gap-3"><div className="hidden h-10 w-28 overflow-hidden rounded-xl border border-[#39616d] opacity-80 sm:block"><img src={officialDisplayImages[0]} alt="Wolverines team" className="h-full w-full object-cover" /></div><button onClick={() => setAudioReady(!audioReady)} data-testid="button-display-audio" className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${audioReady ? "border-[#51d2ad] text-[#51d2ad]" : "border-[#617d86] text-[#a7bdc3]"}`}><Volume2 size={15} /> {audioReady ? "Announcements on" : "Enable audio"}</button><span className="hidden h-2 w-2 animate-pulse rounded-full bg-[#51d2ad] sm:block" /></div></header><section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-7 py-4 text-center md:px-16"><p className="mono text-xs uppercase tracking-[.32em] text-[#f8c84a]">{d.mode || "Live interview queue"}</p><h1 className="mt-4 text-[clamp(2.4rem,6.5vw,6.8rem)] font-semibold leading-[.9] tracking-[-.07em]">{d.headline || "Please come to your corresponding interviewer"}</h1><p className="mx-auto mt-3 max-w-2xl text-[clamp(1rem,2vw,1.45rem)] text-[#9db6bd]">{d.subheadline || "Your Wolverines interview team is ready for you."}</p>{applicants.length > 0 && <div className="mx-auto mt-8 grid max-h-[45vh] w-full max-w-4xl gap-5 overflow-hidden sm:grid-cols-2">{applicants.map((applicant) => <div key={applicant.id} className="relative overflow-hidden rounded-3xl border border-[#39616d] bg-[#142c3b]/80 px-6 py-7 text-left backdrop-blur-sm" data-testid={`display-applicant-${applicant.id}`}><span className="mono text-[10px] uppercase tracking-[.25em] text-[#6f9ba2]">Corresponding interviewer</span><p className="mt-4 break-words text-3xl font-semibold tracking-[-.04em] md:text-5xl">{applicant.name}</p><p className="mt-2 text-sm text-[#9db6bd]">Grade {applicant.grade} <span className="mx-2 text-[#4a7180]">/</span> {applicant.lane}</p><div className="absolute bottom-0 left-0 h-1 w-full bg-[#f8c84a]" /></div>)}</div>}{!applicants.length && <DisplayGallery />}</section><footer className="flex shrink-0 items-end justify-between p-5 md:p-7"><span className="mono text-[10px] uppercase tracking-[.2em] text-[#66848d]">Wolverines / Team 23442 · All Claws on Deck! · PLMS · Sammamish, Washington · Spencer & Tesla leagues</span><span className="mono text-[10px] text-[#66848d]">{new Date(d.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></footer><audio ref={audioRef} onCanPlay={() => setAudioReady(true)} preload="none" data-testid="display-announcement-audio" /></main>;
}

function Assistant() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const ask = useAskAssistant();
  const persisted = useGetAssistantHistory({ query: { queryKey: getGetAssistantHistoryQueryKey() } });
  const list = useListApplicants({ sort: "rank" }, { query: { queryKey: getListApplicantsQueryKey({ sort: "rank" }) } });
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (persisted.data) setHistory(persisted.data.items.map(item => ({ q: item.question, a: item.answer })));
  }, [persisted.data]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    ask.mutate({ data: { question: q, applicantIds: selected.length ? selected : undefined } }, { onSuccess: r => setHistory(h => [...h, { q, a: r.answer }]) });
  };
  const prompts = ["Who are the strongest builders with 10+ hours?", "Compare the top two unranked applicants.", "Which concerns need a human follow-up?"];
  return <div className="fade-up"><PageHeading eyebrow="Decision support / AI workspace" title="Ask the room." detail="A filter-aware second set of eyes. Bring a question; keep the final call human." action={<Badge tone="blue"><Sparkles size={12} className="mr-1" /> Context: {selected.length ? `${selected.length} selected` : "all applicants"}</Badge>} /><div className="grid gap-5 xl:grid-cols-[1fr_330px]"><section className="min-h-[560px] rounded-2xl border border-[#dce5e5] bg-white p-5"><div className="flex items-center gap-3 border-b border-[#edf1f1] pb-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f4f2] text-[#16869a]"><Bot size={21} /></div><div><h2 className="font-semibold">Control room assistant</h2><p className="text-xs text-[#7c8c91]">Applicant data and assistant history stay inside this workspace.</p></div></div><div className="space-y-5 py-6">{!history.length && !ask.isPending && <div className="py-12 text-center"><p className="text-lg font-semibold">What should we look at?</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7c8c91]">Ask for a shortlist, a comparison, or a question to use in the interview bay.</p><div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">{prompts.map((p, i) => <button key={p} onClick={() => setQuestion(p)} data-testid={`button-prompt-${i}`} className="rounded-full border border-[#cfe1e1] px-3 py-2 text-xs text-[#44646d] transition hover:border-[#16869a] hover:text-[#16869a]">{p}</button>)}</div></div>}{history.map((h, i) => <div key={`${h.q}-${i}`} className="space-y-3"><div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#edf4f3] px-4 py-3 text-sm text-[#38555e]" data-testid={`assistant-question-${i}`}>{h.q}</div><div className="flex max-w-[90%] gap-3 rounded-2xl rounded-bl-sm border border-[#e3ebeb] px-4 py-4 text-sm leading-6 text-[#52666e]" data-testid={`assistant-answer-${i}`}><Bot size={17} className="mt-1 shrink-0 text-[#16869a]" /><span>{h.a}</span></div></div>)}{ask.isPending && <div className="flex items-center gap-3 text-sm text-[#7c8c91]" data-testid="assistant-loading"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a] [animation-delay:100ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a] [animation-delay:200ms]" /></span>Reading the field...</div>}{ask.isError && <p className="text-sm text-[#b34a42]" data-testid="assistant-error">The assistant could not answer that just now. Try again.</p>}</div><form onSubmit={submit} className="flex gap-2 border-t border-[#edf1f1] pt-4"><input value={question} onChange={e => setQuestion(e.target.value)} data-testid="input-assistant-question" placeholder="Ask about the applicants..." className="h-12 flex-1 rounded-xl border border-[#d5e0e0] px-4 text-sm outline-none focus:border-[#16869a]" /><button disabled={ask.isPending || !question.trim()} data-testid="button-ask-assistant" className="flex h-12 items-center gap-2 rounded-xl bg-[#183a4b] px-5 text-sm font-semibold text-white disabled:opacity-45"><ArrowRight size={16} /> Ask</button></form></section><Section title="Focus the context" kicker="Optional: select applicants for a sharper answer"><div className="space-y-2">{list.isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-12" />) : list.data?.items.slice(0,8).map(a => <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#f1f6f5]"><input type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(s => e.target.checked ? [...s,a.id] : s.filter(x => x !== a.id))} data-testid={`checkbox-assistant-${a.id}`} className="h-4 w-4 accent-[#16869a]" /><span className="min-w-0 flex-1 truncate text-xs font-medium">{a.name}</span><span className="mono text-[10px] text-[#16869a]">{a.aiScore.toFixed(1)}</span></label>)}</div>{selected.length > 0 && <button onClick={() => setSelected([])} data-testid="button-clear-assistant-selection" className="mt-4 text-xs font-semibold text-[#16869a]">Clear selection</button>}</Section></div></div>;
}

function Router() { return <ErrorBoundary><Switch><Route path="/" component={Login} /><Route path="/dashboard"><Shell><Dashboard /></Shell></Route><Route path="/applicants"><Shell><Applicants /></Shell></Route><Route path="/queue"><Shell><Queue /></Shell></Route><Route path="/display" component={Display} /><Route path="/assistant"><Shell><Assistant /></Shell></Route><Route component={NotFound} /></Switch></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;