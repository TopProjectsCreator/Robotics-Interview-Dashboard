import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { confirmAction } from "@/lib/dialogs";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileUp,
  LayoutGrid,
  List,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Rss,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  getGetCalendarQueryKey,
  useGetCalendar,
  useUpdateCalendar,
  type Calendar,
  type CalendarEvent,
  type CalendarOperationInput,
} from "@workspace/api-client-react";
import { buildCsvExport, buildIcalExport, downloadIcalFile, downloadTextFile, parseIcalText } from "../lib/calendarIcal";
import { useRealtimeHealthy } from "../realtimeHealth";

type CalendarEditorProps = { calendarId: string; assignees: string[]; onClose: () => void };
type ViewMode = "month" | "week" | "agenda";
type Modal = "event" | "feeds" | "details" | "export" | null;

type EventDraft = {
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  assignees: string[];
  color: string;
};

const CALENDAR_COLORS = [
  { value: "#16869a", label: "Teal" },
  { value: "#f8c84a", label: "Yellow" },
  { value: "#707fd0", label: "Blue" },
  { value: "#d35d68", label: "Red" },
  { value: "#429276", label: "Green" },
  { value: "#a75bc2", label: "Purple" },
  { value: "#70859a", label: "Gray" },
  { value: "#e08a3c", label: "Orange" },
] as const;

const DEFAULT_COLOR = CALENDAR_COLORS[0].value;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Canonical day key for an event: all-day events live on their UTC date. */
function eventDayKey(startAt: string | Date, allDay: boolean): string {
  const date = toDate(startAt);
  const year = UTC.year(date, allDay);
  return `${year}-${pad(allDay ? date.getUTCMonth() + 1 : date.getMonth() + 1)}-${pad(allDay ? date.getUTCDate() : date.getDate())}`;
}

const UTC = {
  year(date: Date, allDay: boolean) {
    return allDay ? date.getUTCFullYear() : date.getFullYear();
  },
};

function cellDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function eventTimeLabel(event: CalendarEvent): string {
  const start = toDate(event.startAt);
  if (event.allDay) {
    return start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return start.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** True when two timed events overlap (all-day events never conflict). */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function localInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromLocalInput(value: string, allDay: boolean): Date | null {
  if (!value) return null;
  if (allDay) {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function Button({
  children,
  onClick,
  onSubmit,
  type = "button",
  variant = "secondary",
  disabled = false,
  label,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  onSubmit?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-card text-foreground hover:border-primary/60 hover:bg-accent",
    quiet: "text-muted-foreground hover:bg-accent hover:text-foreground",
    danger: "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10",
  };
  return (
    <button
      type={type}
      aria-label={label}
      data-testid={`button-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onSubmit ? undefined : onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function ModalShell({ title, eyebrow, onClose, children, width = "max-w-xl" }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; width?: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/35 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className={`max-h-[92dvh] w-full ${width} overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p>}
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-card-foreground">{title}</h2>
          </div>
          <Button label="close-dialog" variant="quiet" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">{children}</span>;
}

function ColorSwatches({ value, onChange, label }: { value: string; onChange: (next: string) => void; label: string }) {
  return (
    <fieldset>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5" data-testid="input-color-swatches">
        {CALENDAR_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(color.value)}
            aria-label={`${color.label} ${color.value}`}
            aria-pressed={value === color.value}
            data-testid={`button-color-${color.value.slice(1)}`}
            className={`h-9 w-9 rounded-xl border-2 transition ${value === color.value ? "border-primary scale-110" : "border-transparent hover:scale-105"}`}
            style={{ background: color.value }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function AssigneePicker({ selected, onChange, assignees }: { selected: string[]; onChange: (next: string[]) => void; assignees: string[] }) {
  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name]);
  };
  return (
    <fieldset className="block">
      <FieldLabel>Assignees</FieldLabel>
      {assignees.length ? (
        <div className="grid max-h-32 grid-cols-2 gap-0.5 overflow-y-auto rounded-xl border border-border bg-muted/20 p-1.5" data-testid="input-assignee-picker">
          {assignees.map((name) => (
            <label key={name} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs ${selected.includes(name) ? "bg-primary/10" : ""}`}>
              <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" aria-label={`Assign to ${name}`} data-testid={`checkbox-assignee-${name.replace(/\s+/g, "-").toLowerCase()}`} />
              <span className="min-w-0 flex-1 truncate">{name}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No teammates found to assign yet.</p>
      )}
    </fieldset>
  );
}

export function CalendarEditor({ calendarId, assignees, onClose }: CalendarEditorProps) {
  const streamHealthy = useRealtimeHealthy();
  const queryClient = useQueryClient();
  const query = useGetCalendar(calendarId, { query: { queryKey: getGetCalendarQueryKey(calendarId), refetchInterval: streamHealthy ? false : 3_000 } });
  const updateCalendar = useUpdateCalendar();
  const [view, setView] = useState<ViewMode>("month");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const feedAutoRef = useRef(false);
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft>({ title: "", description: "", location: "", start: "", end: "", allDay: false, assignees: [], color: DEFAULT_COLOR });
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedColor, setFeedColor] = useState<string>(DEFAULT_COLOR);
  const [detailsTitle, setDetailsTitle] = useState("");
  const [detailsDescription, setDetailsDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const calendar = query.data as Calendar | undefined;
  const events = calendar?.data.events ?? [];
  const feeds = calendar?.data.feeds ?? [];

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...events]
      .filter((event) => {
        if (assigneeFilter !== "all" && !event.assignees.includes(assigneeFilter)) return false;
        if (colorFilter !== "all" && event.color !== colorFilter) return false;
        if (!q) return true;
        const haystack = `${event.title} ${event.description} ${event.location} ${event.assignees.join(" ")}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime());
  }, [events, search, assigneeFilter, colorFilter]);

  const monthCells = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [monthCursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const key = eventDayKey(event.startAt, event.allDay);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [filteredEvents]);

  const weekDays = useMemo(() => {
    const base = new Date();
    const anchor = new Date(base.getFullYear(), base.getMonth(), base.getDate() + weekOffset * 7);
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
    return Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    const sameMonth = first.getMonth() === last.getMonth();
    return `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${sameMonth ? last.getDate().toString() : last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }, [weekDays]);

  const upcomingEvents = useMemo(() => {
    const nowDate = Date.now();
    const windowEnd = nowDate + 24 * 60 * 60 * 1000;
    return [...events]
      .filter((event) => {
        const end = toDate(event.endAt).getTime();
        const start = toDate(event.startAt).getTime();
        return end >= nowDate && start <= windowEnd;
      })
      .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime())
      .slice(0, 3);
  }, [events]);

  const eventsThisWeek = useMemo(() => {
    const start = weekDays[0].getTime();
    const end = new Date(weekDays[6].getFullYear(), weekDays[6].getMonth(), weekDays[6].getDate() + 1).getTime();
    return events.filter((event) => {
      const time = toDate(event.startAt).getTime();
      return time >= start - 24 * 60 * 60 * 1000 && time < end;
    }).length;
  }, [events, weekDays]);

  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < events.length; i += 1) {
      for (let j = i + 1; j < events.length; j += 1) {
        const a = events[i];
        const b = events[j];
        if (a.allDay || b.allDay) continue;
        if (overlaps(toDate(a.startAt), toDate(a.endAt), toDate(b.startAt), toDate(b.endAt))) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [events]);

  const navPeriod = (delta: number) => {
    if (view === "week") {
      setWeekOffset((current) => current + delta);
      return;
    }
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setWeekOffset(0);
  };

  const moveEventToDay = async (eventId: string, targetDay: Date) => {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;
    const start = toDate(event.startAt);
    const end = toDate(event.endAt);
    const dayDelta = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate()).getTime()
      - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    if (dayDelta === 0) return;
    const nextStart = new Date(start.getTime() + dayDelta);
    const nextEnd = new Date(end.getTime() + dayDelta);
    await apply({
      operation: "update_event",
      eventId,
      eventPatch: { startAt: nextStart.toISOString(), endAt: nextEnd.toISOString() },
    });
    setNotice(`Moved "${event.title}" to ${nextStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`);
  };

  const handleDayDrop = (dropEvent: DragEvent, day: Date) => {
    dropEvent.preventDefault();
    setDragOverKey(null);
    const eventId = dropEvent.dataTransfer.getData("text/calendar-event") || dropEvent.dataTransfer.getData("text/plain");
    if (eventId) void moveEventToDay(eventId, day);
  };

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      const target = keyEvent.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (keyEvent.metaKey || keyEvent.ctrlKey || keyEvent.altKey) return;
      switch (keyEvent.key) {
        case "t":
        case "T":
          goToday();
          break;
        case "ArrowLeft":
          keyEvent.preventDefault();
          navPeriod(-1);
          break;
        case "ArrowRight":
          keyEvent.preventDefault();
          navPeriod(1);
          break;
        case "n":
        case "N":
          beginCreate();
          break;
        case "/":
          keyEvent.preventDefault();
          searchInputRef.current?.focus();
          break;
        case "Escape":
          setModal(null);
          setActiveEvent(null);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (feedAutoRef.current || !feeds.length) return;
    feedAutoRef.current = true;
    const run = async () => {
      for (const feed of feeds) {
        await updateCalendar.mutateAsync({ calendarId, data: { operation: "refresh_ical_feed", feedId: feed.id } }).catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey(calendarId) });
    };
    void run();
  }, [calendarId, feeds.length, queryClient, updateCalendar]);

  const apply = async (operation: CalendarOperationInput) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateCalendar.mutateAsync({ calendarId, data: operation });
      queryClient.setQueryData(getGetCalendarQueryKey(calendarId), updated);
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this calendar change.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const beginCreate = (date?: Date) => {
    const base = date ?? new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setActiveEvent(null);
    setDraft({ title: "", description: "", location: "", start: localInputValue(start), end: localInputValue(end), allDay: false, assignees: [], color: DEFAULT_COLOR });
    setModal("event");
  };

  const beginEdit = (event: CalendarEvent) => {
    setActiveEvent(event);
    setDraft({
      title: event.title,
      description: event.description,
      location: event.location,
      start: event.allDay ? localDateValue(toDate(event.startAt)) : localInputValue(toDate(event.startAt)),
      end: event.allDay ? localDateValue(toDate(event.endAt)) : localInputValue(toDate(event.endAt)),
      allDay: event.allDay,
      assignees: [...event.assignees],
      color: event.color || DEFAULT_COLOR,
    });
    setModal("event");
  };

  const submitEvent = async (submitEvent_: FormEvent) => {
    submitEvent_.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const startAt = fromLocalInput(draft.start, draft.allDay);
    const endAt = fromLocalInput(draft.end || draft.start, draft.allDay);
    if (!startAt || !endAt) {
      setError("Choose a valid start and end time.");
      return;
    }
    if (endAt.getTime() < startAt.getTime()) {
      setError("The end time must be on or after the start time.");
      return;
    }
    const base = {
      title,
      description: draft.description.trim().slice(0, 12_000),
      location: draft.location.trim().slice(0, 500),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: draft.allDay,
      assignees: [...new Set(draft.assignees)].slice(0, 32),
      color: draft.color,
    };
    if (activeEvent) {
      const result = await apply({ operation: "update_event", eventId: activeEvent.id, eventPatch: base });
      if (result) {
        setModal(null);
        setActiveEvent(null);
      }
    } else {
      const result = await apply({ operation: "create_event", event: base });
      if (result) setModal(null);
    }
  };

  const deleteEvent = async () => {
    if (!activeEvent) return;
    if (!(await confirmAction({ title: `Delete "${activeEvent.title}"?`, danger: true, confirmLabel: "Delete" }))) return;
    const result = await apply({ operation: "delete_event", eventId: activeEvent.id });
    if (result) {
      setModal(null);
      setActiveEvent(null);
    }
  };

  const submitFeed = async (submitEvent_: FormEvent) => {
    submitEvent_.preventDefault();
    const url = feedUrl.trim();
    if (!url) return;
    const result = await apply({ operation: "add_ical_feed", feedUrl: url, feedName: feedName.trim() || undefined, feedColor });
    if (result) {
      setFeedUrl("");
      setFeedName("");
      setNotice("Feed added. Refresh it anytime to import the latest events.");
    }
  };

  const removeFeed = async (feedId: string, name: string) => {
    if (!(await confirmAction({ title: `Stop following "${name}"?`, detail: "Events imported from this feed will be removed too.", danger: true, confirmLabel: "Remove feed" }))) return;
    await apply({ operation: "remove_ical_feed", feedId });
  };

  const refreshFeed = async (feedId: string) => {
    const result = await apply({ operation: "refresh_ical_feed", feedId });
    if (result) setNotice("Feed refreshed.");
  };

  const submitDetails = async (submitEvent_: FormEvent) => {
    submitEvent_.preventDefault();
    const title = detailsTitle.trim();
    if (!title) return;
    const result = await apply({ operation: "rename_calendar", title, description: detailsDescription.trim() || undefined });
    if (result) setModal(null);
  };

  const exportIcs = () => {
    if (!calendar) return;
    const ics = buildIcalExport(calendar.id, calendar.title, events.map((event) => ({ id: event.id, title: event.title, description: event.description, startAt: toDate(event.startAt), endAt: toDate(event.endAt), allDay: event.allDay, location: event.location, assignees: event.assignees })));
    downloadIcalFile(`${calendar.title || "calendar"}.ics`, ics);
    setNotice("Downloaded the calendar as an .ics file.");
    setModal(null);
  };

  const copyFeedText = async () => {
    if (!calendar) return;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/calendars/${calendar.id}.ics`, { credentials: "include" });
      if (!response.ok) throw new Error("Feed unavailable");
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setNotice("Copied the iCal feed text.");
    } catch {
      const fallback = buildIcalExport(calendar.id, calendar.title, events.map((event) => ({ id: event.id, title: event.title, description: event.description, startAt: toDate(event.startAt), endAt: toDate(event.endAt), allDay: event.allDay, location: event.location, assignees: event.assignees })));
      try {
        await navigator.clipboard.writeText(fallback);
        setNotice("Copied the iCal feed text (generated locally).");
      } catch {
        setError("Clipboard copy was blocked. Use the download instead.");
      }
    }
    setModal(null);
  };

  const copyFeedLink = async () => {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}api/calendars/${calendarId}.ics`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Copied the feed link. It needs a signed-in session to open.");
    } catch {
      setError("Clipboard copy was blocked.");
    }
    setModal(null);
  };

  const exportCsv = () => {
    if (!calendar) return;
    const csv = buildCsvExport(calendar.title, events.map((event) => ({ id: event.id, title: event.title, description: event.description, startAt: toDate(event.startAt), endAt: toDate(event.endAt), allDay: event.allDay, location: event.location, assignees: event.assignees })));
    downloadTextFile(`${calendar.title || "calendar"}.csv`, csv, "text/csv;charset=utf-8");
    setNotice(`Downloaded ${events.length} event${events.length === 1 ? "" : "s"} as CSV.`);
    setModal(null);
  };

  const importIcsText = async (text: string) => {
    if (!text.trim()) return;
    setImporting(true);
    setError("");
    try {
      const parsed = parseIcalText(text);
      let imported = 0;
      let failed = 0;
      for (const item of parsed) {
        const result = await updateCalendar.mutateAsync({
          calendarId,
          data: {
            operation: "create_event",
            event: {
              title: item.title,
              description: item.description,
              location: item.location,
              startAt: item.startAt.toISOString(),
              endAt: item.endAt.toISOString(),
              allDay: item.allDay,
              assignees: item.assignees,
              color: DEFAULT_COLOR,
            },
          },
        });
        queryClient.setQueryData(getGetCalendarQueryKey(calendarId), result);
        imported += 1;
      }
      setImportText("");
      setImportFile(null);
      setNotice(`Imported ${imported} event${imported === 1 ? "" : "s"}${failed ? `, ${failed} skipped` : ""}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That file could not be imported.");
    } finally {
      setImporting(false);
    }
  };

  const importSelectedFile = async () => {
    if (!importFile) return;
    const text = await importFile.text();
    await importIcsText(text);
  };

  if (!calendar && query.isLoading) {
    return (
      <div className="fixed inset-0 z-[80] flex min-h-[100dvh] items-center justify-center bg-background p-6" data-testid="status-calendar-loading">
        <div className="w-full max-w-3xl space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }
  if (!calendar) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center" data-testid="status-calendar-error">
          <AlertCircle className="mx-auto mb-3 text-destructive" size={30} />
          <h2 className="text-lg font-semibold">Calendar unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">The shared calendar could not be loaded.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button label="retry-calendar" variant="primary" onClick={() => query.refetch()}>
              Retry
            </Button>
            <Button label="close-calendar" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayKey = cellDayKey(new Date());
  const feedEventCounts = new Map<string, number>();
  for (const event of events) {
    if (event.feedId) feedEventCounts.set(event.feedId, (feedEventCounts.get(event.feedId) ?? 0) + 1);
  }

  return (
    <div className="fixed inset-0 z-[80] flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground" role="dialog" aria-modal="true" aria-label="Calendar editor" data-testid="calendar-editor">
      <header className="shrink-0 border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays size={18} />
            </div>
            <div className="min-w-0">
              <p className="mono text-[9px] font-bold uppercase tracking-[.18em] text-primary">Shared calendar</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{calendar.title}</h1>
              <p className="max-w-[560px] truncate text-xs text-muted-foreground">
                {calendar.data.description || "No description yet"}
                {" · "}{events.length} events · {eventsThisWeek} this week · {feeds.length} feed{feeds.length === 1 ? "" : "s"}
                {" · "}Updated {toDate(calendar.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${saving ? "bg-accent" : error || query.isError ? "bg-destructive" : "bg-primary"}`} />
              {saving ? "Saving" : error ? "Save issue" : query.isError ? "Sync issue" : "Live"}
            </span>
            <Button label="manage-ical-feeds" onClick={() => setModal("feeds")}>
              <Rss size={14} />Feeds{feeds.length ? ` (${feeds.length})` : ""}
            </Button>
            <Button label="export-ical" onClick={() => setModal("export")}>
              <Download size={14} />Export iCal
            </Button>
            <Button
              label="edit-calendar-details"
              onClick={() => {
                setDetailsTitle(calendar.title);
                setDetailsDescription(calendar.data.description);
                setModal("details");
              }}
            >
              <Pencil size={14} />Edit details
            </Button>
            <Button label="close-editor" onClick={onClose}>
              <X size={15} />Close
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-2.5 sm:px-6" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-1">
            <Button
              label="previous-period"
              variant="quiet"
              onClick={() => navPeriod(-1)}
            >
              <ChevronLeft size={15} />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-semibold" data-testid="text-month-label">
              {view === "week" ? weekLabel : monthLabel}
            </span>
            <Button label="next-period" variant="quiet" onClick={() => navPeriod(1)}>
              <ChevronRight size={15} />
            </Button>
            <Button label="today" onClick={goToday}>
              Today
            </Button>
          </div>
          <div className="flex rounded-lg border border-border bg-muted/50 p-0.5" role="tablist" aria-label="Calendar views">
            {([["month", LayoutGrid, "Month"], ["week", CalendarDays, "Week"], ["agenda", List, "Agenda"]] as const).map(([value, Icon, label]) => (
              <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} data-testid={`button-view-${value}`} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <span className="hidden text-[10px] leading-tight text-muted-foreground xl:block" title="Keyboard: T today, arrows change period, N new event, / search, Esc close">
            T today · ←→ period · N new · / search
          </span>
          <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
            <input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search events" data-testid="input-calendar-search" className="h-11 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-base outline-none focus:border-primary md:text-xs" placeholder="Search events, locations, assignees" />
          </div>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label="Filter by assignee" data-testid="select-calendar-assignee-filter" className="hidden h-11 max-w-[150px] rounded-lg border border-border bg-background px-2 text-base outline-none focus:border-primary sm:block md:text-xs">
            <option value="all">All assignees</option>
            {assignees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} aria-label="Filter by color" data-testid="select-calendar-color-filter" className="hidden h-11 rounded-lg border border-border bg-background px-2 text-base outline-none focus:border-primary sm:block md:text-xs">
            <option value="all">All colors</option>
            {CALENDAR_COLORS.map((color) => (
              <option key={color.value} value={color.value}>
                {color.label}
              </option>
            ))}
          </select>
          <div className="ml-auto">
            <Button label="add-event" variant="primary" onClick={() => beginCreate()}>
              <Plus size={15} />Add event
            </Button>
          </div>
        </div>
      </header>
      {error && (
        <div className="flex shrink-0 items-center gap-2 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive sm:px-6" role="alert">
          <AlertCircle size={14} />
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error" data-testid="button-dismiss-error" className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}
      {notice && !error && (
        <div className="flex shrink-0 items-center gap-2 border-b border-primary/25 bg-primary/10 px-4 py-2 text-xs font-medium text-primary sm:px-6" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice" data-testid="button-dismiss-notice" className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}
      {showUpcoming && !error && upcomingEvents.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e8d9a0] bg-[#fff8e1] px-4 py-2 text-xs text-[#5c4a08] sm:px-6 dark:bg-[#3a3319] dark:text-[#f3e2a3]" role="status" data-testid="calendar-upcoming-banner">
          <Clock3 size={13} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <strong>Coming up (24h):</strong> {upcomingEvents.map((event) => `${event.title} · ${eventTimeLabel(event)}`).join("  ·  ")}
          </span>
          <button type="button" onClick={() => setView("agenda")} data-testid="button-open-agenda-next" className="font-semibold underline underline-offset-2">Open agenda</button>
          <button type="button" onClick={() => setShowUpcoming(false)} aria-label="Dismiss upcoming events" data-testid="button-dismiss-upcoming" className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        {view === "week" ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card" data-testid="week-view">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b border-border bg-muted/35">
                {weekDays.map((day) => {
                  const key = cellDayKey(day);
                  const isToday = key === todayKey;
                  return (
                    <div key={key} className={`border-r border-border/60 px-2 py-2 text-center last:border-r-0 ${isToday ? "bg-primary/10" : ""}`}>
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{WEEKDAYS[day.getDay()]}</p>
                      <p className={`mx-auto mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold ${isToday ? "bg-primary text-primary-foreground" : ""}`}>{day.getDate()}</p>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7">
                {weekDays.map((day) => {
                  const key = cellDayKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const isToday = key === todayKey;
                  const isDropTarget = dragOverKey === key;
                  return (
                    <div
                      key={key}
                      data-testid={`week-day-${key}`}
                      onDragOver={(dragEvent) => { dragEvent.preventDefault(); setDragOverKey(key); }}
                      onDragLeave={() => setDragOverKey((current) => (current === key ? null : current))}
                      onDrop={(dropEvent) => handleDayDrop(dropEvent, day)}
                      className={`min-h-[320px] border-r border-border/60 p-2 last:border-r-0 ${isToday ? "bg-primary/[0.03]" : ""} ${isDropTarget ? "bg-primary/15 outline outline-2 outline-primary/40" : ""}`}
                    >
                      <button type="button" onClick={() => beginCreate(day)} aria-label={`Add event on ${key}`} data-testid={`button-add-event-${key}`} className="mb-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1 text-[10px] font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary">
                        <Plus size={11} /> Add
                      </button>
                      <div className="space-y-1.5">
                        {dayEvents.map((event) => {
                          const conflict = conflictIds.has(event.id);
                          return (
                            <button
                              key={event.id}
                              type="button"
                              draggable
                              onDragStart={(dragEvent) => { dragEvent.dataTransfer.setData("text/calendar-event", event.id); dragEvent.dataTransfer.effectAllowed = "move"; }}
                              onClick={() => beginEdit(event)}
                              data-testid={`week-event-${event.id}`}
                              aria-label={`${event.title}. Drag to reschedule.`}
                              className="w-full cursor-move rounded-xl border border-border/60 bg-background p-2 text-left shadow-sm transition hover:border-primary/40 hover:shadow"
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: event.color }} />
                                <span className="min-w-0 flex-1 truncate text-xs font-bold">{event.title}</span>
                                {conflict && <AlertTriangle size={11} className="shrink-0 text-[#d35d68]" aria-label="Overlaps another event" />}
                              </span>
                              <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                                {event.allDay ? "All day" : `${toDate(event.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${toDate(event.endAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                                {event.location ? ` · ${event.location}` : ""}
                              </span>
                              {event.assignees.length > 0 && (
                                <span className="mt-1 flex items-center">
                                  {event.assignees.slice(0, 3).map((name) => (
                                    <span key={name} title={name} className="-ml-1 flex h-5 w-5 items-center justify-center rounded-full border border-card bg-primary/10 text-[8px] font-bold text-primary first:ml-0">{initials(name)}</span>
                                  ))}
                                  {event.assignees.length > 3 && <span className="ml-1 text-[9px] font-semibold text-muted-foreground">+{event.assignees.length - 3}</span>}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {!dayEvents.length && <p className="rounded-lg border border-dashed border-border/70 p-3 text-center text-[10px] text-muted-foreground">No events</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : view === "month" ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card" data-testid="month-view">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b border-border bg-muted/35 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="px-3 py-2 text-center">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((day) => {
                  const key = cellDayKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const inMonth = day.getMonth() === monthCursor.getMonth();
                  const isToday = key === todayKey;
                  const isDropTarget = dragOverKey === key;
                  return (
                    <div
                      key={key}
                      data-testid={`day-${key}`}
                      onDragOver={(dragEvent) => { dragEvent.preventDefault(); setDragOverKey(key); }}
                      onDragLeave={() => setDragOverKey((current) => (current === key ? null : current))}
                      onDrop={(dropEvent) => handleDayDrop(dropEvent, day)}
                      className={`min-h-[108px] border-b border-r p-1.5 align-top transition last:border-r-0 ${inMonth ? "border-border/60" : "border-border/40 bg-muted/20"} ${isToday ? "bg-primary/5" : ""} ${isDropTarget ? "bg-primary/15 outline outline-2 outline-primary/40" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/70"}`}>
                          {day.getDate()}
                        </span>
                        <button type="button" onClick={() => beginCreate(day)} aria-label={`Add event on ${key}`} data-testid={`button-add-event-${key}`} className="rounded-md p-1 text-muted-foreground opacity-70 transition hover:bg-accent hover:text-primary">
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const conflict = conflictIds.has(event.id);
                          return (
                          <button
                            key={event.id}
                            type="button"
                            draggable
                            onDragStart={(dragEvent) => { dragEvent.dataTransfer.setData("text/calendar-event", event.id); dragEvent.dataTransfer.effectAllowed = "move"; }}
                            onClick={() => beginEdit(event)}
                            data-testid={`event-${event.id}`}
                            aria-label={`${event.title}${conflict ? " (overlaps another event)" : ""}. Drag to reschedule.`}
                            className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110 cursor-move"
                            style={{ background: event.color }}
                            title={`${event.title}${event.location ? ` · ${event.location}` : ""}${event.assignees.length ? ` · ${event.assignees.join(", ")}` : ""} — drag to move`}
                          >
                            {event.allDay ? "" : <span className="shrink-0 opacity-90">{toDate(event.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>}
                            <span className="min-w-0 flex-1 truncate">{event.title}</span>
                            {conflict && <AlertTriangle size={10} className="shrink-0" aria-label="Overlaps another event" />}
                            {event.assignees[0] && <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/25 text-[8px] font-bold" title={event.assignees.join(", ")}>{initials(event.assignees[0])}</span>}
                          </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <button type="button" onClick={() => { setSearch(""); setView("agenda"); }} data-testid={`button-more-events-${key}`} className="block w-full rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-primary hover:bg-accent">
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-0.5" data-testid="agenda-view">
            {filteredEvents.length ? (
              groupedAgenda(filteredEvents).map(([day, dayEvents]) => (
                <section key={day} className="rounded-2xl border border-border bg-card p-4" data-testid={`agenda-day-${day}`}>
                  <h2 className="text-xs font-bold uppercase tracking-[.12em] text-primary">
                    {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </h2>
                  <ul className="mt-2 divide-y divide-border">
                    {dayEvents.map((event) => (
                      <li key={event.id} data-testid={`agenda-event-${event.id}`} className="flex cursor-pointer items-center gap-3 py-2.5" onClick={() => beginEdit(event)}>
                        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{event.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={11} />
                              {eventTimeLabel(event)}
                            </span>
                            {event.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} />
                                {event.location}
                              </span>
                            )}
                            {event.assignees.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <UserRound size={11} />
                                {event.assignees.join(", ")}
                              </span>
                            )}
                            {event.feedId && <span className="inline-flex items-center gap-1"><Rss size={11} />From feed</span>}
                          </p>
                          {event.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>}
                        </div>
                        <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center" data-testid="status-calendar-empty">
                <CalendarDays size={22} className="text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">{events.length ? "No events match these filters" : "No events yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{events.length ? "Try a different search or filter." : "Add the first event to get the team on the same page."}</p>
                {!events.length && (
                  <Button label="add-first-event" variant="primary" className="mt-4" onClick={() => beginCreate()}>
                    <Plus size={14} />Add event
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {modal === "event" && (
        <ModalShell title={activeEvent ? "Edit event" : "New event"} eyebrow="Calendar event" onClose={() => { setModal(null); setActiveEvent(null); }}>
          <form onSubmit={submitEvent} className="space-y-4">
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input required maxLength={200} autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} data-testid="input-event-title" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-sm" placeholder="e.g. Tryout check-in" />
            </label>
            <label className="block">
              <FieldLabel>Description</FieldLabel>
              <textarea maxLength={12_000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} data-testid="input-event-description" className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-sm" placeholder="Details, agenda, or links…" />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} data-testid="input-event-all-day" className="h-4 w-4 accent-[hsl(var(--primary))]" />
              All-day event
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <FieldLabel>Start</FieldLabel>
                <input type={draft.allDay ? "date" : "datetime-local"} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} data-testid="input-event-start" className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none focus:border-primary md:text-sm" />
              </label>
              <label className="block">
                <FieldLabel>End</FieldLabel>
                <input type={draft.allDay ? "date" : "datetime-local"} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} data-testid="input-event-end" className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-base outline-none focus:border-primary md:text-sm" />
              </label>
            </div>
            <label className="block">
              <FieldLabel>Location</FieldLabel>
              <input maxLength={500} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} data-testid="input-event-location" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-sm" placeholder="Room, link, or address" />
            </label>
            <AssigneePicker selected={draft.assignees} onChange={(next) => setDraft({ ...draft, assignees: next })} assignees={assignees} />
            <ColorSwatches value={draft.color} onChange={(next) => setDraft({ ...draft, color: next })} label="Color" />
            {activeEvent?.feedId && <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground" data-testid="text-event-from-feed">Imported from a subscribed feed. Editing here is kept until the next feed refresh.</p>}
            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <span>{activeEvent && <Button label="delete-event" variant="danger" onClick={() => void deleteEvent()} disabled={saving}><Trash2 size={14} />Delete</Button>}</span>
              <span className="flex gap-2">
                <Button label="cancel-event" onClick={() => { setModal(null); setActiveEvent(null); }}>Cancel</Button>
                <Button label="save-event" type="submit" variant="primary" disabled={saving || !draft.title.trim()}>
                  {saving && <LoaderCircle size={14} className="animate-spin" />}
                  {activeEvent ? "Save changes" : "Create event"}
                </Button>
              </span>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === "feeds" && (
        <ModalShell title="iCal feeds" eyebrow="External calendars" onClose={() => setModal(null)}>
          <p className="text-sm text-muted-foreground">Subscribe to any public .ics URL. Events import as read-only copies until you refresh the feed again.</p>
          {feeds.length ? (
            <ul className="mt-4 space-y-2" data-testid="list-ical-feeds">
              {feeds.map((feed) => (
                <li key={feed.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 p-3" data-testid={`feed-${feed.id}`}>
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: feed.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{feed.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{feed.url}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {feedEventCounts.get(feed.id) ?? 0} imported event{(feedEventCounts.get(feed.id) ?? 0) === 1 ? "" : "s"}
                      {feed.lastFetchedAt ? ` · Last fetched ${toDate(feed.lastFetchedAt).toLocaleString()}` : ""}
                    </p>
                    {feed.lastError && <p className="mt-0.5 text-[11px] font-medium text-destructive" data-testid={`feed-error-${feed.id}`}>{feed.lastError}</p>}
                  </div>
                  <Button label={`refresh-feed-${feed.id}`} onClick={() => void refreshFeed(feed.id)} disabled={saving}>
                    <RefreshCw size={13} />Refresh
                  </Button>
                  <Button label={`remove-feed-${feed.id}`} variant="danger" onClick={() => void removeFeed(feed.id, feed.name)} disabled={saving}>
                    <Trash2 size={13} />Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground" data-testid="status-no-feeds">No feeds attached yet. Add one below.</p>
          )}
          <form onSubmit={submitFeed} className="mt-4 space-y-3 border-t border-border pt-4">
            <label className="block">
              <FieldLabel>Feed URL</FieldLabel>
              <input required type="url" maxLength={2048} value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} data-testid="input-feed-url" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-xs" placeholder="https://example.com/calendar.ics" />
            </label>
            <label className="block">
              <FieldLabel>Display name (optional)</FieldLabel>
              <input maxLength={80} value={feedName} onChange={(e) => setFeedName(e.target.value)} data-testid="input-feed-name" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-sm" placeholder="Team holidays" />
            </label>
            <ColorSwatches value={feedColor} onChange={setFeedColor} label="Feed color" />
            <div className="flex justify-end gap-2 pt-1">
              <Button label="cancel-feeds" onClick={() => setModal(null)}>Done</Button>
              <Button label="add-ical-feed" type="submit" variant="primary" disabled={saving || !feedUrl.trim()}>
                {saving && <LoaderCircle size={14} className="animate-spin" />}
                Add feed
              </Button>
            </div>
          </form>
          <section className="mt-4 space-y-3 border-t border-border pt-4" aria-label="Import from .ics file or text">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Or import once from a file</p>
            <label className="block">
              <FieldLabel>.ics file</FieldLabel>
              <input type="file" accept=".ics,text/calendar" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} data-testid="input-import-file" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base md:text-xs" />
            </label>
            {importFile && <p className="text-[11px] text-muted-foreground" data-testid="text-import-file-name">{importFile.name}</p>}
            <label className="block">
              <FieldLabel>…or paste .ics text</FieldLabel>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} data-testid="input-import-text" rows={4} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-xs" placeholder={"BEGIN:VCALENDAR\nBEGIN:VEVENT\n…"} />
            </label>
            <div className="flex justify-end gap-2">
              <Button label="import-ics" variant="primary" disabled={importing || (!importFile && !importText.trim())} onClick={() => { if (importFile) void importSelectedFile(); else void importIcsText(importText); }}>
                {importing && <LoaderCircle size={14} className="animate-spin" />}
                <FileUp size={14} />Import events
              </Button>
            </div>
          </section>
        </ModalShell>
      )}

      {modal === "details" && (
        <ModalShell title="Edit calendar details" eyebrow="Calendar settings" onClose={() => setModal(null)}>
          <form onSubmit={submitDetails} className="space-y-4">
            <label className="block">
              <FieldLabel>Calendar name</FieldLabel>
              <input required autoFocus maxLength={120} value={detailsTitle} onChange={(e) => setDetailsTitle(e.target.value)} data-testid="input-calendar-title" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-sm" />
            </label>
            <label className="block">
              <FieldLabel>Description</FieldLabel>
              <textarea maxLength={500} rows={4} value={detailsDescription} onChange={(e) => setDetailsDescription(e.target.value)} data-testid="input-calendar-description" className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 md:text-sm" />
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button label="cancel-calendar-details" onClick={() => setModal(null)}>Cancel</Button>
              <Button label="save-calendar-details" type="submit" variant="primary" disabled={saving || !detailsTitle.trim()}>
                {saving && <LoaderCircle size={14} className="animate-spin" />}
                Save details
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === "export" && (
        <ModalShell title="Export as iCal feed" eyebrow="Share" onClose={() => setModal(null)}>
          <p className="text-sm text-muted-foreground">Get this calendar into Google Calendar, Apple Calendar, or Outlook. The link opens with a signed-in team session.</p>
          <div className="mt-4 space-y-2">
            <Button label="download-ical" variant="primary" className="w-full" onClick={exportIcs}>
              <Download size={14} />Download .ics file ({events.length} events)
            </Button>
            <Button label="download-csv" className="w-full" onClick={exportCsv}>
              <Download size={14} />Download .csv file
            </Button>
            <Button label="copy-ical-text" className="w-full" onClick={() => void copyFeedText()}>
              <Copy size={14} />Copy iCal feed text
            </Button>
            <Button label="copy-ical-link" className="w-full" onClick={() => void copyFeedLink()}>
              <Copy size={14} />Copy feed link
            </Button>
            <Button label="print-calendar" className="w-full" onClick={() => window.print()}>
              <Printer size={14} />Print calendar
            </Button>
          </div>
          <p className="mt-3 font-mono text-[11px] break-all rounded-lg bg-muted/50 p-2 text-muted-foreground" data-testid="text-ical-link">
            {window.location.origin}{import.meta.env.BASE_URL}api/calendars/{calendarId}.ics
          </p>
        </ModalShell>
      )}
    </div>
  );
}

function groupedAgenda(events: CalendarEvent[]): Array<[string, CalendarEvent[]]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDayKey(event.startAt, event.allDay);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default CalendarEditor;
