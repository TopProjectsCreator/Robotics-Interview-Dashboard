import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Check, Code2, LoaderCircle, Plus, Rocket, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { getGetSessionQueryKey, useGetSession, type AssistantBuilderRunResponse, type CustomWorkspace, type CustomWorkspaceVersion } from "@workspace/api-client-react";
import { getStoredAuthToken } from "../authSession";
import { resolveAssistantModelSelection } from "../lib/assistantModelSelection";

type Capability = CustomWorkspace["capabilities"][number];
type Workspace = CustomWorkspace & { critiqueRounds?: number; verifiedCritiqueRounds?: number };
type Version = CustomWorkspaceVersion;
type WorkspaceSourceFile = { path: string; content: string };
type VersionPreview = Version & { html: string; capabilities: Capability[]; sourceFiles: WorkspaceSourceFile[] };
type WorkspaceFile = { path: string; content: string; updatedAt: string };
type AccessMode = Workspace["accessMode"];
type TeamMember = { id: string; displayName: string };
type BuilderModel = { id: string; name?: string };
type BridgeRequest = { channel: "workspace-bridge"; id: string; method: string; payload?: unknown };
type PublishAgentStep = { id: string; label: string; detail?: string; input?: string; output?: string; status: "running" | "done" | "failed" };
type AgentQuestion = {
  id: string;
  questions: { id: string; type: "text" | "singleSelect" | "multiSelect" | "boolean" | "fileUpload"; title: string; required?: boolean; placeholder?: string; options?: string[]; accept?: string; maxFiles?: number }[];
};
type BuilderRunFromApi = NonNullable<AssistantBuilderRunResponse["run"]>;
type BuilderRun = Omit<BuilderRunFromApi, "question"> & { question: AgentQuestion | null };
type QuestionFile = { file: File; previewUrl: string };
const MAX_QUESTION_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_QUESTION_IMAGE_BYTES = 1024 * 1024;
const MAX_QUESTION_TEXT_BYTES = 1024 * 1024;
const MAX_QUESTION_TOTAL_BYTES = 4 * 1024 * 1024;
const QUESTION_DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const QUESTION_TEXT_EXTENSIONS = new Set(["csv", "json", "md", "txt", "html", "htm", "css", "js", "ts", "xml"]);

