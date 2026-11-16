import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Award,
  CalendarDays,
  ExternalLink,
  MapPin,
  Radio,
  School,
  Trophy,
  UsersRound,
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

export function ChatFtcMentionProvider({ children }: { children: ReactNode }) {
  const [reference, setReference] = useState<FtcMentionReference | null>(null);
  const context = useMemo(() => ({ open: setReference }), []);
  return (
    <FtcMentionContext.Provider value={context}>
      {children}
      {reference && <FtcMentionDialog reference={reference} onClose={() => setReference(null)} />}
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
  if (!date) return null;
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function eventDateLabel(event: FtcEvent): string | null {
  const start = formatEventDate(event.dateStart);
  const end = formatEventDate(event.dateEnd);
  if (start && end && start !== end) return `${start}–${end}`;
  return start ?? end;
}

function displayLocation(parts: Array<string | null | undefined>): string | null {
  const values = parts.map(value => value?.trim()).filter((value): value is string => Boolean(value));
  return values.length ? values.join(", ") : null;
}

function officialLink(url: string | null, label: string) {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return (
    <a href={parsed.toString()} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#c5d8da] px-3 text-xs font-semibold text-[#126d7b] transition hover:bg-[#eef8f7] dark:border-[#35515e] dark:text-[#8fd7e0] dark:hover:bg-[#1c3843]">
      {label}<ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function DetailLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <p className="flex items-start gap-2 text-sm text-[#52666e] dark:text-[#c1d0d7]"><span className="mt-0.5 shrink-0 text-[#16869a] dark:text-[#6fc3cf]">{icon}</span><span>{children}</span></p>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-[10px] font-bold uppercase tracking-[.12em] text-[#77888d] dark:text-[#9eb0b8]">{children}</h3>;
}

function FtcMentionDialog({ reference, onClose }: { reference: FtcMentionReference; onClose: () => void }) {
  const title = reference.kind === "team"
    ? `FTC Team ${reference.teamNumber}`
    : `FTC Event ${reference.eventCode}`;
  return (
    <ModalOverlay onClose={onClose} label={title} testId="dialog-ftc-mention" className="max-h-[min(90dvh,760px)] max-w-2xl rounded-t-3xl border border-[#d7e4e5] bg-white shadow-2xl sm:rounded-3xl dark:border-[#304955] dark:bg-[#12232d]">
      <div className="flex items-start gap-3 border-b border-[#e5eded] px-5 py-4 dark:border-[#304955]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e4f3f1] text-[#137989] dark:bg-[#203f48] dark:text-[#8fd7e0]">
          {reference.kind === "team" ? <Award size={20} /> : <CalendarDays size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#16869a] dark:text-[#6fc3cf]">FIRST Tech Challenge · {reference.season}</p>
          <h2 className="mt-1 break-words text-lg font-bold leading-6 text-[#183a4b] dark:text-[#edf5f7]" data-testid="text-ftc-profile-title">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close FTC details" data-testid="button-close-ftc-details" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#667b83] transition hover:bg-[#eef4f4] hover:text-[#183a4b] dark:text-[#a9bbc2] dark:hover:bg-[#203742] dark:hover:text-white"><X size={17} /></button>
      </div>
      <div className="max-h-[calc(min(90dvh,760px)-74px)] overflow-y-auto p-5">
        {reference.kind === "team"
          ? <FtcTeamDetails reference={reference} />
          : <FtcEventDetails reference={reference} />}
      </div>
    </ModalOverlay>
  );
}

function FtcTeamDetails({ reference }: { reference: Extract<FtcMentionReference, { kind: "team" }> }) {
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
  return <TeamProfile team={team} events={events} />;
}

function TeamProfile({ team, events }: { team: FtcTeam; events: FtcEvent[] }) {
  const teamName = team.nameFull ?? team.nameShort ?? team.schoolName ?? `Team ${team.teamNumber}`;
  const location = displayLocation([team.city, team.stateProv, team.country]);
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8e8e7] bg-[#f5faf9] p-4 dark:border-[#2c4b55] dark:bg-[#182f39]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-[#16869a] dark:text-[#6fc3cf]">FTC {team.displayTeamNumber ?? team.teamNumber}</p>
            <h3 className="mt-1 break-words text-xl font-bold tracking-tight text-[#183a4b] dark:text-[#edf5f7]" data-testid="text-ftc-team-name">{teamName}</h3>
            {team.schoolName && team.schoolName !== teamName && <p className="mt-1 text-sm text-[#63747c] dark:text-[#a9bbc2]">{team.schoolName}</p>}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#16869a] shadow-sm dark:bg-[#203b46] dark:text-[#8fd7e0]"><Trophy size={19} /></span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {location && <DetailLine icon={<MapPin size={15} />}>{location}</DetailLine>}
          {team.robotName && <DetailLine icon={<Radio size={15} />}>Robot: {team.robotName}</DetailLine>}
          {team.rookieYear && <DetailLine icon={<School size={15} />}>Rookie year: {team.rookieYear}</DetailLine>}
          {team.homeRegion && <DetailLine icon={<UsersRound size={15} />}>Home region: {team.homeRegion}</DetailLine>}
        </div>
        {team.website && <div className="mt-4">{officialLink(team.website, "Team website")}</div>}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionLabel>Events this season</SectionLabel>
          <span className="text-[11px] text-[#7d8c91] dark:text-[#9eb0b8]">{events.length} listed</span>
        </div>
        {events.length
          ? <div className="grid gap-2 sm:grid-cols-2">{events.map(event => <EventSummary key={`${event.season}-${event.code}`} event={event} />)}</div>
          : <p className="rounded-xl border border-dashed border-[#d2dfdf] px-3 py-4 text-sm text-[#75858a] dark:border-[#35515e] dark:text-[#a9bbc2]">No events are listed for this team in this season.</p>}
      </section>
    </div>
  );
}

function EventSummary({ event }: { event: FtcEvent }) {
  const location = displayLocation([event.city, event.stateProv]);
  return (
    <div className="rounded-xl border border-[#e0eaea] p-3 dark:border-[#304955]" data-testid={`ftc-team-event-${event.code.toLowerCase()}`}>
      <p className="text-sm font-semibold text-[#183a4b] dark:text-[#edf5f7]">{event.name ?? event.code}</p>
      <p className="mt-1 text-[11px] text-[#16869a] dark:text-[#6fc3cf]">{event.code}{event.typeName ? ` · ${event.typeName}` : ""}</p>
      {(eventDateLabel(event) || location) && <p className="mt-1.5 text-xs text-[#687b82] dark:text-[#a9bbc2]">{[eventDateLabel(event), location].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

function FtcEventDetails({ reference }: { reference: Extract<FtcMentionReference, { kind: "event" }> }) {
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
  const location = displayLocation([event.venue, event.city, event.stateProv, event.country]);
  const dates = eventDateLabel(event);
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8e8e7] bg-[#f5faf9] p-4 dark:border-[#2c4b55] dark:bg-[#182f39]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-[#16869a] dark:text-[#6fc3cf]">{event.code}{event.typeName ? ` · ${event.typeName}` : ""}</p>
            <h3 className="mt-1 break-words text-xl font-bold tracking-tight text-[#183a4b] dark:text-[#edf5f7]" data-testid="text-ftc-event-name">{event.name ?? event.code}</h3>
            {dates && <p className="mt-1 text-sm text-[#63747c] dark:text-[#a9bbc2]">{dates}</p>}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#16869a] shadow-sm dark:bg-[#203b46] dark:text-[#8fd7e0]"><CalendarDays size={19} /></span>
        </div>
        {location && <div className="mt-4"><DetailLine icon={<MapPin size={15} />}>{location}</DetailLine></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          {officialLink(event.website, "Event website")}
          {officialLink(event.liveStreamUrl, "Live stream")}
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionLabel>Teams attending</SectionLabel>
          <span className="text-[11px] text-[#7d8c91] dark:text-[#9eb0b8]">{teams.length} listed</span>
        </div>
        {teams.length
          ? <div className="grid gap-2 sm:grid-cols-2">{teams.slice(0, 24).map(team => <TeamSummary key={team.teamNumber} team={team} />)}</div>
          : <p className="rounded-xl border border-dashed border-[#d2dfdf] px-3 py-4 text-sm text-[#75858a] dark:border-[#35515e] dark:text-[#a9bbc2]">No attending teams are listed yet.</p>}
        {teams.length > 24 && <p className="mt-2 text-xs text-[#75858a] dark:text-[#a9bbc2]">Showing the first 24 teams.</p>}
      </section>
    </div>
  );
}

function TeamSummary({ team }: { team: FtcTeam }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[#e0eaea] p-3 dark:border-[#304955]" data-testid={`ftc-event-team-${team.teamNumber}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e4f3f1] font-mono text-[10px] font-bold text-[#137989] dark:bg-[#203f48] dark:text-[#8fd7e0]"><Award size={14} /></span>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#183a4b] dark:text-[#edf5f7]">Team {team.displayTeamNumber ?? team.teamNumber}</span><span className="block truncate text-xs text-[#718188] dark:text-[#a9bbc2]">{team.nameFull ?? team.nameShort ?? team.schoolName ?? "Official FTC team"}</span></span>
    </div>
  );
}

function LoadingProfile({ label }: { label: string }) {
  return <div role="status" data-testid="status-ftc-loading" className="flex items-center gap-3 rounded-xl border border-[#dce8e8] bg-[#f7faf9] p-4 text-sm text-[#52666e] dark:border-[#304955] dark:bg-[#182d37] dark:text-[#c1d0d7]"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#16869a] border-t-transparent dark:border-[#6fc3cf] dark:border-t-transparent" />{label}</div>;
}

function ErrorProfile({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" data-testid="status-ftc-error" className="rounded-xl border border-[#e8c8c4] bg-[#fff6f4] p-4 dark:border-[#754943] dark:bg-[#331f20]"><p className="text-sm font-semibold text-[#9f3b33] dark:text-[#efaaa2]">FIRST data could not be loaded.</p><p className="mt-1 text-xs text-[#80534e] dark:text-[#d7a39d]">Check the connection and try again.</p><button type="button" onClick={onRetry} data-testid="button-retry-ftc-details" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#16869a] px-3 text-xs font-semibold text-white hover:bg-[#106d7a] dark:bg-[#1d7381] dark:hover:bg-[#248a9b]">Retry<ArrowUpRight size={13} /></button></div>;
}
