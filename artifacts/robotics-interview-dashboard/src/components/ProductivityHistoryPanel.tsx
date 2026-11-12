import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, History, LoaderCircle, TrendingUp } from "lucide-react";
import {
  useGetChatProductivityHistory,
  type ChatProductivityHistoryRange,
} from "@workspace/api-client-react";

type Props = {
  scope: "shared" | "channel";
  channelId?: string;
};

const historyRangeLabels: Record<ChatProductivityHistoryRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

function formatDayLong(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDayShort(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatPointTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scoreBadgeColor(score: number): string {
  if (score <= 3) return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200";
  if (score <= 6) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
}

/**
 * Retained automatic-review history for the productivity dialog. Mounted only
 * while the History tab is visible so the query and the charting library are
 * paid for on demand.
 */
export function ProductivityHistoryPanel({ scope, channelId }: Props) {
  const [range, setRange] = useState<ChatProductivityHistoryRange>("30d");
  const historyQuery = useGetChatProductivityHistory({
    scope,
    ...(scope === "channel" && channelId ? { channelId } : {}),
    range,
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  });
  const data = historyQuery.data;

  const dailyChart = useMemo(
    () => (data?.daily ?? []).map((day) => ({ ...day, label: formatDayShort(day.date) })),
    [data],
  );
  const trendChart = useMemo(
    () => (data?.points ?? []).map((point) => ({ createdAt: point.createdAt, score: point.score })),
    [data],
  );
  const bestDayIndex = useMemo(() => {
    const daily = data?.daily ?? [];
    if (!daily.length) return -1;
    return daily.reduce((best, day, index) => (day.averageScore > daily[best].averageScore ? index : best), 0);
  }, [data]);
  const averageScore = useMemo(() => {
    const daily = data?.daily ?? [];
    const reviews = data?.reviewCount ?? 0;
    if (!reviews || !daily.length) return null;
    const weighted = daily.reduce((sum, day) => sum + day.averageScore * day.reviewCount, 0);
    return Math.round((weighted / reviews) * 10) / 10;
  }, [data]);
  const bestDay = bestDayIndex >= 0 ? data?.daily[bestDayIndex] : undefined;
  const previousReviews = useMemo(() => [...(data?.points ?? [])].reverse(), [data]);

  return (
    <div className="space-y-4" data-testid="panel-productivity-history">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#71858b] dark:text-[#a9bbc2]">
          Productivity history
        </p>
        <div className="flex rounded-lg border border-[#d5e0e0] p-0.5 dark:border-[#355663]" role="group" aria-label="History range">
          {Object.entries(historyRangeLabels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value as ChatProductivityHistoryRange)}
              data-testid={`button-history-range-${value}`}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                range === value
                  ? "bg-[#12737d] text-white"
                  : "text-[#385762] hover:text-[#16869a] dark:text-[#a9bbc2]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {historyQuery.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[#667b82] dark:text-[#a9bbc2]" data-testid="status-productivity-history-loading">
          <LoaderCircle size={16} className="animate-spin" /> Loading productivity history…
        </div>
      ) : historyQuery.isError ? (
        <p role="alert" data-testid="status-productivity-history-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Could not load the productivity history. Try again shortly.
        </p>
      ) : !data || data.reviewCount === 0 ? (
        <div data-testid="status-productivity-history-empty" className="rounded-xl border border-dashed border-[#cbd8d6] p-6 text-center dark:border-[#355663]">
          <History size={22} className="mx-auto text-[#7b8a8f]" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">No reviews retained yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#667b82] dark:text-[#a9bbc2]">
            History is built from the automatic 30-minute reviews. Once reviews are enabled and running, each one is stored here and charted by day.
          </p>
        </div>
      ) : (
        <>
          {data.truncated && (
            <p role="status" data-testid="status-productivity-history-truncated" className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              More than {data.points.length.toLocaleString()} reviews fall in this range; the trend chart shows the most recent ones. Daily averages cover all {data.reviewCount.toLocaleString()} retained reviews.
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#e0e8e7] p-3 dark:border-[#355663]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71858b] dark:text-[#a9bbc2]">Average</p>
              <p className="mt-1 text-xl font-bold tabular-nums" data-testid="stat-history-average">{averageScore === null ? "—" : `${averageScore}/10`}</p>
              <p className="text-[10px] text-[#71858b] dark:text-[#a9bbc2]">across {data.reviewCount.toLocaleString()} reviews</p>
            </div>
            <div className="rounded-lg border border-[#e0e8e7] p-3 dark:border-[#355663]">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#71858b] dark:text-[#a9bbc2]"><CalendarDays size={11} aria-hidden="true" /> Best day</p>
              <p className="mt-1 text-xl font-bold" data-testid="stat-history-best-day">{bestDay ? formatDayLong(bestDay.date) : "—"}</p>
              <p className="text-[10px] tabular-nums text-[#71858b] dark:text-[#a9bbc2]">{bestDay ? `${bestDay.averageScore}/10 average · ${bestDay.reviewCount} reviews` : ""}</p>
            </div>
            <div className="rounded-lg border border-[#e0e8e7] p-3 dark:border-[#355663]">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#71858b] dark:text-[#a9bbc2]"><TrendingUp size={11} aria-hidden="true" /> Peak</p>
              <p className="mt-1 text-xl font-bold tabular-nums" data-testid="stat-history-peak-score">
                {data.daily.length ? `${Math.max(...data.daily.map((day) => day.maxScore))}/10` : "—"}
              </p>
              <p className="text-[10px] text-[#71858b] dark:text-[#a9bbc2]">highest single review</p>
            </div>
          </div>

          <section aria-label="Average productivity by day" data-testid="chart-productivity-daily">
            <h3 className="mb-1.5 text-xs font-bold">Most productive days</h3>
            <div className="h-[170px] rounded-lg border border-[#e0e8e7] p-2 dark:border-[#355663]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChart} margin={{ top: 4, right: 4, bottom: 0, left: -14 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4eceb" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "#7b8a8f" }}
                    interval={Math.max(0, Math.ceil(dailyChart.length / 10) - 1)}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 10, fill: "#7b8a8f" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(22, 134, 154, 0.08)" }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number, name: string) => name === "averageScore" ? [`${value}/10`, "Avg score"] : [value, name]}
                    labelFormatter={(label: string) => {
                      const day = dailyChart.find((entry) => entry.label === label);
                      return day ? `${formatDayLong(day.date)} · ${day.reviewCount} reviews · peak ${day.maxScore}/10` : label;
                    }}
                  />
                  <Bar dataKey="averageScore" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {dailyChart.map((day, index) => (
                      <Cell key={day.date} fill={index === bestDayIndex ? "#edb52c" : "#16869a"} fillOpacity={index === bestDayIndex ? 1 : 0.65} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[10px] text-[#71858b] dark:text-[#a9bbc2]">Amber marks your most productive day. Days with no retained reviews are simply absent.</p>
          </section>

          <section aria-label="Productivity trend" data-testid="chart-productivity-trend">
            <h3 className="mb-1.5 text-xs font-bold">Score trend</h3>
            <div className="h-[150px] rounded-lg border border-[#e0e8e7] p-2 dark:border-[#355663]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChart} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4eceb" vertical={false} />
                  <XAxis
                    dataKey="createdAt"
                    tick={{ fontSize: 9, fill: "#7b8a8f" }}
                    tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                    interval="preserveStartEnd"
                    minTickGap={48}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 10, fill: "#7b8a8f" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number) => [`${value}/10`, "Score"]}
                    labelFormatter={(label: string) => formatPointTime(label)}
                  />
                  <Line type="monotone" dataKey="score" stroke="#16869a" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section aria-label="Previous productivity reviews">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold">Previous scores</h3>
              <span className="text-[10px] tabular-nums text-[#71858b] dark:text-[#a9bbc2]">{previousReviews.length.toLocaleString()} shown · newest first</span>
            </div>
            <div className="max-h-56 divide-y divide-[#edf1f0] overflow-y-auto rounded-lg border border-[#e0e8e7] dark:divide-[#263e49] dark:border-[#355663]" data-testid="list-productivity-history">
              {previousReviews.map((point, index) => (
                <div key={`${point.createdAt}-${index}`} data-testid={`row-productivity-history-${index}`} className="flex items-start gap-2.5 px-3 py-2">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${scoreBadgeColor(point.score)}`}>
                    {point.score}/10
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] tabular-nums text-[#71858b] dark:text-[#a9bbc2]">{formatPointTime(point.createdAt)}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-4" title={point.summary}>{point.summary}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#71858b] dark:text-[#a9bbc2]">
              Automatic reviews are kept as history. One-time range assessments are not stored.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default ProductivityHistoryPanel;
