import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  getListOwnedAssistantScheduledTasksQueryKey,
  useListOwnedAssistantScheduledTasks,
  useManageOwnedAssistantScheduledTask,
} from "@workspace/api-client-react";
import type { AssistantScheduledTask, AssistantScheduledTaskActionInput } from "@workspace/api-client-react";
import { loadDisabledTools } from "../components/assistantTools";
import { confirmAction, notify } from "../lib/dialogs";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const panelClass =
  "rounded-2xl border border-[#dce7e5] bg-[#fbfdfb] shadow-[0_8px_28px_rgba(27,63,67,.045)] dark:border-[#29434b] dark:bg-[#142a33]";
const inputClass =
  "w-full rounded-xl border border-[#d6e2df] bg-[#f7faf8] px-3.5 py-3 text-sm text-[#183a42] outline-none transition placeholder:text-[#91a4a5] focus:border-[#16869a] focus:ring-2 focus:ring-[#16869a]/15 dark:border-[#35515a] dark:bg-[#10232b] dark:text-[#e6f0ef] dark:placeholder:text-[#7e969b]";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d5e1df] bg-[#fbfdfb] px-3.5 text-sm font-semibold text-[#35555a] transition hover:border-[#16869a] hover:text-[#12798a] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#35515a] dark:bg-[#19323b] dark:text-[#c5d8d9] dark:hover:border-[#56b7c1] dark:hover:text-[#8adbe0]";

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The request could not be completed. Try again.";
}

