import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trophy,
  X,
} from "lucide-react";
import {
  getGetFtcEventProfileQueryKey,
  getGetFtcTeamProfileQueryKey,
  useGetFtcEventProfile,
  useGetFtcTeamProfile,
} from "@workspace/api-client-react";
import type { FtcEvent, FtcTeam } from "@workspace/api-client-react";
import { ModalOverlay } from "./ModalOverlay";

export type FtcMentionReference =
  | { kind: "team"; season: number; teamNumber: number }
  | { kind: "event"; season: number; eventCode: string };

type FtcMentionContextValue = { open: (reference: FtcMentionReference) => void };
const FtcMentionContext = createContext<FtcMentionContextValue | null>(null);

function sameReference(left: FtcMentionReference, right: FtcMentionReference): boolean {
  return left.kind === right.kind
    && left.season === right.season
    && (left.kind === "team"
      ? right.kind === "team" && left.teamNumber === right.teamNumber
      : right.kind === "event" && left.eventCode === right.eventCode);
}

function referenceTitle(reference: FtcMentionReference): string {
  return reference.kind === "team"
    ? `FTC Team ${reference.teamNumber}`
    : `FTC Event ${reference.eventCode}`;
}

export function ChatFtcMentionProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<FtcMentionReference[]>([]);
  const context = useMemo(() => ({
    open: (reference: FtcMentionReference) => setHistory([reference]),
  }), []);
  const reference = history[history.length - 1];
  return (
    <FtcMentionContext.Provider value={context}>
      {children}
      {reference && (
        <FtcMentionDialog
          reference={reference}
          previousReference={history.length > 1 ? history[history.length - 2] : undefined}
          onNavigate={nextReference => setHistory(current => {
            const currentReference = current[current.length - 1];
            if (currentReference && sameReference(currentReference, nextReference)) return current;
            return [...current, nextReference];
          })}
          onBack={() => setHistory(current => current.slice(0, -1))}
          onClose={() => setHistory([])}
        />
      )}
    </FtcMentionContext.Provider>
  );
}

export function ChatFtcMentionToken({ reference }: { reference: FtcMentionReference }) {
  const context = useContext(FtcMentionContext);
  const label = reference.kind === "team"
    ? `@${reference.teamNumber}`
    : `@${reference.eventCode}`;
  const accessibleLabel = reference.kind === "team"
    ? `FTC Team ${reference.teamNumber}, ${reference.season} season. Open team details.`
    : `FTC event ${reference.eventCode}, ${reference.season} season. Open event details.`;
  return (
    <button
      type="button"
      onClick={() => context?.open(reference)}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className="chat-ftc-mention"
      data-testid={`chat-ftc-mention-${reference.kind}-${reference.kind === "team" ? reference.teamNumber : reference.eventCode.toLowerCase()}`}
    >
      {label}
    </button>
  );
}

