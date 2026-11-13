import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AuthSession } from "@workspace/api-client-react";
import { ArrowUp, Check, CircleAlert, LoaderCircle, LockKeyhole, RotateCcw, Settings2, ShieldCheck, X } from "lucide-react";
import { getStoredAuthToken } from "../authSession";

type AssistantChange = { settingId: string; value: unknown };
type AssistantConfirmation = {
  token: string;
  settingId: string;
  summary: string;
  expiresAt: string;
};
type AssistantResult = {
  answer: string;
  confirmations: AssistantConfirmation[];
  changes: AssistantChange[];
  localUpdates: Record<string, unknown>;
  model?: string;
};
type ProgressActivity = {
  action: "read_setting" | "propose_setting_change" | "update_setting";
  settingId: string;
  status: "started" | "complete" | "saved" | "confirmation" | "error";
  error?: string;
};
type ChatTurn = {
  id: number;
  kind: "user" | "assistant";
  text: string;
  changes?: AssistantChange[];
};
type ProgressItem = ProgressActivity & { id: number };

export interface SettingsAssistantChatProps {
  session: AuthSession | undefined;
  localSettings: Record<string, unknown>;
  onApplyLocalUpdates: (updates: Record<string, unknown>) => void;
  onTeamSettingsSaved: () => void;
}

const suggestions = [
  "What theme am I using?",
  "Show me the team's current inbox settings",
  "Set my dashboard to compact density",
];

function apiUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}api/assistant/settings/stream`;
}

function settingLabel(settingId: string): string {
  const label = settingId
    .replace(/^team\./, "Team · ")
    .replace(/^(profile|appearance|live|applicants)\./, "")
    .replace(/[._]/g, " ");
  return label.replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (value === null) return "Not set";
  if (typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function progressLabel(activity: ProgressActivity): string {
  const subject = settingLabel(activity.settingId);
  if (activity.status === "error") return `${subject}: ${activity.error ?? "Could not complete this step."}`;
  if (activity.status === "confirmation") return `${subject}: waiting for your approval`;
  if (activity.status === "saved") return `${subject}: saved`;
  if (activity.status === "started") {
    if (activity.action === "read_setting") return `Reading ${subject}`;
    if (activity.action === "update_setting") return `Changing ${subject}`;
    return `Reading ${subject} and reviewing the proposed change`;
  }
  if (activity.action === "read_setting") return `${subject}: read`;
  if (activity.action === "propose_setting_change") return `${subject}: change prepared`;
  return `${subject}: updated`;
}

async function readSse(
  response: Response,
  onFrame: (frame: Record<string, unknown>) => void | Promise<void>,
): Promise<void> {
  if (!response.body) throw new Error("The settings assistant stream was unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const processFrame = async (rawFrame: string) => {
    const data = rawFrame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    const parsed: unknown = JSON.parse(data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      await onFrame(parsed as Record<string, unknown>);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) await processFrame(frame);
      if (done) break;
    }
    if (buffer.trim()) await processFrame(buffer);
  } finally {
    reader.releaseLock();
  }
}

export function SettingsAssistantChat({
  session,
  localSettings,
  onApplyLocalUpdates,
  onTeamSettingsSaved,
}: SettingsAssistantChatProps) {
  const allowed = session?.authenticated === true && (session.role === "coordinator" || session.role === "admin");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<AssistantConfirmation | null>(null);
  const nextId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [turns, progress, pending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (question: string, confirmation?: AssistantConfirmation) => {
    const trimmed = question.trim();
    if (!allowed || busy || (!trimmed && !confirmation)) return;
    setError("");
    setProgress([]);
    if (!confirmation) setPending(null);
    setBusy(true);
    if (!confirmation) {
      setTurns((current) => [...current, { id: ++nextId.current, kind: "user", text: trimmed }]);
      setDraft("");
    }
    const controller = new AbortController();
    abortRef.current = controller;
    let finalReceived = false;

    try {
      const token = getStoredAuthToken();
      const headers = new Headers({ "Content-Type": "application/json", Accept: "text/event-stream" });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const body = confirmation
        ? { question: "confirm", confirmationToken: confirmation.token, localSettings }
        : {
            question: trimmed,
            localSettings,
            ...(turns.length
              ? {
                  history: turns.slice(-20).map((turn) => ({
                    role: turn.kind,
                    content: [
                      turn.text,
                      ...(turn.kind === "assistant" && turn.changes?.length
                        ? [`Saved settings: ${turn.changes.map((change) => `${change.settingId} = ${displayValue(change.value)}`).join("; ")}`]
                        : []),
                    ].join("\n"),
                  })),
                }
              : {}),
          };
      const response = await fetch(apiUrl(), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => undefined) as { error?: unknown } | undefined;
        throw new Error(
          typeof responseBody?.error === "string"
            ? responseBody.error
            : `The settings assistant could not respond (${response.status}).`,
        );
      }

      await readSse(response, async (frame) => {
        if (typeof frame.error === "string") throw new Error(frame.error);
        if (frame.activity && typeof frame.activity === "object") {
          const activity = frame.activity as ProgressActivity;
          setProgress((current) => [...current, { ...activity, id: ++nextId.current }]);
        }
        if (frame.done === true && frame.result && typeof frame.result === "object") {
          const result = frame.result as AssistantResult;
          finalReceived = true;
          const updates = result.localUpdates && typeof result.localUpdates === "object"
            ? result.localUpdates
            : {};
          const changes = Array.isArray(result.changes) ? result.changes : [];
          if (Object.keys(updates).length > 0) await onApplyLocalUpdates(updates);
          if (changes.some((change) => change.settingId.startsWith("team."))) onTeamSettingsSaved();
          setTurns((current) => [
            ...current,
            {
              id: ++nextId.current,
              kind: "assistant",
              text: typeof result.answer === "string" ? result.answer : "Settings check complete.",
              changes,
            },
          ]);
          const confirmations = Array.isArray(result.confirmations) ? result.confirmations : [];
          setPending(confirmations[0] ?? null);
        }
      });
      if (!finalReceived) throw new Error("The settings assistant stream ended before a result arrived.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The settings assistant could not complete that request.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  if (!allowed) {
    return (
      <section
        aria-labelledby="settings-assistant-title"
        className="rounded-xl border border-border bg-card p-5 text-card-foreground"
        data-testid="settings-assistant-denied"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <LockKeyhole size={17} aria-hidden="true" />
          </span>
          <div>
            <h3 id="settings-assistant-title" className="text-sm font-semibold">Settings assistant unavailable</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Sign in with a coordinator or admin account to inspect settings.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="settings-assistant-title"
      className="flex min-h-[390px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
      data-testid="settings-assistant-panel"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/35 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Settings2 size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id="settings-assistant-title" className="text-sm font-semibold">Settings assistant</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">A private lane for personal and team preferences</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground" data-testid="settings-assistant-scope">
          <ShieldCheck size={12} className="text-primary" aria-hidden="true" />
          Settings only
        </span>
      </header>

      <div
        ref={transcriptRef}
        className="flex min-h-[230px] flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
        aria-label="Settings assistant conversation"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        data-testid="settings-assistant-transcript"
      >
        {turns.length === 0 && progress.length === 0 && !busy ? (
          <div className="mx-auto my-auto w-full max-w-md py-5 text-center" data-testid="settings-assistant-empty">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-border bg-background text-primary">
              <Settings2 size={20} aria-hidden="true" />
            </div>
            <h4 className="mt-3 text-sm font-semibold">A clear view of your settings</h4>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Ask about a preference or request a change. Shared team changes wait for your approval.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => setDraft(suggestion)}
                  data-testid={`settings-assistant-suggestion-${index + 1}`}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-[11px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {turns.map((turn) => (
              <article
                key={turn.id}
                className={`max-w-[92%] rounded-xl border px-3.5 py-3 sm:max-w-[82%] ${
                  turn.kind === "user"
                    ? "ml-auto border-primary/20 bg-primary/10"
                    : "mr-auto border-border bg-background"
                }`}
                data-testid={`settings-assistant-turn-${turn.kind}-${turn.id}`}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
                  {turn.kind === "user" ? "You" : "Settings assistant"}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-5">{turn.text}</p>
                {turn.kind === "assistant" && turn.changes && turn.changes.length > 0 && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3" data-testid="settings-assistant-saved-summary">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                      <Check size={13} aria-hidden="true" /> Saved settings
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {turn.changes.map((change) => (
                        <li key={change.settingId} className="flex min-w-0 flex-wrap justify-between gap-x-3 text-xs" data-testid={`settings-assistant-saved-change-${change.settingId}`}>
                          <span className="text-muted-foreground">{settingLabel(change.settingId)}</span>
                          <span className="break-all font-medium">{displayValue(change.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
            {progress.map((item) => (
              <div
                key={item.id}
                className="mr-auto flex max-w-[92%] items-center gap-2 rounded-lg border border-border/80 bg-muted/35 px-3 py-2 text-xs text-muted-foreground"
                role="status"
                data-testid={`settings-assistant-progress-${item.id}`}
              >
                {item.status === "started" ? (
                  <LoaderCircle size={13} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : item.status === "error" ? (
                  <CircleAlert size={13} className="shrink-0 text-destructive" aria-hidden="true" />
                ) : (
                  <Check size={13} className="shrink-0 text-primary" aria-hidden="true" />
                )}
                <span>{progressLabel(item)}</span>
              </div>
            ))}
            {busy && (
              <div className="mr-auto flex items-center gap-2 rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground" role="status" data-testid="settings-assistant-working">
                <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Working through your settings…
              </div>
            )}
          </>
        )}
      </div>

      {pending && (
        <div className="mx-4 mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5" data-testid="settings-assistant-confirmation">
          <div className="flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Approval required · {settingLabel(pending.settingId)}</p>
              <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{pending.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void send("confirm", pending)}
                  disabled={busy}
                  data-testid="button-settings-assistant-approve"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check size={14} aria-hidden="true" /> Approve change
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  disabled={busy}
                  data-testid="button-settings-assistant-cancel"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <X size={14} aria-hidden="true" /> Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive" role="alert" aria-live="assertive" data-testid="settings-assistant-error">
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              if (pending) void send("confirm", pending);
              else void send(turns.filter((turn) => turn.kind === "user").at(-1)?.text ?? "Review my settings");
            }}
            className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2"
            data-testid="button-settings-assistant-retry"
            aria-label="Retry the last settings request"
          >
            <RotateCcw size={12} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      <form onSubmit={submit} className="border-t border-border bg-muted/20 p-3 sm:p-4" data-testid="settings-assistant-composer">
        <label htmlFor="settings-assistant-input" className="sr-only">Ask about your settings</label>
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/20">
          <textarea
            id="settings-assistant-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            maxLength={8000}
            placeholder="Ask about a setting or describe a change…"
            disabled={busy}
            data-testid="input-settings-assistant-question"
            className="max-h-32 min-h-[48px] min-w-0 flex-1 resize-y bg-transparent px-1 py-1.5 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            data-testid="button-settings-assistant-send"
            aria-label="Send settings question"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={17} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 px-1 text-[10px] leading-4 text-muted-foreground" data-testid="settings-assistant-composer-hint">
          Enter to send · Shift+Enter for a new line · Shared changes ask before saving
        </p>
      </form>
    </section>
  );
}