function formatDate(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatClock(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function cadenceLabel(task: AssistantScheduledTask): string {
  const { frequency, daysOfWeek } = task.recurrence;
  if (frequency === "daily") return "Every day";
  const days = [...daysOfWeek].sort((a, b) => a - b).map((day) => WEEKDAY_NAMES[day]).filter(Boolean);
  return days.length ? `Every ${days.join(", ")}` : "Weekly";
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active" || status === "succeeded"
      ? "border-[#b8ded8] bg-[#e7f5f1] text-[#176c62] dark:border-[#285c57] dark:bg-[#173d3b] dark:text-[#9ce1d3]"
      : status === "paused" || status === "running"
        ? "border-[#e8d8a7] bg-[#fbf2d9] text-[#80631a] dark:border-[#5f5128] dark:bg-[#3d351d] dark:text-[#ecd38a]"
        : status === "failed" || status === "cancelled"
          ? "border-[#e8c6c1] bg-[#fbebe9] text-[#9b443d] dark:border-[#68413d] dark:bg-[#402725] dark:text-[#f1aaa2]"
          : status === "interrupted"
            ? "border-[#d2dce0] bg-[#eef2f2] text-[#52676d] dark:border-[#40545a] dark:bg-[#24383e] dark:text-[#b5c8ca]"
            : "border-[#d2dce0] bg-[#eef2f2] text-[#52676d] dark:border-[#40545a] dark:bg-[#24383e] dark:text-[#b5c8ca]";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.11em] ${tone}`}>
      {status}
    </span>
  );
}

function EditTaskDialog({
  task,
  busy,
  onClose,
  onSave,
}: {
  task: AssistantScheduledTask;
  busy: boolean;
  onClose: () => void;
  onSave: (input: AssistantScheduledTaskActionInput) => void;
}) {
  const [prompt, setPrompt] = useState(task.prompt);
  const [frequency, setFrequency] = useState<"daily" | "weekly">(task.recurrence.frequency);
  const [hour, setHour] = useState(String(task.recurrence.hour).padStart(2, "0"));
  const [minute, setMinute] = useState(String(task.recurrence.minute).padStart(2, "0"));
  const [days, setDays] = useState<number[]>(task.recurrence.daysOfWeek);
  const [timeZone, setTimeZone] = useState(task.timeZone);
  const [error, setError] = useState("");

  const toggleDay = (day: number) => {
    setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b));
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    const cleanZone = timeZone.trim();
    const h = Number(hour);
    const m = Number(minute);
    if (!cleanPrompt) return setError("Add a prompt before saving.");
    if (cleanPrompt.length > 8000) return setError("Prompts must be 8,000 characters or fewer.");
    if (!cleanZone) return setError("Enter a timezone, such as Europe/Amsterdam.");
    if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
      return setError("Choose a valid local time.");
    }
    if (frequency === "weekly" && days.length === 0) return setError("Choose at least one weekday for a weekly task.");
    setError("");
    onSave({
      taskId: task.id,
      action: "edit",
      prompt: cleanPrompt,
      frequency,
      hour: h,
      minute: m,
      daysOfWeek: frequency === "weekly" ? days : [],
      timeZone: cleanZone,
      disabledTools: loadDisabledTools(),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#10272d]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-task-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[26px] border border-[#dce7e5] bg-[#fbfdfb] p-5 shadow-2xl dark:border-[#35515a] dark:bg-[#142a33] sm:max-w-2xl sm:rounded-[26px] sm:p-7" data-testid={`dialog-edit-task-${task.id}`}>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-[#16869a]">Task settings</p>
            <h2 id="edit-task-title" className="mt-1 font-semibold tracking-tight text-[#183a42] dark:text-[#e6f0ef] text-2xl">Edit recurring task</h2>
            <p className="mt-1 text-sm text-[#71888b] dark:text-[#9db4b8]">Tune the instruction and when it runs. The destination stays unchanged.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#70888b] hover:bg-[#edf4f1] dark:hover:bg-[#203b44]" aria-label="Close edit dialog" data-testid="button-edit-task-close"><X size={18} /></button>
        </header>
        <form onSubmit={save} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#557176] dark:text-[#a7bec1]">Assistant prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} maxLength={8000} className={`${inputClass} resize-y leading-relaxed`} data-testid="input-task-prompt" />
            <span className="mt-1 block text-right text-[11px] text-[#829699]">{prompt.length}/8,000</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#557176] dark:text-[#a7bec1]">Cadence</span>
              <span className="relative block">
                <select value={frequency} onChange={(event) => setFrequency(event.target.value as "daily" | "weekly")} className={`${inputClass} appearance-none pr-10`} data-testid="select-task-frequency">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#829699]" />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#557176] dark:text-[#a7bec1]">Local time</span>
              <input type="time" value={`${hour}:${minute}`} onChange={(event) => { const [nextHour, nextMinute] = event.target.value.split(":"); setHour(nextHour ?? ""); setMinute(nextMinute ?? ""); }} className={inputClass} data-testid="input-task-time" />
            </label>
          </div>
          {frequency === "weekly" && (
            <fieldset>
              <legend className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#557176] dark:text-[#a7bec1]">Run on</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day, index) => {
                  const selected = days.includes(index);
                  return <button type="button" key={day} aria-pressed={selected} onClick={() => toggleDay(index)} className={`min-h-10 min-w-12 rounded-xl border px-3 text-xs font-bold transition ${selected ? "border-[#16869a] bg-[#dff1ef] text-[#117687] dark:border-[#3a9cab] dark:bg-[#194148] dark:text-[#9cdee2]" : "border-[#d6e2df] bg-[#f7faf8] text-[#71888b] hover:border-[#9bbfbd] dark:border-[#35515a] dark:bg-[#10232b] dark:text-[#a3b8bb]"}`} data-testid={`button-task-weekday-${index}`}>{day}</button>;
                })}
              </div>
            </fieldset>
          )}
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#557176] dark:text-[#a7bec1]">Timezone</span>
            <input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Europe/Amsterdam" className={inputClass} autoComplete="off" data-testid="input-task-timezone" />
            <span className="mt-1 block text-[11px] text-[#829699]">Use an IANA timezone name. Example: America/Los_Angeles.</span>
          </label>
          <div className="rounded-xl border border-[#dce7e5] bg-[#f2f7f5] px-4 py-3 dark:border-[#35515a] dark:bg-[#10232b]">
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#829699]">Destination channel</p>
            <p className="mt-1 text-sm font-semibold text-[#35555a] dark:text-[#c5d8d9]">{task.destinationChannel ? `#${task.destinationChannel}` : "No channel configured"}</p>
          </div>
          {error && <p role="alert" className="rounded-xl border border-[#e8c6c1] bg-[#fbebe9] px-3.5 py-3 text-sm text-[#9b443d] dark:border-[#68413d] dark:bg-[#402725] dark:text-[#f1aaa2]" data-testid="edit-task-error">{error}</p>}
          <footer className="flex flex-col-reverse gap-2 border-t border-[#e2ebe8] pt-4 dark:border-[#2a444b] sm:flex-row sm:justify-end">
            <button type="button" className={buttonClass} onClick={onClose} data-testid="button-edit-task-cancel">Keep current settings</button>
            <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#147d8d] px-4 text-sm font-bold text-white transition hover:bg-[#0f6d7b] disabled:opacity-60" data-testid="button-edit-task-save">
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />} Save changes
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function RunEntry({ run, timeZone }: { run: AssistantScheduledTask["runs"][number]; timeZone: string }) {
  const detail = run.error || run.result;
  return (
    <li className="grid gap-2 border-t border-[#e7eeeb] py-3 first:border-t-0 dark:border-[#29434b] sm:grid-cols-[minmax(130px,.7fr)_auto_minmax(0,1.3fr)] sm:items-start" data-testid={`task-run-${run.id}`}>
      <span className="text-xs text-[#71888b] dark:text-[#a0b7ba]" data-testid={`task-run-date-${run.id}`}>{formatDate(run.finishedAt || run.startedAt || run.scheduledFor, timeZone)}</span>
      <StatusBadge status={run.status} />
      <div className="min-w-0 text-xs leading-relaxed text-[#47646a] dark:text-[#c0d3d4]" data-testid={`task-run-detail-${run.id}`}>
        {detail ? <p className={`whitespace-pre-wrap break-words ${run.error ? "text-[#9b443d] dark:text-[#f1aaa2]" : ""}`}>{detail}</p> : <p className="text-[#91a4a5] dark:text-[#7e969b]">{run.status === "running" ? "This run is in progress." : "No run details were returned."}</p>}
        {run.attempt > 1 && <span className="mt-1 block text-[10px] uppercase tracking-wide text-[#829699]">Attempt {run.attempt}</span>}
      </div>
    </li>
  );
}

function TaskCard({ task, pending, onAction, onEdit }: {
  task: AssistantScheduledTask;
  pending: boolean;
  onAction: (task: AssistantScheduledTask, action: "pause" | "resume" | "cancel") => void;
  onEdit: (task: AssistantScheduledTask) => void;
}) {
  const recentRuns = useMemo(() => [...task.runs].sort((a, b) => {
    const aTime = new Date(a.finishedAt || a.startedAt || a.scheduledFor).getTime();
    const bTime = new Date(b.finishedAt || b.startedAt || b.scheduledFor).getTime();
    return bTime - aTime;
  }).slice(0, 3), [task.runs]);
  const isCancelled = task.status === "cancelled";

  return (
    <article className={`${panelClass} overflow-hidden`} data-testid={`scheduled-task-${task.id}`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={task.status} />
              <span className="mono text-[10px] uppercase tracking-[.13em] text-[#829699]">Task {task.id.slice(0, 8)}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#27484f] dark:text-[#d4e1e1]" data-testid={`task-prompt-${task.id}`}>{task.prompt}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!isCancelled && task.status === "active" && <button type="button" disabled={pending} onClick={() => onAction(task, "pause")} className={buttonClass} data-testid={`button-task-pause-${task.id}`}><Pause size={15} /> Pause</button>}
            {!isCancelled && task.status === "paused" && <button type="button" disabled={pending} onClick={() => onAction(task, "resume")} className={buttonClass} data-testid={`button-task-resume-${task.id}`}><Play size={15} /> Resume</button>}
            {!isCancelled && <button type="button" disabled={pending} onClick={() => onEdit(task)} className={buttonClass} data-testid={`button-task-edit-${task.id}`}>Edit</button>}
            {!isCancelled && <button type="button" disabled={pending} onClick={() => onAction(task, "cancel")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e6c7c2] bg-[#fff8f6] px-3.5 text-sm font-semibold text-[#9a4941] transition hover:border-[#ce8d83] hover:bg-[#fbebe9] disabled:opacity-50 dark:border-[#68413d] dark:bg-[#332321] dark:text-[#f1aaa2] dark:hover:bg-[#402725]" data-testid={`button-task-cancel-${task.id}`}>Cancel</button>}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e1ebe8] bg-[#f5f9f7] px-3.5 py-3 dark:border-[#29434b] dark:bg-[#10232b]" data-testid={`task-cadence-${task.id}`}>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#829699]"><CalendarClock size={13} /> Cadence</p>
            <p className="mt-1.5 text-sm font-semibold text-[#35555a] dark:text-[#d0e0df]">{cadenceLabel(task)}</p>
            <p className="mt-0.5 text-xs text-[#71888b] dark:text-[#96adb0]">{formatClock(task.recurrence.hour, task.recurrence.minute)} · {task.timeZone}</p>
          </div>
          <div className="rounded-xl border border-[#e1ebe8] bg-[#f5f9f7] px-3.5 py-3 dark:border-[#29434b] dark:bg-[#10232b]" data-testid={`task-next-run-${task.id}`}>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#829699]"><Clock3 size={13} /> Next run</p>
            <p className="mt-1.5 text-sm font-semibold text-[#35555a] dark:text-[#d0e0df]">{task.status === "active" ? formatDate(task.nextRunAt, task.timeZone) : task.status === "paused" ? "Paused" : task.status === "cancelled" ? "Cancelled" : "Not active"}</p>
            {task.lastRunAt && <p className="mt-0.5 text-xs text-[#71888b] dark:text-[#96adb0]">Last run {formatDate(task.lastRunAt, task.timeZone)}</p>}
          </div>
          <div className="rounded-xl border border-[#e1ebe8] bg-[#f5f9f7] px-3.5 py-3 dark:border-[#29434b] dark:bg-[#10232b]" data-testid={`task-destination-${task.id}`}>
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#829699]">Destination</p>
            <p className="mt-1.5 truncate text-sm font-semibold text-[#35555a] dark:text-[#d0e0df]">{task.destinationChannel ? `#${task.destinationChannel}` : "No channel configured"}</p>
            <p className="mt-0.5 text-xs text-[#71888b] dark:text-[#96adb0]">Created {formatDate(task.createdAt, task.timeZone)}</p>
          </div>
        </div>
        {task.lastError && <div className="mt-4 flex gap-2.5 rounded-xl border border-[#e8c6c1] bg-[#fbebe9] px-3.5 py-3 text-sm text-[#9b443d] dark:border-[#68413d] dark:bg-[#402725] dark:text-[#f1aaa2]" data-testid={`task-last-error-${task.id}`}><AlertCircle size={16} className="mt-0.5 shrink-0" /><p className="whitespace-pre-wrap break-words">{task.lastError}</p></div>}
      </div>
      <div className="border-t border-[#e1ebe8] bg-[#f7faf8] px-5 py-4 dark:border-[#29434b] dark:bg-[#10232b] sm:px-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[.13em] text-[#557176] dark:text-[#a7bec1]">Recent runs</h3>
          <span className="mono text-[10px] text-[#829699]">{task.runs.length} total</span>
        </div>
        {recentRuns.length ? <ul>{recentRuns.map((run) => <RunEntry key={run.id} run={run} timeZone={task.timeZone} />)}</ul> : <p className="rounded-xl border border-dashed border-[#cfddda] px-4 py-4 text-xs text-[#829699] dark:border-[#35515a]" data-testid={`task-no-runs-${task.id}`}>No runs yet. The first result will appear here.</p>}
      </div>
    </article>
  );
}

export function RecurringTasksPage() {
  const queryClient = useQueryClient();
  const tasksQuery = useListOwnedAssistantScheduledTasks({ query: { queryKey: getListOwnedAssistantScheduledTasksQueryKey() } });
  const manageTask = useManageOwnedAssistantScheduledTask();
  const [editingTask, setEditingTask] = useState<AssistantScheduledTask | null>(null);
  const [actionError, setActionError] = useState("");
  const tasks = tasksQuery.data?.items ?? [];

  const performAction = (input: AssistantScheduledTaskActionInput) => {
    setActionError("");
    manageTask.mutate({ data: input }, {
      onSuccess: (result) => {
        void queryClient.invalidateQueries({ queryKey: getListOwnedAssistantScheduledTasksQueryKey() });
        setEditingTask(null);
        notify({ title: "Task updated", description: result.message });
      },
      onError: (error) => setActionError(readableError(error)),
    });
  };

  const handleStatusAction = async (task: AssistantScheduledTask, action: "pause" | "resume" | "cancel") => {
    if (manageTask.isPending) return;
    if (action === "cancel") {
      const approved = await confirmAction({
        title: "Cancel this recurring task?",
        detail: "Future runs will stop. Existing run history will remain available.",
        danger: true,
        confirmLabel: "Cancel task",
      });
      if (!approved) return;
    }
    performAction({ taskId: task.id, action, disabledTools: loadDisabledTools() });
  };

  return (
    <div className="min-h-[100dvh] bg-[#f0f6f3] px-4 py-6 text-[#183a42] dark:bg-[#0d1d24] dark:text-[#e6f0ef] sm:px-6 sm:py-9 lg:px-10" data-testid="recurring-tasks-page">
      <div className="mx-auto max-w-6xl">
        <header className="relative mb-7 overflow-hidden rounded-[26px] border border-[#dce7e5] bg-[#fbfdfb] px-5 py-6 shadow-[0_12px_40px_rgba(27,63,67,.055)] dark:border-[#29434b] dark:bg-[#142a33] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full border border-[#b9d9d4]/50 dark:border-[#355d62]/50" />
          <div className="pointer-events-none absolute -right-2 -top-8 h-40 w-40 rounded-full border border-[#b9d9d4]/50 dark:border-[#355d62]/50" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="mono flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#16869a]"><Sparkles size={13} /> Assistant operations</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#183a42] dark:text-[#e7f1ef] sm:text-4xl">Recurring tasks</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#71888b] dark:text-[#a1b7ba]">Keep shared robotics work moving on a reliable cadence. Review what is scheduled, adjust its brief, or pause the next run.</p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-xl border border-[#dce7e5] bg-[#f4f9f6] px-4 py-3 dark:border-[#35515a] dark:bg-[#10232b] sm:self-auto" data-testid="task-count-summary">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#dff1ef] text-[#137887] dark:bg-[#194148] dark:text-[#9cdee2]"><CalendarClock size={17} /></span>
              <span><span className="block text-xl font-semibold leading-5">{tasks.length}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#829699]">Owned tasks</span></span>
            </div>
          </div>
        </header>

        {actionError && <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[#e8c6c1] bg-[#fbebe9] px-4 py-3 text-sm text-[#9b443d] dark:border-[#68413d] dark:bg-[#402725] dark:text-[#f1aaa2]" data-testid="task-action-error"><span className="flex gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{actionError}</span><button type="button" onClick={() => setActionError("")} aria-label="Dismiss error" className="rounded-md p-1 hover:bg-[#f4d9d5] dark:hover:bg-[#57312d]"><X size={15} /></button></div>}

        {tasksQuery.isLoading ? (
          <div className="space-y-4" aria-label="Loading recurring tasks" data-testid="tasks-loading-state">
            {[0, 1, 2].map((item) => <div key={item} className={`${panelClass} animate-pulse p-5 sm:p-6`}><div className="h-4 w-24 rounded bg-[#dfe9e6] dark:bg-[#29434b]" /><div className="mt-4 h-4 w-4/5 rounded bg-[#e8efec] dark:bg-[#243d45]" /><div className="mt-2 h-4 w-3/5 rounded bg-[#e8efec] dark:bg-[#243d45]" /><div className="mt-5 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((cell) => <div key={cell} className="h-20 rounded-xl bg-[#e8efec] dark:bg-[#243d45]" />)}</div></div>)}
          </div>
        ) : tasksQuery.isError ? (
          <section className={`${panelClass} px-6 py-12 text-center`} data-testid="tasks-error-state">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbebe9] text-[#9b443d] dark:bg-[#402725] dark:text-[#f1aaa2]"><AlertCircle size={21} /></span>
            <h2 className="mt-4 text-lg font-semibold">Could not load your scheduled tasks</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#71888b] dark:text-[#a1b7ba]">The task list did not come through. Check your connection and try again.</p>
            <button type="button" onClick={() => void tasksQuery.refetch()} className={`${buttonClass} mt-5`} data-testid="button-retry-tasks"><RefreshCw size={15} /> Try again</button>
          </section>
        ) : tasks.length === 0 ? (
          <section className={`${panelClass} overflow-hidden`} data-testid="tasks-empty-state">
            <div className="grid gap-6 px-6 py-12 sm:grid-cols-[auto_1fr] sm:items-center sm:px-10 sm:py-14">
              <span className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#cfe3df] bg-[#e7f4f0] text-[#16869a] dark:border-[#355d62] dark:bg-[#193a40] dark:text-[#9cdee2]"><CalendarClock size={26} /></span>
              <div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-[#16869a]">No schedule on your desk</p><h2 className="mt-2 text-xl font-semibold tracking-tight">No owned recurring tasks</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#71888b] dark:text-[#a1b7ba]">Tasks assigned to you will appear here with their cadence, destination, and recent run history. There is nothing to manage yet.</p></div>
            </div>
          </section>
        ) : (
          <section className="space-y-4" aria-label="Owned recurring assistant tasks" data-testid="scheduled-task-list">
            {tasks.map((task) => <TaskCard key={task.id} task={task} pending={manageTask.isPending} onAction={handleStatusAction} onEdit={setEditingTask} />)}
          </section>
        )}
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-[#829699] dark:text-[#82999d]"><RotateCcw size={12} /> Run history stays attached to each task, including after cancellation.</p>
      </div>
      {editingTask && <EditTaskDialog task={editingTask} busy={manageTask.isPending} onClose={() => { if (!manageTask.isPending) setEditingTask(null); }} onSave={performAction} />}
    </div>
  );
}

export default RecurringTasksPage;