function questionFileIssue(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isDocument = QUESTION_DOCUMENT_EXTENSIONS.has(extension);
  const isImage = file.type.startsWith("image/");
  const isText = file.type.startsWith("text/") || QUESTION_TEXT_EXTENSIONS.has(extension);
  if (!isDocument && !isImage && !isText) {
    return `${file.name} is not a supported attachment. Choose a PDF or Office document, an image, or a text file.`;
  }
  const limit = isDocument ? MAX_QUESTION_DOCUMENT_BYTES : isImage ? MAX_QUESTION_IMAGE_BYTES : MAX_QUESTION_TEXT_BYTES;
  if (file.size > limit) {
    return `${file.name} is larger than the ${isDocument ? "2 MB document" : isImage ? "1 MB image" : "1 MB text file"} limit.`;
  }
  return null;
}

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function AgentQuestionCard({ question, onSubmit }: { question: AgentQuestion; onSubmit: (answers: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, QuestionFile[]>>({});
  const [fileSelectionIssues, setFileSelectionIssues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const previewUrls = useRef(new Set<string>());
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const selectedFiles = Object.values(files).flat();
  const selectedFileCount = selectedFiles.length;
  const attachmentIssues = [
    ...Object.values(fileSelectionIssues).filter(Boolean),
    ...selectedFiles.map(({ file }) => questionFileIssue(file)).filter((issue): issue is string => issue !== null),
    ...(selectedFileCount > 5 ? ["Choose no more than 5 attachments in total."] : []),
    ...(selectedFiles.reduce((total, { file }) => total + file.size, 0) > MAX_QUESTION_TOTAL_BYTES
      ? ["Attachments together must be 4 MB or smaller."]
      : []),
  ];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (attachmentIssues.length) {
      setError(attachmentIssues[0]);
      return;
    }
    setSending(true);
    setError("");
    try {
      const answers: Record<string, unknown> = {};
      for (const item of question.questions) {
        if (item.type === "fileUpload") {
          answers[item.id] = await Promise.all((files[item.id] ?? []).map(async ({ file }) => {
            const base = { name: file.name, type: file.type, size: file.size };
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
            if (QUESTION_DOCUMENT_EXTENSIONS.has(extension)) {
              return { ...base, dataUrl: await readFileDataUrl(file) };
            }
            if (file.type.startsWith("image/")) return { ...base, dataUrl: await readFileDataUrl(file) };
            if (file.type.startsWith("text/") || QUESTION_TEXT_EXTENSIONS.has(extension)) {
              return { ...base, textContent: (await file.text()).slice(0, 40_000) };
            }
            throw new Error(`${file.name} is not a supported attachment.`);
          }));
        } else {
          const value = item.type === "multiSelect"
            ? (Array.isArray(values[item.id]) ? values[item.id] : [])
            : values[item.id] ?? "";
          if (item.required && item.type === "multiSelect" && (value as unknown[]).length === 0) {
            throw new Error(`Choose at least one option for “${item.title}”.`);
          }
          answers[item.id] = {
            value,
            ...(comments[item.id] ? { comment: comments[item.id] } : {}),
          };
        }
      }
      await onSubmit(answers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your answers.");
    } finally {
      setSending(false);
    }
  };
  return <form onSubmit={(event) => void submit(event)} className="my-3 space-y-4 rounded-xl border border-[#16869a]/40 bg-[hsl(var(--background))] p-4" data-testid="agent-question-form">
    <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">The workspace agent needs your input</h4>
    {question.questions.map((item) => <fieldset key={item.id} className="space-y-2" data-testid={`agent-question-${item.id}`}>
      <legend className="text-sm font-medium text-[hsl(var(--foreground))]">{item.title}{item.required && <span aria-label="required"> *</span>}</legend>
      {item.type === "text" && <textarea required={item.required} value={String(values[item.id] ?? "")} onChange={(event) => setValues((old) => ({ ...old, [item.id]: event.target.value }))} placeholder={item.placeholder} rows={3} className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 text-base md:text-sm text-[hsl(var(--foreground))]" data-testid={`input-question-${item.id}`} />}
      {item.type === "singleSelect" && <div className="grid gap-2 sm:grid-cols-2">{item.options?.map((option) => <label key={option} className="flex gap-2 rounded-lg border border-[hsl(var(--border))] p-2 text-sm"><input type="radio" name={item.id} required={item.required} checked={values[item.id] === option} onChange={() => setValues((old) => ({ ...old, [item.id]: option }))} />{option}</label>)}</div>}
      {item.type === "multiSelect" && <div className="grid gap-2 sm:grid-cols-2">{item.options?.map((option) => <label key={option} className="flex gap-2 rounded-lg border border-[hsl(var(--border))] p-2 text-sm"><input type="checkbox" checked={(values[item.id] as string[] | undefined)?.includes(option) ?? false} onChange={(event) => setValues((old) => { const current = (old[item.id] as string[] | undefined) ?? []; return { ...old, [item.id]: event.target.checked ? [...current, option] : current.filter((value) => value !== option) }; })} />{option}</label>)}</div>}
      {item.type === "boolean" && <div className="flex gap-4">{[["yes", "Yes"], ["no", "No"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name={item.id} required={item.required} checked={values[item.id] === value} onChange={() => setValues((old) => ({ ...old, [item.id]: value }))} />{label}</label>)}</div>}
      {(item.type === "singleSelect" || item.type === "multiSelect") && <textarea value={comments[item.id] ?? ""} onChange={(event) => setComments((old) => ({ ...old, [item.id]: event.target.value }))} rows={2} placeholder="Additional details (optional)" className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 text-base md:text-sm" />}
      {item.type === "fileUpload" && <>
        <input type="file" accept={item.accept ?? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.xml,.html,.htm,.css,.js,.ts,image/*"} multiple={(item.maxFiles ?? 1) > 1} required={item.required && !(files[item.id]?.length)} onChange={(event) => {
          const selection = Array.from(event.target.files ?? []);
          const picked = selection.slice(0, item.maxFiles ?? 1);
          setFileSelectionIssues((old) => ({
            ...old,
            [item.id]: selection.length > (item.maxFiles ?? 1)
              ? `Choose no more than ${item.maxFiles ?? 1} file${(item.maxFiles ?? 1) === 1 ? "" : "s"} for “${item.title}”.`
              : "",
          }));
          const next = picked.map((file) => {
            const previewUrl = URL.createObjectURL(file);
            previewUrls.current.add(previewUrl);
            return { file, previewUrl };
          });
          setFiles((old) => {
            Object.values(old[item.id] ?? []).forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
            return { ...old, [item.id]: next };
          });
        }} className="block w-full text-sm" data-testid={`input-question-file-${item.id}`} />
        {!!files[item.id]?.length && <ul className="grid gap-2 sm:grid-cols-2">{files[item.id].map(({ file, previewUrl }, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] p-2 text-xs">
          {file.type.startsWith("image/") && <img src={previewUrl} alt={`Preview of ${file.name}`} className="h-12 w-12 rounded object-cover" />}
          <span className="min-w-0 flex-1 truncate">{file.name} · {Math.ceil(file.size / 1024)} KB</span>
          <a href={previewUrl} target="_blank" rel="noreferrer" className="underline">View</a>
          {questionFileIssue(file) && <span className="basis-full text-red-700 dark:text-red-300">{questionFileIssue(file)}</span>}
          <button type="button" onClick={() => setFiles((old) => { URL.revokeObjectURL(previewUrl); return { ...old, [item.id]: old[item.id].filter((entry) => entry.previewUrl !== previewUrl) }; })} aria-label={`Remove ${file.name}`}>Remove</button>
        </li>)}</ul>}
        {fileSelectionIssues[item.id] && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{fileSelectionIssues[item.id]}</p>}
      </>}
    </fieldset>)}
    {selectedFiles.length > 0 && <p className="text-xs text-[#60757c] dark:text-[#b3c3cb]">PDF and Office files are read for this builder request only. Attachments are limited to 2 MB each and 4 MB total.</p>}
    {attachmentIssues[0] && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{attachmentIssues[0]}</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <button type="submit" disabled={sending || attachmentIssues.length > 0} className="rounded-lg bg-[#16869a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" data-testid="button-submit-agent-answers">{sending ? "Sending…" : "Submit answers"}</button>
  </form>;
}

const API = "/api/custom-workspaces";
const critiqueContinuationPrompt = (workspaceId: string) =>
  `Revise custom workspace draft ${workspaceId}. The initial build is saved. Start or continue the mandatory five-round independent critique now; do not wait for Publish. Inspect the current saved source, call critique_custom_workspace for rounds 1 through 5 in order, and call verify_custom_workspace_fixes after fixing each round's eligible findings. For rounds 1–4 fix every score above 6 and below 6; for round 5 fix every score above 6. If a critique or verification call fails, returns invalid output, or reports unresolved findings, keep editing the saved draft and retry that same critique/verification automatically until it passes. Do not stop between rounds, ask the coordinator to click Publish, create a duplicate, or publish automatically. Stop only when all five rounds are independently verified.`;
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'">`;
const BRIDGE = `<script>
(() => {
  let sequence = 0;
  const pending = new Map();
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !event.data || event.data.channel !== "workspace-bridge-result") return;
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    event.data.error ? entry.reject(new Error(event.data.error)) : entry.resolve(event.data.result);
  });
  const call = (method, payload) => new Promise((resolve, reject) => {
    const id = String(++sequence);
    pending.set(id, { resolve, reject });
    window.parent.postMessage({ channel: "workspace-bridge", id, method, payload }, "*");
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("Request timed out")); } }, 15000);
  });
  window.workspaceAPI = Object.freeze({
    data: Object.freeze({
      list: () => call("data.list"),
      create: (record) => call("data.create", { record }),
      update: (id, record) => call("data.update", { id, record }),
      delete: (id) => call("data.delete", { id }),
    }),
    llm: Object.freeze({ ask: (prompt) => call("llm.ask", { prompt }) })
  });
})();
</script>`;

function sandboxDocument(html: string, darkMode: boolean): string {
  const themeTokens = `<style>
:root {
  --background: 216 38% 96%; --foreground: 220 25% 16%; --border: 215 25% 86%;
  --card: 0 0% 100%; --card-foreground: 220 25% 16%; --card-border: 215 25% 87%;
  --primary: 190 76% 37%; --primary-foreground: 0 0% 100%; --secondary: 215 26% 91%;
  --secondary-foreground: 220 25% 21%; --muted: 215 26% 92%; --muted-foreground: 216 13% 44%;
  --accent: 42 91% 62%; --accent-foreground: 220 32% 13%; --input: 215 22% 80%; --ring: 190 76% 37%;
  --workspace-navy: #183a4b; --workspace-teal: #16869a; --workspace-yellow: #f8c84a;
  --app-font-sans: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  --app-font-mono: 'DM Mono', ui-monospace, monospace;
}
:root.dark {
  color-scheme: dark;
  --background: 220 32% 7%; --foreground: 210 20% 90%; --border: 215 20% 22%;
  --card: 218 28% 11%; --card-foreground: 210 20% 90%; --card-border: 215 20% 22%;
  --primary: 190 55% 55%; --primary-foreground: 220 32% 8%; --secondary: 215 22% 18%;
  --secondary-foreground: 210 18% 88%; --muted: 215 22% 16%; --muted-foreground: 214 14% 62%;
  --accent: 215 22% 18%; --accent-foreground: 210 20% 90%; --input: 215 20% 26%; --ring: 190 60% 55%;
  --workspace-navy: #e5edf2; --workspace-teal: #6fc3cf; --workspace-yellow: #e8c85a;
}
html, body { min-height: 100%; }
body { margin: 0; background: hsl(var(--background)); color: hsl(var(--foreground)); font-family: var(--app-font-sans); }
</style>`;
  const safeMeta = CSP + BRIDGE + themeTokens;
  const rootClass = darkMode ? "dark" : "";
  const themedHtml = /<html\b([^>]*)>/i.test(html)
    ? html.replace(/<html\b([^>]*)>/i, (_tag, attrs: string) => {
      const existingClass = attrs.match(/\bclass=(["'])(.*?)\1/i);
      if (existingClass) {
        const retainedClasses = existingClass[2].split(/\s+/).filter((name) => name && name !== "dark");
        if (rootClass) retainedClasses.push(rootClass);
        const classValue = retainedClasses.join(" ");
        return `<html${attrs.replace(existingClass[0], `class="${classValue}"`)}>`;
      }
      return `<html${attrs}${rootClass ? ` class="${rootClass}"` : ""}>`;
    })
    : html;
  if (/<head(?:\s[^>]*)?>/i.test(themedHtml)) return themedHtml.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${safeMeta}`);
  return `<!doctype html><html class="${rootClass}"><head>${safeMeta}</head><body>${themedHtml}</body></html>`;
}

function compileWorkspaceSourceFiles(sourceFiles: WorkspaceSourceFile[]): string | null {
  const files = new Map(sourceFiles.map((file) => [file.path, file.content]));
  const html = files.get("index.html");
  if (html === undefined) return null;
  return html
    .replace(/<link\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (tag, before: string, _quote: string, href: string, after: string) => {
      const css = files.get(href.replace(/^\.\//, ""));
      return css === undefined || !/stylesheet/i.test(`${before}${after}`) ? tag : `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
    })
    .replace(/<script\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (tag, before: string, _quote: string, src: string, after: string) => {
      const js = files.get(src.replace(/^\.\//, ""));
      return js === undefined ? tag : `<script${before}${after}>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
    });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getStoredAuthToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, credentials: "include", headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The request failed.");
  return body as T;
}

function builderActivityLabel(activity: BuilderRun["activities"][number]): string {
  if (activity.tool === "assistant_progress") return "Progress update";
  const tool = activity.tool.replaceAll("_", " ");
  if (activity.tool === "critique_custom_workspace" || activity.tool === "verify_custom_workspace_fixes") {
    try {
      const round = JSON.parse(activity.input ?? "{}").round;
      if (Number.isInteger(round) && round >= 1 && round <= 5) return `Review round ${round} · ${tool}`;
    } catch {
      // Older saved activity may not include structured input.
    }
  }
  return tool;
}

function builderRunSteps(run: BuilderRun): PublishAgentStep[] {
  const activities = run.activities;
  return activities.map((activity, index) => ({
    id: `run-${run.id}-${index}`,
    label: builderActivityLabel(activity),
    detail: activity.detail,
    input: activity.input,
    output: activity.output,
    status: "done",
  }));
}

function mergeBuilderRunSteps(current: PublishAgentStep[], incoming: PublishAgentStep[]): PublishAgentStep[] {
  const byId = new Map(current.map((step) => [step.id, step]));
  incoming.forEach((step) => byId.set(step.id, { ...byId.get(step.id), ...step }));
  return [...byId.values()];
}

function normalizeBuilderRun(run: AssistantBuilderRunResponse["run"]): BuilderRun | null {
  return run ? { ...run, question: run.question as AgentQuestion | null } : null;
}

export function CustomWorkspacesPage() {
  const { resolvedTheme } = useTheme();
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const canManage = session.data?.role === "coordinator";
  const [items, setItems] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [prompt, setPrompt] = useState("");
  const [builderModels, setBuilderModels] = useState<BuilderModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [sourceFiles, setSourceFiles] = useState<WorkspaceFile[]>([]);
  const [sourceFilesWorkspaceId, setSourceFilesWorkspaceId] = useState<string | null>(null);
  const [selectedSourcePath, setSelectedSourcePath] = useState("index.html");
  const [previewVersion, setPreviewVersion] = useState<VersionPreview | null>(null);
  const [previewVersionWorkspaceId, setPreviewVersionWorkspaceId] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>("team");
  const [allowedInterviewerIds, setAllowedInterviewerIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agentQuestion, setAgentQuestion] = useState<AgentQuestion | null>(null);
  const [builderRun, setBuilderRun] = useState<BuilderRun | null>(null);
  const builderRunRef = useRef<BuilderRun | null>(null);
  const autoResumeAttempts = useRef(new Map<string, number>());
  const [publishAgentSteps, setPublishAgentSteps] = useState<PublishAgentStep[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);
  const active = useMemo(() => selected ?? items[0] ?? null, [items, selected]);
  useEffect(() => { builderRunRef.current = builderRun; }, [builderRun]);

  const refresh = async () => {
    const result = await request<{ workspaces: Workspace[] }>(API);
    setItems(result.workspaces);
    setSelected((current) => current && result.workspaces.find((item) => item.id === current.id) || null);
  };
  useEffect(() => { void refresh().catch((err) => setError(err.message)); }, []);
  useEffect(() => {
    if (!canManage) return;
    void request<{ questions: AgentQuestion[] }>("/api/assistant/questions/pending")
      .then(({ questions }) => setAgentQuestion((current) => current ?? questions[0] ?? null))
      .catch(() => {});
  }, [canManage]);
  useEffect(() => {
    if (!canManage) return;
    let active = true;
    const reload = () => request<AssistantBuilderRunResponse>("/api/assistant/custom-workspace-builder/runs/latest")
      .then(({ run }) => {
        if (!active) return;
        const normalizedRun = normalizeBuilderRun(run);
        setBuilderRun(normalizedRun);
        if (normalizedRun?.activities.length) setPublishAgentSteps((steps) => mergeBuilderRunSteps(steps, builderRunSteps(normalizedRun)));
        if (normalizedRun?.question) setAgentQuestion(normalizedRun.question);
        else if (normalizedRun?.status === "completed" || normalizedRun?.status === "interrupted" || normalizedRun?.status === "failed") {
          setAgentQuestion(null);
        }
      })
      .catch(() => {});
    void reload();
    return () => { active = false; };
  }, [canManage]);
  useEffect(() => {
    if (!canManage || !builderRun || !["running", "waiting_for_answer"].includes(builderRun.status)) return;
    let active = true;
    const refreshRun = async () => {
      try {
        const { run } = await request<AssistantBuilderRunResponse>("/api/assistant/custom-workspace-builder/runs/latest");
        if (!active || !run) return;
        const normalizedRun = normalizeBuilderRun(run);
        setBuilderRun(normalizedRun);
        if (normalizedRun?.activities.length) setPublishAgentSteps((steps) => mergeBuilderRunSteps(steps, builderRunSteps(normalizedRun)));
        setAgentQuestion(normalizedRun?.question ?? null);
      } catch {}
    };
    const timer = window.setInterval(() => void refreshRun(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [canManage, builderRun?.id, builderRun?.status]);
  useEffect(() => {
    if (!canManage) return;
    void request<{ items: { id: string; question: string; activities: { tool: string; detail: string; input?: string; output?: string }[] }[] }>("/api/assistant/history")
      .then(({ items: history }) => {
        const workspaceReviewRuns = history.filter((item) =>
          item.question.includes("Revise custom workspace draft ") &&
          (active?.id ? item.question.includes(active.id) : false),
        );
        const latestPrompt = builderRunRef.current?.prompt;
        const latestSavedRunIndex = latestPrompt
          ? workspaceReviewRuns.findLastIndex((item) => item.question === latestPrompt)
          : -1;
        if (latestSavedRunIndex >= 0) workspaceReviewRuns.splice(latestSavedRunIndex, 1);
        const savedSteps = workspaceReviewRuns.flatMap((item) => item.activities.map((activity, index) => ({
          id: `history-${item.id}-${index}`,
          label: activity.tool === "assistant_progress"
            ? "Progress update"
            : builderActivityLabel(activity as BuilderRun["activities"][number]),
          detail: activity.detail,
          input: activity.input,
          output: activity.output,
          status: "done" as const,
        })));
        if (savedSteps.length) setPublishAgentSteps((steps) => mergeBuilderRunSteps(steps, savedSteps));
      })
      .catch(() => {});
  }, [canManage, active?.id]);
  useEffect(() => {
    if (!canManage) return;
    let active = true;
    setModelsLoading(true);
    setModelsError("");
    void Promise.all([
      request<{ items: BuilderModel[] }>("/api/assistant/models"),
      request<{ textModel: string }>("/api/assistant/config"),
    ]).then(([catalog, config]) => {
      if (!active) return;
      setBuilderModels(catalog.items);
      let savedModel = "";
      try { savedModel = window.localStorage.getItem("robotics-assistant-model") ?? ""; } catch {}
      const initial = resolveAssistantModelSelection(savedModel, config.textModel, catalog.items);
      setSelectedModel(initial);
      if (initial) {
        try { window.localStorage.setItem("robotics-assistant-model", initial); } catch {}
      }
    }).catch((err) => {
      if (active) setModelsError(err instanceof Error ? err.message : "Model list unavailable.");
    }).finally(() => {
      if (active) setModelsLoading(false);
    });
    return () => { active = false; };
  }, [canManage]);
  useEffect(() => {
    setAccessMode(active?.accessMode ?? "team");
    setAllowedInterviewerIds(active?.allowedInterviewerIds ?? []);
  }, [active?.id, active?.accessMode, JSON.stringify(active?.allowedInterviewerIds ?? [])]);
  useEffect(() => {
    if (!canManage) return;
    setTeamMembersLoading(true);
    void request<{ members: TeamMember[] }>(`${API}/team-members`)
      .then((result) => setTeamMembers(result.members))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load team members."))
      .finally(() => setTeamMembersLoading(false));
  }, [canManage]);
  useEffect(() => {
    setPreviewVersion(null);
    setPreviewVersionWorkspaceId(null);
    if (!active || !canManage) {
      setVersions([]);
      return;
    }
    let current = true;
    void request<{ versions: Version[] }>(`${API}/${active.id}/versions`)
      .then((result) => { if (current) setVersions(result.versions); })
      .catch((err) => { if (current) setError(err instanceof Error ? err.message : "Could not load version history."); });
    return () => { current = false; };
  }, [active?.id, active?.status, canManage]);
  useEffect(() => {
    if (!active || !canManage) {
      setSourceFiles([]);
      setSourceFilesWorkspaceId(null);
      setSelectedSourcePath("");
      return;
    }
    let current = true;
    setSourceFiles([]);
    setSourceFilesWorkspaceId(null);
    setSelectedSourcePath("index.html");
    void request<{ files: WorkspaceFile[] }>(`${API}/${active.id}/files`)
      .then(({ files }) => {
        if (!current) return;
        setSourceFiles(files);
        setSourceFilesWorkspaceId(active.id);
        setSelectedSourcePath((current) => files.some((file) => file.path === current) ? current : files[0]?.path ?? "");
      })
      .catch((err) => {
        if (!current) return;
        setSourceFiles([]);
        setSourceFilesWorkspaceId(active.id);
        setSelectedSourcePath("");
        setError(err instanceof Error ? err.message : "Could not load the source files.");
      });
    return () => { current = false; };
  }, [active?.id, active?.status, canManage]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent<BridgeRequest>) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== "workspace-bridge") return;
      const message = event.data;
      const respond = (result?: unknown, errorText?: string) => {
        frame.current?.contentWindow?.postMessage({
          channel: "workspace-bridge-result", id: message.id, result, error: errorText,
        }, "*");
      };
      if (!active) return respond(undefined, "Workspace not found.");
      try {
        if (message.method === "data.list" && active.capabilities.includes("data")) {
          respond((await request<{ records: unknown[] }>(`${API}/${active.id}/data`)).records);
        } else if (message.method === "data.create" && active.capabilities.includes("data")) {
          const record = (message.payload as { record?: unknown } | undefined)?.record;
          respond((await request<{ record: unknown }>(`${API}/${active.id}/data`, {
            method: "POST", body: JSON.stringify({ record }),
          })).record);
        } else if (message.method === "data.update" && active.capabilities.includes("data")) {
          const { id, record } = (message.payload ?? {}) as { id?: unknown; record?: unknown };
          respond((await request<{ record: unknown }>(`${API}/${active.id}/data/${encodeURIComponent(String(id ?? ""))}`, {
            method: "PATCH", body: JSON.stringify({ record }),
          })).record);
        } else if (message.method === "data.delete" && active.capabilities.includes("data")) {
          const { id } = (message.payload ?? {}) as { id?: unknown };
          respond(await request<{ deleted: boolean }>(`${API}/${active.id}/data/${encodeURIComponent(String(id ?? ""))}`, {
            method: "DELETE",
          }));
        } else if (message.method === "llm.ask" && active.capabilities.includes("llm")) {
          const prompt = (message.payload as { prompt?: unknown } | undefined)?.prompt;
          respond((await request<{ answer: string }>(`${API}/${active.id}/llm`, {
            method: "POST", body: JSON.stringify({ prompt }),
          })).answer);
        } else respond(undefined, "This workspace has not been granted that capability.");
      } catch (err) {
        respond(undefined, err instanceof Error ? err.message : "The capability request failed.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active]);

  const runBuilderAgent = async (question: string, beforeIds: Set<string>): Promise<BuilderRun | null> => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = getStoredAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch("/api/assistant/ask/stream", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ question, ...(selectedModel ? { model: selectedModel } : {}) }),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "The builder agent could not start.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;
    let streamRunId = "";
    let activityFallbackIndex = 0;
    const acceptEvent = (raw: string) => {
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        let event: Record<string, unknown>;
        try { event = JSON.parse(line.slice(5).trim()) as Record<string, unknown>; } catch { continue; }
        if (typeof event.builderRunId === "string") {
          streamRunId = event.builderRunId;
          setBuilderRun((current) => current?.id === event.builderRunId ? current : {
            id: event.builderRunId as string,
            status: "running",
            prompt: question,
            question: null,
            answers: {},
            activities: [],
            result: null,
            error: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        if (event.toolCallStart && typeof event.toolCallStart === "object") {
          const toolCall = event.toolCallStart as { tool?: unknown; input?: unknown };
          const tool = typeof toolCall.tool === "string" ? toolCall.tool : "assistant tool";
          setPublishAgentSteps((steps) => [...steps, {
            id: `tool-start-${steps.length}-${tool}`,
            label: tool.replaceAll("_", " "),
            detail: "Running",
            input: typeof toolCall.input === "string" ? toolCall.input : undefined,
            status: "running",
          }]);
        }
        if (event.activity && typeof event.activity === "object") {
          const activity = event.activity as { tool?: unknown; detail?: unknown; input?: unknown; output?: unknown };
          const tool = typeof activity.tool === "string" ? activity.tool : "Assistant tool";
          const detail = typeof activity.detail === "string" ? activity.detail : "";
          const incoming = {
            id: streamRunId && Number.isInteger(event.activityIndex)
              ? `run-${streamRunId}-${Number(event.activityIndex)}`
              : `agent-${tool}-${activityFallbackIndex++}`,
            label: builderActivityLabel({
              tool,
              detail,
              input: typeof activity.input === "string" ? activity.input : undefined,
              output: typeof activity.output === "string" ? activity.output : undefined,
            } as BuilderRun["activities"][number]),
            detail,
            input: typeof activity.input === "string" ? activity.input : undefined,
            output: typeof activity.output === "string" ? activity.output : undefined,
            status: "done" as const,
          };
          setPublishAgentSteps((steps) => {
            const pendingIndex = steps.findIndex((step) =>
              step.status === "running" &&
              step.id.startsWith("tool-start-") &&
              step.label === tool.replaceAll("_", " "),
            );
            if (pendingIndex < 0) return mergeBuilderRunSteps(steps, [incoming]);
            const next = [...steps];
            next[pendingIndex] = { ...next[pendingIndex], ...incoming };
            return next;
          });
        }
        if (event.question && typeof event.question === "object") {
          const question = event.question as AgentQuestion;
          if (typeof question.id === "string" && Array.isArray(question.questions)) setAgentQuestion(question);
        }
        if (typeof event.error === "string") throw new Error(event.error);
        if (event.done === true) done = true;
      }
    };
    while (true) {
      const { value, done: ended } = await reader.read();
      buffer += decoder.decode(value, { stream: !ended });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      frames.forEach(acceptEvent);
      if (ended) break;
    }
    if (buffer.trim()) acceptEvent(buffer);
    if (!done) throw new Error("The builder agent ended without completing its response.");
    const { run } = await request<AssistantBuilderRunResponse>("/api/assistant/custom-workspace-builder/runs/latest");
    const normalizedRun = normalizeBuilderRun(run);
    setBuilderRun(normalizedRun);
    if (normalizedRun?.activities.length) setPublishAgentSteps((steps) => mergeBuilderRunSteps(steps, builderRunSteps(normalizedRun)));
    const result = await request<{ workspaces: Workspace[] }>(API);
    setItems(result.workspaces);
    const created = result.workspaces.find((workspace) => !beforeIds.has(workspace.id));
    if (created) setSelected(created);
    else if (active) setSelected(result.workspaces.find((workspace) => workspace.id === active.id) ?? active);
    const target = created ?? active;
    if (target) {
      const { files } = await request<{ files: WorkspaceFile[] }>(`${API}/${target.id}/files`);
      setSourceFiles(files);
      setSourceFilesWorkspaceId(target.id);
      setSelectedSourcePath((current) => files.some((file) => file.path === current) ? current : files[0]?.path ?? "");
    }
    return normalizedRun;
  };

  const generate = async () => {
    setError("");
    setBusy(true);
    setPublishAgentSteps([{ id: "generate", label: "Start workspace agent", detail: "The assistant will build the app through multiple tool rounds.", status: "running" }]);
    try {
      const beforeIds = new Set(items.map((item) => item.id));
      const capabilityText = capabilities.length ? capabilities.join(", ") : "none";
      await runBuilderAgent(`Build a custom workspace app for the team. Requirements: ${prompt}\n\nOnly grant these workspace capabilities: ${capabilityText}. Create the draft, then use the custom workspace file tools to inspect and refine its persistent source tree. Immediately after the initial draft and source files are saved, start critique round 1 and continue through all five independently verified rounds without waiting for Publish. If a critique or verification fails, keep editing and retry automatically. Keep it as a draft for coordinator review; do not publish.`, beforeIds);
      const { workspaces } = await request<{ workspaces: Workspace[] }>(API);
      const draft = workspaces.find((workspace) => !beforeIds.has(workspace.id) && workspace.status === "draft");
      if (draft) {
        let verifiedRounds = 0;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const { workspaces: latest } = await request<{ workspaces: Workspace[] }>(API);
          const current = latest.find((workspace) => workspace.id === draft.id);
          if (!current) throw new Error("The new draft could not be reloaded to verify its critique progress.");
          const completed = Number(current.critiqueRounds ?? 0);
          verifiedRounds = Number(current.verifiedCritiqueRounds ?? 0);
          if (completed >= 5 && verifiedRounds >= 5) break;
          const nextRound = Math.min(completed, verifiedRounds) + 1;
          setPublishAgentSteps((steps) => [
            ...steps.map((step) => step.status === "running" ? { ...step, status: "done" as const } : step),
            {
              id: `automatic-critique-${attempt + 1}`,
              label: `Complete critique round ${nextRound} of 5`,
              detail: "The builder continues automatically; no Publish action is needed to start reviews.",
              status: "running",
            },
          ]);
          let reviewRun: BuilderRun | null = null;
          for (let retry = 0; retry < 3; retry += 1) {
            try {
              reviewRun = await runBuilderAgent(
                critiqueContinuationPrompt(draft.id),
                new Set(latest.map((workspace) => workspace.id)),
              );
              if (reviewRun?.status === "failed" || reviewRun?.status === "interrupted") {
                throw new Error("The workspace builder stopped before completing this review round.");
              }
              break;
            } catch (err) {
              if (retry === 2) throw err;
              await new Promise((resolve) => window.setTimeout(resolve, 1000 * 2 ** retry));
            }
          }
          if (reviewRun?.status === "waiting_for_answer") {
            throw new Error("The workspace agent needs your answer before it can finish the critique rounds. Answer its question to continue.");
          }
          if (reviewRun?.status === "failed" || reviewRun?.status === "interrupted") {
            throw new Error("The workspace agent stopped before completing all critique rounds. The draft is saved; continue the builder to resume.");
          }
        }
        const { workspaces: verified } = await request<{ workspaces: Workspace[] }>(API);
        const finalDraft = verified.find((workspace) => workspace.id === draft.id);
        if (Number(finalDraft?.critiqueRounds ?? 0) < 5 || Number(finalDraft?.verifiedCritiqueRounds ?? 0) < 5) {
          throw new Error("The draft is saved, but the agent stopped before all five critique rounds were verified. Continue the builder to resume.");
        }
      }
      setPrompt("");
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "done", detail: "Agent turn complete." } : step));
    } catch (err) {
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "failed" as const } : step));
      setError(err instanceof Error ? err.message : "Could not build the workspace.");
    } finally {
      setBusy(false);
    }
  };
  const continueInterruptedBuilder = async () => {
    if (!builderRun || !canManage) return;
    setBusy(true);
    setError("");
    setPublishAgentSteps([{ id: "recover", label: "Continue builder", detail: "Starting a new server run from the saved request, answers, and draft files.", status: "running" }]);
    try {
      const savedAnswers = Object.keys(builderRun.answers).length
        ? `\n\nCoordinator answers to the saved builder question (use these directly and do not ask the same questions again):\n${JSON.stringify(builderRun.answers)}`
        : "";
      const recoveryPrompt = `${builderRun.prompt}\n\nContinue this existing custom workspace build from its saved draft files. Do not create a duplicate workspace if a draft for this request already exists.${savedAnswers}`;
      await runBuilderAgent(recoveryPrompt, new Set(items.map((item) => item.id)));
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "done", detail: "Builder run complete." } : step));
    } catch (err) {
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "failed" as const } : step));
      setError(err instanceof Error ? err.message : "Could not continue the builder.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (
      !canManage ||
      busy ||
      !active ||
      active.status !== "draft" ||
      !builderRun ||
      !["failed", "interrupted"].includes(builderRun.status) ||
      builderRun.question ||
      Number(active.critiqueRounds ?? 0) >= 5 ||
      Number(active.verifiedCritiqueRounds ?? 0) >= 5
    ) return;

    const isThisDraft = builderRun.prompt.includes(active.id);
    const attempts = autoResumeAttempts.current.get(active.id) ?? 0;
    if (!isThisDraft || attempts >= 3) return;
    autoResumeAttempts.current.set(active.id, attempts + 1);

    setBusy(true);
    setError("");
    setPublishAgentSteps([{ id: `auto-resume-${attempts + 1}`, label: "Resume workspace reviews", detail: "Continuing the saved draft automatically.", status: "running" }]);
    void (async () => {
      try {
        for (let round = 0; round < 5; round += 1) {
          const { workspaces } = await request<{ workspaces: Workspace[] }>(API);
          const latest = workspaces.find((workspace) => workspace.id === active.id);
          if (!latest || (Number(latest.critiqueRounds ?? 0) >= 5 && Number(latest.verifiedCritiqueRounds ?? 0) >= 5)) break;
          const resumed = await runBuilderAgent(
            critiqueContinuationPrompt(active.id),
            new Set(workspaces.map((workspace) => workspace.id)),
          );
          if (resumed?.status === "waiting_for_answer") return;
          if (resumed?.status === "failed" || resumed?.status === "interrupted") {
            throw new Error("The workspace builder stopped again. It will retry automatically.");
          }
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not resume workspace reviews.");
      } finally {
        setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "done", detail: "Automatic continuation finished." } : step));
        setBusy(false);
      }
    })();
  }, [active?.id, active?.status, active?.critiqueRounds, active?.verifiedCritiqueRounds, builderRun?.id, builderRun?.status, builderRun?.question, canManage, busy]);
  const publish = async () => {
    if (!active) return;
    if (Number(active.critiqueRounds ?? 0) < 5 || Number(active.verifiedCritiqueRounds ?? 0) < 5) {
      setError("Publishing becomes available after the builder completes and verifies all five review rounds.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await request<{ workspace: Workspace }>(`${API}/${active.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ accessMode, allowedInterviewerIds }),
      });
      setSelected(result.workspace);
      setPublishAgentSteps([{ id: "published", label: "Publish workspace", detail: "Published.", status: "done" }]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish the workspace.");
    } finally {
      setBusy(false);
    }
  };
  const saveAccess = async () => {
    if (!active) return;
    if (active.status === "draft") return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ workspace: Workspace }>(`${API}/${active.id}/access`, {
        method: "PATCH", body: JSON.stringify({ accessMode, allowedInterviewerIds }),
      });
      setSelected(result.workspace);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update workspace access.");
    } finally {
      setBusy(false);
    }
  };
  const revise = async () => {
    if (!active || !revisionPrompt.trim()) return;
    setBusy(true);
    setError("");
    setPublishAgentSteps([{ id: "revise", label: "Start workspace revision agent", detail: "The assistant will inspect and edit the saved source tree.", status: "running" }]);
    try {
      await runBuilderAgent(`Revise custom workspace draft ${active.id}. Requested changes: ${revisionPrompt}\n\nUse list_custom_workspace_files and read_custom_workspace_file before editing. Keep the changes in this draft's persistent source tree and do not publish.`, new Set(items.map((item) => item.id)));
      setRevisionPrompt("");
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "done", detail: "Agent turn complete." } : step));
    } catch (err) {
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "failed" } : step));
      setError(err instanceof Error ? err.message : "Could not revise the workspace.");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (versionId: string) => {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ workspace: Workspace }>(`${API}/${active.id}/versions/${versionId}/restore`, {
        method: "POST", body: "{}",
      });
      setSelected(result.workspace);
      const files = await request<{ files: WorkspaceFile[] }>(`${API}/${active.id}/files`);
      setSourceFiles(files.files);
      setSourceFilesWorkspaceId(active.id);
      setSelectedSourcePath((current) => files.files.some((file) => file.path === current) ? current : files.files[0]?.path ?? "");
      const history = await request<{ versions: Version[] }>(`${API}/${active.id}/versions`);
      setVersions(history.versions);
      setPreviewVersion(null);
      setPreviewVersionWorkspaceId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore the selected version.");
    } finally {
      setBusy(false);
    }
  };
  const preview = async (versionId: string) => {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ version: VersionPreview }>(`${API}/${active.id}/versions/${versionId}`);
      const savedVersion = {
        ...result.version,
        sourceFiles: Array.isArray(result.version.sourceFiles)
          ? result.version.sourceFiles
          : [{ path: "index.html", content: result.version.html }],
      };
      setPreviewVersion(savedVersion);
      setPreviewVersionWorkspaceId(active.id);
      setSelectedSourcePath((current) =>
        savedVersion.sourceFiles.some((file) => file.path === current)
          ? current
          : savedVersion.sourceFiles[0]?.path ?? "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview the selected version.");
    } finally {
      setBusy(false);
    }
  };

  const accessChanged = active && (
    active.accessMode !== accessMode ||
    [...(active.allowedInterviewerIds ?? [])].sort().join("\0") !== [...allowedInterviewerIds].sort().join("\0")
  );
  const chooseModel = (model: string) => {
    setSelectedModel(model);
    try {
      if (model) window.localStorage.setItem("robotics-assistant-model", model);
    } catch {}
  };
  const currentPreviewVersion = previewVersionWorkspaceId === active?.id ? previewVersion : null;
  const currentSourceFiles = sourceFilesWorkspaceId === active?.id ? sourceFiles : [];
  const visibleSourceFiles = currentPreviewVersion?.sourceFiles ?? currentSourceFiles;
  const previewHtml = currentPreviewVersion
    ? compileWorkspaceSourceFiles(currentPreviewVersion.sourceFiles) || currentPreviewVersion.html
    : compileWorkspaceSourceFiles(currentSourceFiles) || active?.html || "";

  return <main className="mx-auto w-full max-w-7xl p-4 md:p-8">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#16869a] dark:text-[#75d2cf]"><Sparkles size={14} /> AI workspace builder</p>
        <h1 className="text-2xl font-bold text-[#183a4b] dark:text-[#e9f1f4] md:text-3xl">Build a workspace for your team</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#60757c] dark:text-[#b3c3cb]">Describe the tool you need. The assistant builds a custom app, which stays a draft until you review and publish it.</p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--foreground))]"><Code2 size={14} /> Isolated app preview</span>
    </div>
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
          <label htmlFor="workspace-prompt" className="text-sm font-semibold text-[hsl(var(--foreground))]">What should this workspace do?</label>
          {!canManage && <p className="mt-2 rounded-lg bg-[hsl(var(--muted))] p-2.5 text-xs text-[hsl(var(--foreground))]">Only coordinators can create, revise, publish, or change access for custom apps.</p>}
          <textarea id="workspace-prompt" disabled={!canManage} value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} maxLength={8000} placeholder="Example: Build a parts catalog for our robot. Track part names, suppliers, prices, and stock; let the team search and add records." className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-base md:text-sm text-[hsl(var(--foreground))] outline-none focus:ring-2 focus:ring-[#16869a] disabled:opacity-60" />
          <label className="mt-4 grid gap-1.5 text-xs font-semibold text-[hsl(var(--foreground))]">
            <span>AI model</span>
            <select
              aria-label="Workspace builder model"
              data-testid="workspace-builder-model"
              value={selectedModel}
              onChange={(event) => chooseModel(event.target.value)}
              disabled={!canManage || modelsLoading || builderModels.length === 0}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-base md:text-sm font-normal text-[hsl(var(--foreground))] disabled:opacity-60"
            >
              {builderModels.length === 0 && <option value="">{modelsLoading ? "Loading models…" : "Default assistant model"}</option>}
              {builderModels.map((model) => <option key={model.id} value={model.id}>{model.name || model.id}</option>)}
            </select>
            {modelsError && <span className="font-normal text-amber-700 dark:text-amber-300">Model list unavailable; builds will use the server default.</span>}
          </label>
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[#60757c] dark:text-[#b3c3cb]">Allow capabilities</legend>
            <label className="mt-3 flex items-start gap-2 text-sm text-[hsl(var(--foreground))]"><input type="checkbox" disabled={!canManage} checked={capabilities.includes("data")} onChange={(event) => setCapabilities((old) => event.target.checked ? [...old, "data"] : old.filter((value) => value !== "data"))} /> <span><b>Workspace data</b><small className="block text-xs text-[#60757c] dark:text-[#b3c3cb]">Store records in the shared database, isolated to this workspace.</small></span></label>
            <label className="mt-3 flex items-start gap-2 text-sm text-[hsl(var(--foreground))]"><input type="checkbox" disabled={!canManage} checked={capabilities.includes("llm")} onChange={(event) => setCapabilities((old) => event.target.checked ? [...old, "llm"] : old.filter((value) => value !== "llm"))} /> <span><b>Managed LLM access</b><small className="block text-xs text-[#60757c] dark:text-[#b3c3cb]">Make server-mediated AI requests without exposing credentials.</small></span></label>
          </fieldset>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
          <button type="button" disabled={!canManage || busy || !prompt.trim()} onClick={() => void generate()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16869a] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />} {busy ? "Building…" : "Generate draft"}
          </button>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Your workspaces</h2>
          <div className="mt-3 space-y-2">
            {items.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)} className={`w-full rounded-xl border p-3 text-left transition ${active?.id === item.id ? "border-[#16869a] bg-[#e9f5f4] dark:bg-[#15353d]" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"}`}>
              <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{item.title}</span><span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] uppercase text-[hsl(var(--foreground))]">{item.status}</span></span>
              <span className="mt-1 block line-clamp-2 text-xs text-[#60757c] dark:text-[#b3c3cb]">{item.description}</span>
            </button>)}
            {!items.length && <p className="text-sm text-[#60757c] dark:text-[#b3c3cb]">No custom workspaces yet.</p>}
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] p-4">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-[hsl(var(--foreground))]">{active?.title ?? "Preview"}</h2>
            <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">{currentPreviewVersion ? `Previewing saved version · ${currentPreviewVersion.message}` : active ? `${active.status === "published" ? "Published" : "Draft"} · ${active.capabilities.join(" · ") || "No capabilities"}` : "Generate an app to see it here."}</p>
          </div>
          {active && canManage && <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-[hsl(var(--foreground))]">
              <span>Who can use this app?</span>
              <select aria-label="Who can use this app?" value={accessMode} disabled={busy} onChange={(event) => setAccessMode(event.target.value as AccessMode)} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-base md:text-sm text-[hsl(var(--foreground))]">
                <option value="team">Everyone on the team</option>
                <option value="owner">Only the creator</option>
                <option value="selected">Choose teammates</option>
              </select>
            </label>
            {active.status === "published" && <button type="button" disabled={busy || !accessChanged} onClick={() => void saveAccess()} className="rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save access</button>}
          </div>}
          {active && canManage && active.status === "draft" && Number(active.critiqueRounds ?? 0) >= 5 && Number(active.verifiedCritiqueRounds ?? 0) >= 5 && <button type="button" disabled={busy} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-lg bg-[#183a4b] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-[#e6f0f2] dark:text-[#183a4b]"><Rocket size={14} /> Publish</button>}
          {active && canManage && active.status === "draft" && (Number(active.critiqueRounds ?? 0) < 5 || Number(active.verifiedCritiqueRounds ?? 0) < 5) && <span className="text-xs text-[#60757c] dark:text-[#b3c3cb]" data-testid="publish-readiness">
            Builder reviews: {Number(active.critiqueRounds ?? 0)}/5 complete, {Number(active.verifiedCritiqueRounds ?? 0)}/5 verified
          </span>}
          {active?.status === "published" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><Check size={13} /> Live</span>}
        </div>
        {(publishAgentSteps.length > 0 || agentQuestion || builderRun) && <section className="border-b border-[hsl(var(--border))] p-4" aria-live="polite" data-testid="publish-agent-activity">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Builder agent activity</h3>
          <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">Review progress and tool calls are shown here. Private internal reasoning is not displayed. Publishing is available after all five review rounds are independently verified.</p>
          {builderRun && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--foreground))]" data-testid="builder-run-status">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${builderRun.status === "completed" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : builderRun.status === "interrupted" || builderRun.status === "failed" ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "bg-[hsl(var(--muted))]"}`}>
              {builderRun.status === "waiting_for_answer" ? "Waiting for your answer" :
                builderRun.status === "running" ? "Building" :
                  builderRun.status === "completed" ? "Complete" :
                    builderRun.status === "interrupted" ? "Stopped — can continue" : "Could not finish — can continue"}
            </span>
            <span className="text-[#60757c] dark:text-[#b3c3cb]">Last updated {new Date(builderRun.updatedAt).toLocaleString()}</span>
          </div>}
          {builderRun?.error && <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{builderRun.error}</p>}
          <ol className="mt-2 space-y-2">
            {publishAgentSteps.map((step) => <li key={step.id} className="flex items-start gap-2 text-xs text-[hsl(var(--foreground))]">
              <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${step.status === "done" ? "bg-emerald-500" : step.status === "failed" ? "bg-red-500" : "animate-pulse bg-[#16869a]"}`} />
              <span className="min-w-0 flex-1"><b>{step.label}</b>{step.detail && <span className="ml-1 text-[#60757c] dark:text-[#b3c3cb]">{step.detail}</span>}
                {(step.input || step.output) && <details className="mt-1" open>
                  <summary className="cursor-pointer text-[11px] font-medium text-[#16869a]">Tool call details</summary>
                  {step.input && <><span className="mt-1 block font-semibold">Input</span><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2">{step.input}</pre></>}
                  {step.output && <><span className="mt-1 block font-semibold">Result</span><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2">{step.output}</pre></>}
                </details>}
              </span>
            </li>)}
          </ol>
          {agentQuestion && <AgentQuestionCard question={agentQuestion} onSubmit={async (answers) => {
            await request(`/api/assistant/questions/${encodeURIComponent(agentQuestion.id)}/answer`, {
              method: "POST",
              body: JSON.stringify({ answers }),
            });
            setAgentQuestion(null);
            const latest = await request<AssistantBuilderRunResponse>("/api/assistant/custom-workspace-builder/runs/latest");
            setBuilderRun(normalizeBuilderRun(latest.run));
          }} />}
          {(builderRun?.status === "interrupted" || builderRun?.status === "failed") && !builderRun.question && <button
            type="button"
            disabled={busy}
            onClick={() => void continueInterruptedBuilder()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            data-testid="button-continue-builder"
          >
            {busy && <LoaderCircle size={14} className="animate-spin" />} Continue builder
          </button>}
          {builderRun?.result && <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3" data-testid="builder-run-result">
            <h4 className="text-xs font-semibold text-[hsl(var(--foreground))]">Latest builder result</h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--foreground))]">{builderRun.result}</p>
          </div>}
        </section>}
        {active && canManage && <section className="border-b border-[hsl(var(--border))] p-4" aria-label="Workspace source tree" data-testid="workspace-source-tree">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Source tree</h3>
          {currentPreviewVersion && <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">Showing files from the selected saved version.</p>}
          {!visibleSourceFiles.length
            ? <p className="mt-2 text-xs text-[#60757c] dark:text-[#b3c3cb]">No source files have been saved for this workspace yet.</p>
            : <div className="mt-2 grid gap-3 md:grid-cols-[minmax(160px,240px)_minmax(0,1fr)]">
              <ul className="max-h-48 space-y-1 overflow-auto" aria-label="Source files">
                {visibleSourceFiles.map((file) => <li key={file.path}>
                  <button type="button" aria-pressed={selectedSourcePath === file.path} onClick={() => setSelectedSourcePath(file.path)} className={`w-full truncate rounded-md px-2 py-1 text-left font-mono text-xs ${selectedSourcePath === file.path ? "bg-[#e9f5f4] text-[#145d6c] dark:bg-[#15353d] dark:text-[#a5e4df]" : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"}`}>{file.path}</button>
                </li>)}
              </ul>
              <pre className="max-h-64 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 font-mono text-[11px] leading-relaxed text-[hsl(var(--foreground))]"><code>{visibleSourceFiles.find((file) => file.path === selectedSourcePath)?.content ?? ""}</code></pre>
            </div>}
        </section>}
        {active && canManage && accessMode === "selected" && <div className="border-b border-[hsl(var(--border))] p-4">
          <fieldset disabled={busy}>
            <legend className="text-sm font-semibold text-[hsl(var(--foreground))]">Choose teammates</legend>
            <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">Only selected accounts can open this app or use its data and AI tools.</p>
            {teamMembers.length
              ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {teamMembers.map((member) => <li key={member.id}>
                  <label className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]">
                    <input type="checkbox" data-testid={`checkbox-workspace-member-${member.id}`} checked={allowedInterviewerIds.includes(member.id)} onChange={(event) => setAllowedInterviewerIds((current) => event.target.checked
                      ? [...new Set([...current, member.id])]
                      : current.filter((id) => id !== member.id))} />
                    <span>{member.displayName}</span>
                  </label>
                </li>)}
              </ul>
              : <p className="mt-3 text-sm text-[#60757c] dark:text-[#b3c3cb]">{teamMembersLoading ? "Loading team members…" : "No teammates are available."}</p>}
          </fieldset>
        </div>}
        {currentPreviewVersion && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-2">
          <span className="text-xs text-[hsl(var(--foreground))]">Saved {new Date(currentPreviewVersion.createdAt).toLocaleString()} · capabilities at save: {currentPreviewVersion.capabilities.join(" · ") || "none"}</span>
          <button type="button" data-testid="button-return-current-app" disabled={busy} onClick={() => setPreviewVersion(null)} className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs font-semibold text-[hsl(var(--foreground))]">Return to current app</button>
        </div>}
        {previewHtml
          ? <iframe ref={frame} title={`${active?.title ?? "Workspace"} ${currentPreviewVersion ? "saved version" : "preview"}`} sandbox="allow-scripts" srcDoc={sandboxDocument(previewHtml, resolvedTheme === "dark")} className="h-[70vh] min-h-[520px] w-full bg-white dark:bg-[#0b141b]" />
          : <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm text-[#60757c] dark:text-[#b3c3cb]"><div><Plus size={28} className="mx-auto mb-3 opacity-50" />{active ? "This workspace has no previewable index.html yet." : "Describe a workspace to generate its first draft."}</div></div>}
        {active?.status === "draft" && canManage && <div className="border-t border-[hsl(var(--border))] p-4">
          <label htmlFor="workspace-revision" className="text-sm font-semibold text-[hsl(var(--foreground))]">Revise this draft</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="workspace-revision" value={revisionPrompt} onChange={(event) => setRevisionPrompt(event.target.value)} maxLength={4000} placeholder="Describe what to change or add…" className="min-w-0 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-base md:text-sm text-[hsl(var(--foreground))]" />
            <button type="button" disabled={busy || !revisionPrompt.trim()} onClick={() => void revise()} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold text-[hsl(var(--foreground))] disabled:opacity-50">Revise</button>
          </div>
        </div>}
        {active && versions.length > 0 && <div className="border-t border-[hsl(var(--border))] p-4">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Version history</h3>
          <ul className="mt-2 space-y-2">
            {versions.map((version) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#60757c] dark:text-[#b3c3cb]">{version.message} · {new Date(version.createdAt).toLocaleString()}</span>
              {canManage && <span className="flex gap-2">
                <button type="button" data-testid={`button-preview-version-${version.id}`} disabled={busy} onClick={() => void preview(version.id)} className="rounded-md border border-[hsl(var(--border))] px-2 py-1 font-semibold text-[hsl(var(--foreground))] disabled:opacity-50">Preview</button>
                <button type="button" data-testid={`button-restore-version-${version.id}`} disabled={busy} onClick={() => void restore(version.id)} className="rounded-md border border-[hsl(var(--border))] px-2 py-1 font-semibold text-[hsl(var(--foreground))] disabled:opacity-50">Restore</button>
              </span>}
            </li>)}
          </ul>
        </div>}
      </section>
    </div>
  </main>;
}
