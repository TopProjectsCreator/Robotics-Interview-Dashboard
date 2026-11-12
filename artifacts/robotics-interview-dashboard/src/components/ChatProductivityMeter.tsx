import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, History, LoaderCircle, PauseCircle, PlayCircle } from "lucide-react";
import {
  getGetChatProductivityQueryKey,
  useGetChatProductivity,
  useReviewChatProductivityRange,
  useUpdateChatProductivitySettings,
  type ChatProductivityRangeInputRange,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Kept out of the initial bundle: recharts is the app's heaviest dependency and
// history charts are only needed once the user opens that tab.
const ProductivityHistoryPanel = lazy(() => import("./ProductivityHistoryPanel"));

type Props = {
  scope: "shared" | "channel";
  channelId?: string;
};

type ActivityAssessment =
  | "productive"
  | "low_value"
  | "potentially_useful"
  | "no_recorded_progress";

const assessmentLabels: Record<ActivityAssessment, string> = {
  productive: "Productive",
  low_value: "Low value",
  potentially_useful: "Potentially useful",
  no_recorded_progress: "No recorded progress",
};

const productivityRangeLabels: Record<ChatProductivityRangeInputRange, string> = {
  "1h": "Last hour",
  "1d": "Last day",
  "3d": "Last 3 days",
  "5d": "Last 5 days",
  "7d": "Last week",
  "30d": "Last month",
};

function scoreLabel(score: number): string {
  if (score <= 3) return "Low productivity";
  if (score <= 6) return "Moderate productivity";
  return "High productivity";
}

function scoreColor(score: number): string {
  if (score <= 3) return "bg-orange-500 text-orange-700 dark:text-orange-300";
  if (score <= 6) return "bg-amber-400 text-amber-700 dark:text-amber-300";
  return "bg-emerald-500 text-emerald-700 dark:text-emerald-300";
}

function scoreBadgeColor(score: number): string {
  if (score <= 3) return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200";
  if (score <= 6) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
}

function assessmentColor(assessment: ActivityAssessment): string {
  if (assessment === "productive") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (assessment === "potentially_useful") return "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300";
  if (assessment === "low_value") return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "No messages in this range";
  const format = (value: string) => new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${format(start)} – ${format(end)}`;
}

function formatStartedAt(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatProductivityMeter({ scope, channelId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"latest" | "history">("latest");
  const [acknowledged, setAcknowledged] = useState(false);
  const queryParams = {
    scope,
    ...(scope === "channel" && channelId ? { channelId } : {}),
  };
  const queryKey = getGetChatProductivityQueryKey(queryParams);
  const [selectedRange, setSelectedRange] = useState<ChatProductivityRangeInputRange | "">("");
  const statusQuery = useGetChatProductivity(queryParams, {
    query: {
      queryKey,
      enabled: scope === "shared" || Boolean(channelId),
      refetchInterval: 60_000,
    },
  });
  const rangeReview = useReviewChatProductivityRange();
  const updateSettings = useUpdateChatProductivitySettings();
  const status = statusQuery.data;
  const latest = status?.latest;
  const displayedLatest = selectedRange ? rangeReview.data?.latest : latest;
  const score = latest?.score;
  const percent = score === undefined ? null : Math.round(score * 10);
  const meterColor = score === undefined ? "bg-slate-400" : scoreColor(score).split(" ")[0];

  const saveEnabled = async (enabled: boolean) => {
    await updateSettings.mutateAsync({
      data: { enabled, acknowledgeNotice: enabled },
    });
    setAcknowledged(false);
    await queryClient.invalidateQueries({ queryKey });
  };

  useEffect(() => {
    setSelectedRange("");
    rangeReview.reset();
  }, [scope, channelId]);

  const chooseRange = (value: string) => {
    const range = value as ChatProductivityRangeInputRange | "";
    setSelectedRange(range);
    rangeReview.reset();
    if (!range) return;
    void rangeReview.mutateAsync({
      data: {
        scope,
        ...(scope === "channel" && channelId ? { channelId } : {}),
        range,
      },
    }).catch(() => {});
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={score === undefined
          ? "Open productivity meter"
          : `Open productivity score ${score} out of 10`}
        title="Productivity estimate"
        data-testid="button-chat-productivity"
        className="flex w-[150px] shrink-0 flex-col gap-1 rounded-lg border border-[#d5e0e0] bg-white px-2.5 py-1.5 text-left transition hover:border-[#16869a] dark:border-[#355663] dark:bg-[#172b38]"
      >
        <span className="flex w-full items-center justify-between gap-1 text-[10px] font-semibold text-[#385762] dark:text-[#d5e0e0]">
          <span className="flex items-center gap-1"><Activity size={12} aria-hidden="true" /> Productivity Score</span>
          <span data-testid="status-chat-productivity-score" className="tabular-nums">
            {score === undefined ? (status?.enabled ? "Pending" : "Off") : `${score}/10`}
          </span>
        </span>
        <span
          role="progressbar"
          aria-label="Team productivity estimate"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? 0}
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        >
          <span
            className={`block h-full rounded-full transition-[width] ${meterColor}`}
            style={{ width: `${percent ?? 0}%` }}
          />
        </span>
      </button>

      <Dialog open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setAcknowledged(false);
          setSelectedRange("");
          setTab("latest");
          rangeReview.reset();
          updateSettings.reset();
        }
      }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-[#d5e0e0] bg-white text-[#23383f] dark:border-[#355663] dark:bg-[#10212b] dark:text-[#e8eef2]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity size={18} className="text-[#16869a]" aria-hidden="true" />
              {displayedLatest?.conversationName ?? "Team productivity"}
            </DialogTitle>
            <DialogDescription className="text-[#667b82] dark:text-[#a9bbc2]">
              AI estimate from recorded shared-chat activity. Select a time range for a one-time assessment. It is not an individual performance rating.
            </DialogDescription>
          </DialogHeader>

          {statusQuery.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-[#667b82] dark:text-[#a9bbc2]" data-testid="status-chat-productivity-loading">
              <LoaderCircle size={16} className="animate-spin" /> Loading the latest assessment…
            </div>
          ) : statusQuery.isError ? (
            <p role="alert" data-testid="status-chat-productivity-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              Could not load the productivity assessment. Try again shortly.
            </p>
          ) : (
            <>
              <div className="mb-3 flex rounded-lg border border-[#d5e0e0] p-0.5 dark:border-[#355663]" role="tablist" aria-label="Productivity views">
                {([
                  ["latest", "Latest review", Activity],
                  ["history", "History", History],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    data-testid={`tab-productivity-${value}`}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      tab === value
                        ? "bg-white text-[#12737d] shadow-sm dark:bg-[#172b38] dark:text-[#8fd7e0]"
                        : "text-[#667b82] hover:text-[#16869a] dark:text-[#a9bbc2]"
                    }`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              {tab === "latest" && (
              <>
              <section className="rounded-lg border border-[#e0e8e7] p-3 dark:border-[#355663]">
                <label htmlFor="select-chat-productivity-range" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span>View time range</span>
                  <select
                    id="select-chat-productivity-range"
                    value={selectedRange}
                    disabled={!status?.enabled || rangeReview.isPending}
                    onChange={(event) => chooseRange(event.currentTarget.value)}
                    data-testid="select-chat-productivity-range"
                    className="min-w-[180px] rounded-lg border border-[#d5e0e0] bg-white px-3 py-2 text-sm dark:border-[#355663] dark:bg-[#172b38]"
                  >
                    <option value="">Latest automatic review (30 minutes)</option>
                    {Object.entries(productivityRangeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-xs leading-5 text-[#667b82] dark:text-[#a9bbc2]">
                  {selectedRange
                    ? `Choosing ${productivityRangeLabels[selectedRange]} requests a one-time AI assessment.`
                    : "Choose a range to request a one-time assessment; only messages inside it affect the score."}
                  {" "}Older chat is sent as context only.
                </p>
                {!status?.enabled && (
                  <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                    Enable AI productivity reviews to request a custom range.
                  </p>
                )}
              </section>

              {selectedRange && rangeReview.isPending && (
                <div className="flex items-center gap-2 py-6 text-sm text-[#667b82] dark:text-[#a9bbc2]" data-testid="status-chat-productivity-range-loading">
                  <LoaderCircle size={16} className="animate-spin" /> Assessing {productivityRangeLabels[selectedRange].toLowerCase()}…
                </div>
              )}
              {selectedRange && rangeReview.isError && (
                <p role="alert" data-testid="status-chat-productivity-range-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  Could not assess that time range. Try selecting it again.
                </p>
              )}

              {displayedLatest && !rangeReview.isPending && (
                <section className="rounded-xl border border-[#e0e8e7] p-4 dark:border-[#355663]" data-testid="panel-chat-productivity-details">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#71858b] dark:text-[#a9bbc2]">Productivity score</p>
                      <p className={`mt-1 text-3xl font-bold tabular-nums ${scoreColor(displayedLatest.score).split(" ").slice(1).join(" ")}`}>
                        {displayedLatest.score}/10 <span className="text-lg font-semibold">· {Math.round(displayedLatest.score * 10)}%</span>
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreBadgeColor(displayedLatest.score)}`}>
                      {scoreLabel(displayedLatest.score)}
                    </span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full ${scoreColor(displayedLatest.score).split(" ")[0]}`}
                      style={{ width: `${Math.round(displayedLatest.score * 10)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#71858b] dark:text-[#a9bbc2]">
                    Estimated from {formatPeriod(displayedLatest.periodStart, displayedLatest.periodEnd)}.
                  </p>
                  <p className="mt-3 text-sm leading-6">{displayedLatest.summary}</p>

                  <div className="my-5 border-t border-[#e7edec] dark:border-[#355663]" />
                  <h3 className="text-sm font-bold">What the team did</h3>
                  {displayedLatest.activities.length ? (
                    <div className="mt-2 divide-y divide-[#edf1f0] dark:divide-[#263e49]">
                      {displayedLatest.activities.map((item, index) => (
                        <div key={`${item.activity}-${index}`} data-testid={`row-productivity-activity-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                          <span className="min-w-0 flex-1">{item.activity}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${assessmentColor(item.assessment as ActivityAssessment)}`}>
                            {assessmentLabels[item.assessment as ActivityAssessment]}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[#71858b] dark:text-[#a9bbc2]">No activities were returned.</p>
                  )}

                  <div className="my-5 border-t border-[#e7edec] dark:border-[#355663]" />
                  <h3 className="text-sm font-bold">Breakdown</h3>
                  <div className="mt-3 space-y-3">
                    {([
                      ["Actual project progress", displayedLatest.breakdown.projectProgress],
                      ["Planning and coordination", displayedLatest.breakdown.planningCoordination],
                      ["Focus and discipline", displayedLatest.breakdown.focusDiscipline],
                    ] as const).map(([label, value]) => (
                      <div key={label} data-testid={`row-productivity-breakdown-${label.toLowerCase().replaceAll(" ", "-")}`}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span>{label}</span><span className="font-semibold tabular-nums">{value}/10</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className={`h-full rounded-full ${scoreColor(value).split(" ")[0]}`} style={{ width: `${value * 10}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] text-[#71858b] dark:text-[#a9bbc2]">
                    {selectedRange ? "This range was assessed at" : "Last reviewed"}{" "}
                    {new Date(displayedLatest.createdAt).toLocaleString()}.
                  </p>
                </section>
              )}

              {!selectedRange && status?.lastError && (
                <p role="status" data-testid="status-chat-productivity-retry" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {status.canManage
                    ? "The latest AI review failed. Retry now or wait for the next scheduled attempt."
                    : "The latest AI review failed. Another review is scheduled."}
                </p>
              )}

              {!displayedLatest && !selectedRange && (
                <p data-testid="status-chat-productivity-empty" className="rounded-lg border border-[#e0e8e7] bg-[#f5f8f7] p-3 text-sm text-[#52666e] dark:border-[#355663] dark:bg-[#172b38] dark:text-[#c2d0d6]">
                  {status?.enabled
                    ? status.lastError
                      ? "There is no usable assessment yet."
                      : status.lastRunAt
                        ? `Review started at ${formatStartedAt(status.lastRunAt)} and is being prepared.`
                        : "Review is queued to start shortly."
                    : "A coordinator has not enabled AI productivity reviews."}
                </p>
              )}

              <section className="rounded-lg bg-[#f5f8f7] p-3 text-xs leading-5 text-[#52666e] dark:bg-[#172b38] dark:text-[#c2d0d6]">
                Automatic reviews score the last 30 minutes every 30 minutes. A selected range runs a one-time review; only messages inside that range affect its score, and older messages are context only. The selected message text may contain personal details and is sent to the configured AI provider. Direct messages, sender labels, attachments, reactions, and polls are excluded. Automatic reviews are retained and charted under the History tab; one-time range assessments are not stored.
              </section>

              {status?.canManage && (
                <div className="space-y-3">
                  {!status.enabled && (
                    <label className="flex cursor-pointer items-start gap-2 text-xs leading-5">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.currentTarget.checked)}
                        data-testid="checkbox-chat-productivity-notice"
                        className="mt-1 accent-[#16869a]"
                      />
                      <span>I understand that automatic reviews and selected-range requests send shared chat text and older context, which may contain personal details, to the configured AI provider. Only the selected range is scored; scores are visible to conversation members.</span>
                    </label>
                  )}
                  {updateSettings.isError && (
                    <p role="alert" data-testid="status-chat-productivity-save-error" className="text-sm text-red-700 dark:text-red-300">
                      Could not update the AI review setting. Try again.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={updateSettings.isPending || (!status.enabled && !acknowledged)}
                    onClick={() => void saveEnabled(!status.enabled).catch(() => {})}
                    data-testid={status.enabled ? "button-disable-chat-productivity" : "button-enable-chat-productivity"}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#12737d] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#0e626b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateSettings.isPending ? <LoaderCircle size={15} className="animate-spin" /> : status.enabled ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                    {updateSettings.isPending ? "Saving…" : status.enabled ? "Turn off AI reviews" : "Enable 30-minute AI reviews"}
                  </button>
                  {status.enabled && status.lastError && (
                    <button
                      type="button"
                      disabled={updateSettings.isPending}
                      onClick={() => void saveEnabled(true).catch(() => {})}
                      data-testid="button-retry-chat-productivity"
                      className="ml-2 inline-flex items-center gap-2 rounded-lg border border-[#b7d5d1] px-3.5 py-2 text-sm font-semibold text-[#12737d] transition hover:border-[#16869a] hover:bg-[#f2fbfa] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#355663] dark:text-[#8fd7e0] dark:hover:bg-[#172b38]"
                    >
                      <Activity size={15} />
                      Retry review now
                    </button>
                  )}
                </div>
              )}
              </>
              )}
              {tab === "history" && (
                <Suspense fallback={(
                  <div className="flex items-center gap-2 py-10 text-sm text-[#667b82] dark:text-[#a9bbc2]" data-testid="status-productivity-history-loading">
                    <LoaderCircle size={16} className="animate-spin" /> Loading the productivity history…
                  </div>
                )}>
                  <ProductivityHistoryPanel
                    key={scope === "channel" ? `channel:${channelId ?? "unknown"}` : "shared"}
                    scope={scope}
                    channelId={channelId}
                  />
                </Suspense>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
