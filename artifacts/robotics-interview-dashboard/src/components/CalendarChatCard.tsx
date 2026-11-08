import { CalendarDays, ChevronRight } from "lucide-react";
import { getGetCalendarQueryKey, useGetCalendar, type Calendar } from "@workspace/api-client-react";

import { useRealtimeHealthy } from "../realtimeHealth";

type CalendarChatCardProps = {
  calendarId: string;
  fallbackTitle: string;
  onOpen: () => void;
};

export function CalendarChatCard({ calendarId, fallbackTitle, onOpen }: CalendarChatCardProps) {
  const streamHealthy = useRealtimeHealthy();
  const query = useGetCalendar(calendarId, {
    query: {
      queryKey: getGetCalendarQueryKey(calendarId),
      refetchInterval: streamHealthy ? false : 3_000,
    },
  });
  const calendar = query.data as Calendar | undefined;
  const title = calendar?.title ?? fallbackTitle;
  const events = calendar?.data.events ?? [];
  const upcoming = [...events]
    .filter((event) => new Date(event.endAt).getTime() >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
  const summary = upcoming
    ? `Next: ${upcoming.title} · ${new Date(upcoming.startAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : events.length
      ? `${events.length} event${events.length === 1 ? "" : "s"}`
      : "No upcoming events";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-card-foreground transition hover:border-primary/50 hover:bg-accent"
      data-testid={`button-open-calendar-${calendarId}`}
      aria-label={`Open calendar: ${title}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
        <CalendarDays size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-primary">Shared calendar</span>
        <span className="mt-0.5 block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{summary}</span>
      </span>
      <ChevronRight size={16} className="ml-auto shrink-0 text-primary" />
    </button>
  );
}
