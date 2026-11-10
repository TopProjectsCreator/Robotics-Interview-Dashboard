import { useMemo, useState } from "react";
import { Activity, CalendarDays, Clock3, RotateCw } from "lucide-react";
import {
  getGetWorkspaceUsageQueryKey,
  useGetWorkspaceUsage,
} from "@workspace/api-client-react";

const DAY_MS = 24 * 60 * 60 * 1000;

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toUtcInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initialRange() {
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return {
    from: toUtcInputDate(new Date(utcToday - 29 * DAY_MS)),
    to: toUtcInputDate(new Date(utcToday)),
  };
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours.toLocaleString()}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${safeSeconds}s`;
}

function formatDay(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(date);
}

function formatNumber(value: number) {
  return Math.max(0, value).toLocaleString();
}

function WorkspaceUsageTrend({
  daily,
}: {
  daily: { date: Date | string; activeSeconds: number }[];
}) {
  const maxValue = Math.max(1, ...daily.map((day) => day.activeSeconds));
  const chartWidth = 720;
  const chartHeight = 190;
  const left = 8;
  const right = chartWidth - 8;
  const top = 16;
  const bottom = 158;
  const usableHeight = bottom - top;
  const step = daily.length > 1 ? (right - left) / daily.length : right - left;
  const barWidth = Math.max(3, Math.min(18, step * 0.56));
  const tickValues = [maxValue, maxValue / 2, 0];
  const labels = daily.length > 2
    ? [daily[0], daily[Math.floor((daily.length - 1) / 2)], daily[daily.length - 1]]
    : daily;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-.02em]">Daily active time</h3>
          <p className="mt-1 text-xs text-muted-foreground">Total workspace time per UTC day</p>
        </div>
        <span className="mono hidden items-center gap-1.5 text-[10px] uppercase tracking-[.12em] text-muted-foreground sm:inline-flex">
          <span className="h-2 w-2 rounded-sm bg-primary" /> Active time
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <div className="flex h-[190px] flex-col justify-between pb-8 pt-2 text-right">
          {tickValues.map((value, index) => (
            <span className="mono text-[9px] text-muted-foreground" key={index}>
              {formatDuration(value)}
            </span>
          ))}
        </div>
        <div className="min-w-0 overflow-hidden">
          <svg
            className="h-[190px] w-full overflow-visible"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Daily active workspace time across ${daily.length} UTC days`}
            data-testid="chart-workspace-usage-daily"
          >
            {[top, top + usableHeight / 2, bottom].map((y, index) => (
              <line
                key={index}
                x1={left}
                x2={right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={index === 2 ? 0.2 : 0.1}
                strokeDasharray={index === 2 ? undefined : "3 5"}
              />
            ))}
            {daily.map((day, index) => {
              const x = daily.length === 1 ? chartWidth / 2 : left + step * index + step / 2;
              const height = (day.activeSeconds / maxValue) * usableHeight;
              return (
                <rect
                  key={`${day.date instanceof Date ? day.date.toISOString() : String(day.date)}-${index}`}
                  x={x - barWidth / 2}
                  y={bottom - height}
                  width={barWidth}
                  height={Math.max(day.activeSeconds > 0 ? 2 : 0, height)}
                  rx={Math.min(4, barWidth / 3)}
                  fill="currentColor"
                  className="text-primary"
                  fillOpacity={0.76}
                >
                  <title>{`${formatDay(day.date, { weekday: "short" })}: ${formatDuration(day.activeSeconds)}`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="flex justify-between gap-2 pt-1 text-[10px] text-muted-foreground" aria-hidden="true">
            {labels.map((day, index) => (
              <span key={`${String(day.date)}-${index}`}>{formatDay(day.date)}</span>
            ))}
          </div>
        </div>
      </div>
      <ul className="sr-only" data-testid="list-workspace-usage-daily-accessible">
        {daily.map((day, index) => (
          <li key={`${String(day.date)}-${index}`}>
            {formatDay(day.date, { weekday: "long", year: "numeric" })}: {formatDuration(day.activeSeconds)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WorkspaceUsageDashboard() {
  const [range, setRange] = useState(initialRange);
  const fromValid = isCalendarDate(range.from);
  const toValid = isCalendarDate(range.to);
  const rangeDays = fromValid && toValid
    ? (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / DAY_MS + 1
    : 0;
  const rangeValid = fromValid && toValid && range.from <= range.to && rangeDays <= 366;
  const params = useMemo(() => ({ from: range.from, to: range.to }), [range.from, range.to]);
  const usage = useGetWorkspaceUsage(params, {
    query: {
      queryKey: getGetWorkspaceUsageQueryKey({ from: range.from, to: range.to }),
      enabled: rangeValid,
    },
  });

  const workspaces = useMemo(
    () => [...(usage.data?.workspaces ?? [])].sort(
      (a, b) => b.activeSeconds - a.activeSeconds || b.visits - a.visits || a.name.localeCompare(b.name),
    ),
    [usage.data?.workspaces],
  );
  const daily = useMemo(
    () => [...(usage.data?.daily ?? [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
    [usage.data?.daily],
  );
  const hasActivity = Boolean(
    usage.data && (
      usage.data.totalActiveSeconds > 0 ||
      usage.data.totalVisits > 0 ||
      usage.data.distinctSessions > 0 ||
      daily.some((day) => day.activeSeconds > 0)
    ),
  );

  const updateRange = (key: "from" | "to", value: string) => {
    setRange((current) => ({ ...current, [key]: value }));
  };

  return (
    <section
      className="fade-up rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[0_8px_28px_rgba(24,58,75,.045)] sm:p-6"
      aria-labelledby="workspace-usage-heading"
      data-testid="section-workspace-usage"
    >
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div className="min-w-0">
          <p className="mono mb-2 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.18em] text-primary">
            <Activity size={13} aria-hidden="true" />
            Team adoption
          </p>
          <h2 id="workspace-usage-heading" className="text-xl font-semibold tracking-[-.045em] sm:text-2xl">
            Workspace usage
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">
            Compare aggregate activity across built-in and custom workspaces.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr] xl:min-w-[420px]">
          <label className="grid gap-1.5">
            <span className="mono text-[9px] font-medium uppercase tracking-[.14em] text-muted-foreground">From · UTC</span>
            <span className="relative">
              <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="date"
                value={range.from}
                onChange={(event) => updateRange("from", event.target.value)}
                aria-label="Usage start date"
                aria-invalid={!fromValid || (fromValid && toValid && range.from > range.to)}
                className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                data-testid="input-workspace-usage-from"
              />
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="mono text-[9px] font-medium uppercase tracking-[.14em] text-muted-foreground">To · UTC</span>
            <span className="relative">
              <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="date"
                value={range.to}
                onChange={(event) => updateRange("to", event.target.value)}
                aria-label="Usage end date"
                aria-invalid={!toValid || (fromValid && toValid && range.from > range.to)}
                className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                data-testid="input-workspace-usage-to"
              />
            </span>
          </label>
        </div>
      </header>

      {!rangeValid && (
        <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert" data-testid="status-workspace-usage-range-error">
          {!fromValid || !toValid
            ? "Enter valid start and end dates."
            : range.from > range.to
              ? "The start date must be on or before the end date."
              : "Choose a range of 366 days or less."}
        </div>
      )}

      {rangeValid && usage.isLoading && (
        <div className="mt-6 space-y-5" aria-label="Loading workspace usage" aria-live="polite" data-testid="loading-workspace-usage">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[94px] animate-pulse rounded-xl border border-border bg-muted/70" />
            ))}
          </div>
          <div className="h-[260px] animate-pulse rounded-xl border border-border bg-muted/70" />
        </div>
      )}

      {rangeValid && usage.isError && (
        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid="status-workspace-usage-error">
          <div>
            <p className="text-sm font-semibold text-foreground">Usage data could not be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">Check the connection and try again.</p>
          </div>
          <button
            type="button"
            onClick={() => void usage.refetch()}
            disabled={usage.isFetching}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
            data-testid="button-retry-workspace-usage"
          >
            <RotateCw size={14} className={usage.isFetching ? "animate-spin" : ""} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {rangeValid && usage.isFetching && !usage.isLoading && (
        <p className="mt-3 text-right text-[11px] text-muted-foreground" role="status" data-testid="status-workspace-usage-refreshing">
          Updating range…
        </p>
      )}

      {rangeValid && usage.data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="group-workspace-usage-totals">
            <article className="rounded-xl border border-border bg-background/70 px-4 py-4">
              <p className="mono text-[9px] font-medium uppercase tracking-[.15em] text-muted-foreground">Active time</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-.055em]" data-testid="text-workspace-usage-active-total">
                {formatDuration(usage.data.totalActiveSeconds)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Across all workspaces</p>
            </article>
            <article className="rounded-xl border border-border bg-background/70 px-4 py-4">
              <p className="mono text-[9px] font-medium uppercase tracking-[.15em] text-muted-foreground">Visits</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-.055em]" data-testid="text-workspace-usage-visits-total">
                {formatNumber(usage.data.totalVisits)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Workspace opens in range</p>
            </article>
            <article className="rounded-xl border border-border bg-background/70 px-4 py-4">
              <p className="mono text-[9px] font-medium uppercase tracking-[.15em] text-muted-foreground">Distinct sessions</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-.055em]" data-testid="text-workspace-usage-sessions-total">
                {formatNumber(usage.data.distinctSessions)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Aggregate count only</p>
            </article>
          </div>

          {!hasActivity && (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-background/60 px-5 py-7 text-center" data-testid="empty-workspace-usage">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Clock3 size={18} aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">No workspace activity in this range</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Team workspaces remain listed below so their zero activity is visible.
              </p>
            </div>
          )}
          {(
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.9fr)]">
              <div className="min-w-0 rounded-xl border border-border bg-background/55 p-4 sm:p-5" data-testid="panel-workspace-usage-trend">
                {daily.length > 0 ? (
                  <WorkspaceUsageTrend daily={daily} />
                ) : (
                  <div className="flex min-h-[190px] flex-col items-center justify-center text-center" data-testid="empty-workspace-usage-daily">
                    <p className="text-sm font-semibold">No daily activity to chart</p>
                    <p className="mt-1 text-xs text-muted-foreground">Daily totals will appear when available.</p>
                  </div>
                )}
              </div>

              <div className="min-w-0 rounded-xl border border-border bg-background/55 p-4 sm:p-5" data-testid="panel-workspace-usage-ranking">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold tracking-[-.02em]">Workspace ranking</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Ranked by active time</p>
                  </div>
                  <span className="mono text-[10px] text-muted-foreground" data-testid="text-workspace-usage-count">
                    {workspaces.length.toString().padStart(2, "0")} total
                  </span>
                </div>
                {workspaces.length === 0 ? (
                  <p className="mt-5 rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground" data-testid="empty-workspace-usage-ranking">
                    No workspaces recorded for these dates.
                  </p>
                ) : (
                  <ol className="mt-4 divide-y divide-border" data-testid="list-workspace-usage-ranking">
                    {workspaces.map((workspace, index) => (
                      <li key={workspace.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-1 last:pb-1" data-testid={`row-workspace-usage-${workspace.id}`}>
                        <span className={`mono grid h-7 w-7 place-items-center rounded-lg text-[10px] font-medium ${index === 0 ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"}`} aria-label={`Rank ${index + 1}`}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" title={workspace.name} data-testid={`text-workspace-usage-name-${workspace.id}`}>
                            {workspace.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            <span className="mono uppercase tracking-[.08em]">
                              {workspace.type === "builtIn" ? "Built-in" : "Custom"}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatNumber(workspace.visits)} visits</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="mono text-xs font-semibold" data-testid={`text-workspace-usage-time-${workspace.id}`}>
                            {formatDuration(workspace.activeSeconds)}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {formatNumber(workspace.distinctSessions)} sessions
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
          <p className="mt-5 border-t border-border pt-4 text-[10px] leading-4 text-muted-foreground" data-testid="text-workspace-usage-privacy-note">
            Team-level aggregates only. No person, IP, session-level, or custom workspace content details are shown.
          </p>
        </>
      )}
    </section>
  );
}