function formatEventDate(date: string | null): string | null {
  const value = date?.trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function officialHref(url: string | null): string | null {
  const value = url?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return parsed.toString();
}

function ProfileField({ label, value, isLink = false }: { label: string; value: string | number | null; isLink?: boolean }) {
  const text = typeof value === "string" ? value.trim() : value == null ? "" : String(value);
  const href = isLink && text ? officialHref(text) : null;
  return (
    <div className="min-w-0 rounded-lg bg-white/75 px-3 py-2 dark:bg-[#122630]/70">
      <dt className="text-[10px] font-bold uppercase tracking-[.1em] text-[#5b6f76] dark:text-[#b2c1c7]">{label}</dt>
      <dd className="mt-1 break-words text-sm leading-5 text-[#344e58] dark:text-[#d6e1e5]" data-testid={`ftc-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
        {href
          ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 max-w-full items-center gap-1 break-all font-medium text-[#126d7b] underline decoration-[#9dc9cc] underline-offset-2 transition hover:text-[#0c5360] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:text-[#8fd7e0] dark:decoration-[#527a83] dark:hover:text-[#b5edf1] dark:focus-visible:outline-[#8fd7e0]">{text}<ExternalLink size={12} className="shrink-0" aria-hidden="true" /></a>
          : text || <span className="italic text-[#61747a] dark:text-[#a9bbc2]">Not listed</span>}
      </dd>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-[.1em] text-[#5d7178] dark:text-[#b2c1c7]">{children}</h3>;
}

function TeamFields({ team }: { team: FtcTeam }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <SectionLabel>Team identity</SectionLabel>
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <ProfileField label="Team number" value={team.teamNumber} />
          <ProfileField label="Display team number" value={team.displayTeamNumber} />
          <ProfileField label="Full name" value={team.nameFull} />
          <ProfileField label="Short name" value={team.nameShort} />
        </dl>
      </div>
      <div className="space-y-2">
        <SectionLabel>School and location</SectionLabel>
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <ProfileField label="School" value={team.schoolName} />
          <ProfileField label="City" value={team.city} />
          <ProfileField label="State or province" value={team.stateProv} />
          <ProfileField label="Country" value={team.country} />
        </dl>
      </div>
      <div className="space-y-2">
        <SectionLabel>Team details</SectionLabel>
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <ProfileField label="Website" value={team.website} isLink />
          <ProfileField label="Rookie year" value={team.rookieYear} />
          <ProfileField label="Robot name" value={team.robotName} />
          <ProfileField label="Home region" value={team.homeRegion} />
        </dl>
      </div>
    </div>
  );
}

function EventFields({ event }: { event: FtcEvent }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <SectionLabel>Event details</SectionLabel>
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <ProfileField label="Season" value={event.season} />
          <ProfileField label="Event code" value={event.code} />
          <ProfileField label="Name" value={event.name} />
          <ProfileField label="Type" value={event.typeName} />
          <ProfileField label="Start date" value={formatEventDate(event.dateStart)} />
          <ProfileField label="End date" value={formatEventDate(event.dateEnd)} />
        </dl>
      </div>
      <div className="space-y-2">
        <SectionLabel>Location</SectionLabel>
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <ProfileField label="Venue" value={event.venue} />
          <ProfileField label="City" value={event.city} />
          <ProfileField label="State or province" value={event.stateProv} />
          <ProfileField label="Country" value={event.country} />
        </dl>
      </div>
      <div className="space-y-2">
        <SectionLabel>Official links</SectionLabel>
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <ProfileField label="Website" value={event.website} isLink />
          <ProfileField label="Live stream" value={event.liveStreamUrl} isLink />
        </dl>
      </div>
    </div>
  );
}

function FtcMentionDialog({
  reference,
  previousReference,
  onNavigate,
  onBack,
  onClose,
}: {
  reference: FtcMentionReference;
  previousReference?: FtcMentionReference;
  onNavigate: (reference: FtcMentionReference) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const title = referenceTitle(reference);
  return (
    <ModalOverlay onClose={onClose} label={title} testId="dialog-ftc-mention" className="flex max-h-[min(90dvh,760px)] max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#d7e4e5] bg-white shadow-2xl sm:rounded-3xl dark:border-[#304955] dark:bg-[#12232d]">
      <div className="flex shrink-0 items-start gap-3 border-b border-[#e5eded] px-5 py-4 dark:border-[#304955]">
        {previousReference && (
          <button
            type="button"
            onClick={onBack}
            aria-label={`Back to ${referenceTitle(previousReference)}`}
            data-testid="button-back-ftc-details"
            className="flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#126d7b] transition hover:bg-[#eef4f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:text-[#8fd7e0] dark:hover:bg-[#203742] dark:focus-visible:outline-[#8fd7e0]"
          >
            <ChevronLeft size={17} aria-hidden="true" />
            Back
          </button>
        )}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e4f3f1] text-[#137989] dark:bg-[#203f48] dark:text-[#8fd7e0]">
          {reference.kind === "team" ? <Award size={20} /> : <CalendarDays size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#16869a] dark:text-[#6fc3cf]">FIRST Tech Challenge · {reference.season}</p>
          <h2 className="mt-1 break-words text-lg font-bold leading-6 text-[#183a4b] dark:text-[#edf5f7]" data-testid="text-ftc-profile-title">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close FTC details" data-testid="button-close-ftc-details" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#667b83] transition hover:bg-[#eef4f4] hover:text-[#183a4b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:text-[#a9bbc2] dark:hover:bg-[#203742] dark:hover:text-white dark:focus-visible:outline-[#8fd7e0]"><X size={17} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {reference.kind === "team"
          ? <FtcTeamDetails reference={reference} onNavigate={onNavigate} />
          : <FtcEventDetails reference={reference} onNavigate={onNavigate} />}
      </div>
    </ModalOverlay>
  );
}

function FtcTeamDetails({
  reference,
  onNavigate,
}: {
  reference: Extract<FtcMentionReference, { kind: "team" }>;
  onNavigate: (reference: FtcMentionReference) => void;
}) {
  const query = useGetFtcTeamProfile(reference.teamNumber, { season: reference.season }, {
    query: {
      queryKey: getGetFtcTeamProfileQueryKey(reference.teamNumber, { season: reference.season }),
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  });
  if (query.isLoading) return <LoadingProfile label="Loading official team details…" />;
  if (query.isError || !query.data) return <ErrorProfile onRetry={() => void query.refetch()} />;
  const { team, events } = query.data;
  if (!team) return <p className="rounded-xl bg-[#fff7e2] p-4 text-sm text-[#79580e] dark:bg-[#352e1a] dark:text-[#f0d77c]">This team is not listed for the {reference.season} season.</p>;
  return <TeamProfile team={team} events={events} season={reference.season} onNavigate={onNavigate} />;
}

function TeamProfile({
  team,
  events,
  season,
  onNavigate,
}: {
  team: FtcTeam;
  events: FtcEvent[];
  season: number;
  onNavigate: (reference: FtcMentionReference) => void;
}) {
  const teamName = team.nameFull?.trim() || team.nameShort?.trim() || team.schoolName?.trim() || `Team ${team.teamNumber}`;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8e8e7] bg-[#f5faf9] p-4 dark:border-[#2c4b55] dark:bg-[#182f39]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-[#16869a] dark:text-[#6fc3cf]">FTC {team.displayTeamNumber?.trim() || team.teamNumber}</p>
            <h3 className="mt-1 break-words text-xl font-bold tracking-tight text-[#183a4b] dark:text-[#edf5f7]" data-testid="text-ftc-team-name">{teamName}</h3>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#16869a] shadow-sm dark:bg-[#203b46] dark:text-[#8fd7e0]"><Trophy size={19} /></span>
        </div>
        <div className="mt-4"><TeamFields team={team} /></div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionLabel>Events this season</SectionLabel>
          <span className="text-xs font-medium text-[#61747a] dark:text-[#b0c0c7]">{events.length} listed</span>
        </div>
        {events.length
          ? <div className="grid gap-2 sm:grid-cols-2">{events.map(event => <EventSummary key={`${season}-${event.code}`} event={event} season={season} onNavigate={onNavigate} />)}</div>
          : <p className="rounded-xl border border-dashed border-[#d2dfdf] px-3 py-4 text-sm text-[#75858a] dark:border-[#35515e] dark:text-[#a9bbc2]">No events are listed for this team in this season.</p>}
      </section>
    </div>
  );
}

function EventSummary({
  event,
  season,
  onNavigate,
}: {
  event: FtcEvent;
  season: number;
  onNavigate: (reference: FtcMentionReference) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate({ kind: "event", season, eventCode: event.code })}
      aria-label={`Open FTC event ${event.code}, ${season} season profile`}
      className="group flex min-h-16 w-full min-w-0 items-start justify-between gap-3 rounded-xl border border-[#e0eaea] bg-white/55 p-3 text-left transition hover:border-[#9dc9cc] hover:bg-[#f5faf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:border-[#304955] dark:bg-[#122630]/45 dark:hover:border-[#527a83] dark:hover:bg-[#182f39] dark:focus-visible:outline-[#8fd7e0]"
      data-testid={`ftc-team-event-${event.code.toLowerCase()}`}
    >
        <span className="min-w-0">
          <span className="block break-words text-sm font-semibold text-[#183a4b] dark:text-[#edf5f7]">{event.name?.trim() || event.code}</span>
          <span className="mt-1 block break-words text-xs font-medium text-[#61747a] dark:text-[#b0c0c7]">{event.code} · {event.typeName?.trim() || "Type not listed"}</span>
        </span>
        <span className="inline-flex min-h-10 shrink-0 items-center gap-1 text-xs font-semibold text-[#126d7b] dark:text-[#8fd7e0]">
          Open event profile
          <ChevronRight size={15} aria-hidden="true" />
        </span>
    </button>
  );
}

function FtcEventDetails({
  reference,
  onNavigate,
}: {
  reference: Extract<FtcMentionReference, { kind: "event" }>;
  onNavigate: (reference: FtcMentionReference) => void;
}) {
  const query = useGetFtcEventProfile(reference.eventCode, { season: reference.season }, {
    query: {
      queryKey: getGetFtcEventProfileQueryKey(reference.eventCode, { season: reference.season }),
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  });
  if (query.isLoading) return <LoadingProfile label="Loading official event details…" />;
  if (query.isError || !query.data) return <ErrorProfile onRetry={() => void query.refetch()} />;
  const { event, teams } = query.data;
  if (!event) return <p className="rounded-xl bg-[#fff7e2] p-4 text-sm text-[#79580e] dark:bg-[#352e1a] dark:text-[#f0d77c]">This event is not listed for the {reference.season} season.</p>;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8e8e7] bg-[#f5faf9] p-4 dark:border-[#2c4b55] dark:bg-[#182f39]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="min-w-0 break-words font-mono text-xs font-bold text-[#16869a] dark:text-[#6fc3cf]">{event.code}{event.typeName ? ` · ${event.typeName}` : ""}</p>
            <h3 className="mt-1 break-words text-xl font-bold tracking-tight text-[#183a4b] dark:text-[#edf5f7]" data-testid="text-ftc-event-name">{event.name?.trim() || event.code}</h3>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#16869a] shadow-sm dark:bg-[#203b46] dark:text-[#8fd7e0]"><CalendarDays size={19} /></span>
        </div>
        <div className="mt-4"><EventFields event={event} /></div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionLabel>Teams attending</SectionLabel>
          <span className="text-xs font-medium text-[#61747a] dark:text-[#b0c0c7]">{teams.length} listed</span>
        </div>
        {teams.length
          ? <div className="grid gap-2 sm:grid-cols-2">{teams.map(team => <TeamSummary key={team.teamNumber} team={team} season={reference.season} onNavigate={onNavigate} />)}</div>
          : <p className="rounded-xl border border-dashed border-[#d2dfdf] px-3 py-4 text-sm text-[#75858a] dark:border-[#35515e] dark:text-[#a9bbc2]">No attending teams are listed yet.</p>}
      </section>
    </div>
  );
}

function TeamSummary({
  team,
  season,
  onNavigate,
}: {
  team: FtcTeam;
  season: number;
  onNavigate: (reference: FtcMentionReference) => void;
}) {
  const teamName = team.nameFull?.trim() || team.nameShort?.trim() || team.schoolName?.trim() || "Official FTC team";
  return (
    <button
      type="button"
      onClick={() => onNavigate({ kind: "team", season, teamNumber: team.teamNumber })}
      aria-label={`Open FTC Team ${team.teamNumber}, ${season} season profile`}
      className="flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e0eaea] bg-white/55 p-3 text-left transition hover:border-[#9dc9cc] hover:bg-[#f5faf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:border-[#304955] dark:bg-[#122630]/45 dark:hover:border-[#527a83] dark:hover:bg-[#182f39] dark:focus-visible:outline-[#8fd7e0]"
      data-testid={`ftc-event-team-${team.teamNumber}`}
    >
        <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e4f3f1] font-mono text-[10px] font-bold text-[#137989] dark:bg-[#203f48] dark:text-[#8fd7e0]"><Award size={14} /></span>
        <span className="min-w-0"><span className="block break-words text-xs font-bold text-[#16869a] dark:text-[#6fc3cf]">FTC {team.displayTeamNumber?.trim() || team.teamNumber}</span><span className="block break-words text-sm font-semibold text-[#183a4b] dark:text-[#edf5f7]">{teamName}</span></span>
        </span>
        <span className="inline-flex min-h-10 shrink-0 items-center gap-1 text-xs font-semibold text-[#126d7b] dark:text-[#8fd7e0]">
          Open team profile
          <ChevronRight size={15} aria-hidden="true" />
        </span>
    </button>
  );
}

function LoadingProfile({ label }: { label: string }) {
  return <div role="status" data-testid="status-ftc-loading" className="flex items-center gap-3 rounded-xl border border-[#dce8e8] bg-[#f7faf9] p-4 text-sm text-[#52666e] dark:border-[#304955] dark:bg-[#182d37] dark:text-[#c1d0d7]"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#16869a] border-t-transparent dark:border-[#6fc3cf] dark:border-t-transparent" />{label}</div>;
}

function ErrorProfile({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" data-testid="status-ftc-error" className="rounded-xl border border-[#e8c8c4] bg-[#fff6f4] p-4 dark:border-[#754943] dark:bg-[#331f20]"><p className="text-sm font-semibold text-[#9f3b33] dark:text-[#efaaa2]">FIRST data could not be loaded.</p><p className="mt-1 text-xs text-[#80534e] dark:text-[#d7a39d]">Check the connection and try again.</p><button type="button" onClick={onRetry} data-testid="button-retry-ftc-details" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#16869a] px-3 text-xs font-semibold text-white hover:bg-[#106d7a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:bg-[#1d7381] dark:hover:bg-[#248a9b] dark:focus-visible:outline-[#8fd7e0]">Retry<ArrowUpRight size={13} /></button></div>;
}
