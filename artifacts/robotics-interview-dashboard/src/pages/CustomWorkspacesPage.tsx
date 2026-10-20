import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Code2, LoaderCircle, Plus, Rocket, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { getGetSessionQueryKey, useGetSession, type CustomWorkspace, type CustomWorkspaceVersion } from "@workspace/api-client-react";
import { getStoredAuthToken } from "../authSession";
import { resolveAssistantModelSelection } from "../lib/assistantModelSelection";

type Capability = CustomWorkspace["capabilities"][number];
type Workspace = CustomWorkspace;
type Version = CustomWorkspaceVersion;
type WorkspaceSourceFile = { path: string; content: string };
type VersionPreview = Version & { html: string; capabilities: Capability[]; sourceFiles: WorkspaceSourceFile[] };
type WorkspaceFile = { path: string; content: string; updatedAt: string };
type AccessMode = Workspace["accessMode"];
type TeamMember = { id: string; displayName: string };
type BuilderModel = { id: string; name?: string };
type BridgeRequest = { channel: "workspace-bridge"; id: string; method: string; payload?: unknown };
type PublishAgentEvent = {
  type: "tool_start" | "tool_done" | "screenshot" | "review" | "complete" | "failed";
  id?: string;
  tool?: string;
  detail?: string;
  image?: string;
  theme?: "light" | "dark";
  passed?: boolean;
  issues?: string[];
  message?: string;
  workspace?: Workspace;
};
type PublishAgentStep = { id: string; label: string; detail?: string; input?: string; output?: string; status: "running" | "done" | "failed" };

const API = "/api/custom-workspaces";
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
  const [selectedSourcePath, setSelectedSourcePath] = useState("index.html");
  const [previewVersion, setPreviewVersion] = useState<VersionPreview | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>("team");
  const [allowedInterviewerIds, setAllowedInterviewerIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [publishAgentSteps, setPublishAgentSteps] = useState<PublishAgentStep[]>([]);
  const [publishScreenshots, setPublishScreenshots] = useState<Partial<Record<"light" | "dark", string>>>({});
  const frame = useRef<HTMLIFrameElement>(null);
  const active = useMemo(() => selected ?? items[0] ?? null, [items, selected]);

  const refresh = async () => {
    const result = await request<{ workspaces: Workspace[] }>(API);
    setItems(result.workspaces);
    setSelected((current) => current && result.workspaces.find((item) => item.id === current.id) || null);
  };
  useEffect(() => { void refresh().catch((err) => setError(err.message)); }, []);
  useEffect(() => {
    if (!canManage) return;
    void request<{ items: { question: string; activities: { tool: string; detail: string; input?: string; output?: string }[] }[] }>("/api/assistant/history")
      .then(({ items: history }) => {
        const latest = [...history].reverse().find((item) =>
          item.question.startsWith("Build a custom workspace app for the team.") ||
          item.question.startsWith("Revise custom workspace draft "));
        if (!latest?.activities.length) return;
        setPublishAgentSteps(latest.activities.map((activity, index) => ({
          id: `saved-${index}-${activity.tool}`,
          label: activity.tool.replaceAll("_", " "),
          detail: activity.detail,
          input: activity.input,
          output: activity.output,
          status: "done",
        })));
      })
      .catch(() => {});
  }, [canManage]);
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
    if (!active || !canManage) {
      setVersions([]);
      return;
    }
    void request<{ versions: Version[] }>(`${API}/${active.id}/versions`)
      .then((result) => setVersions(result.versions))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load version history."));
  }, [active?.id, active?.status, canManage]);
  useEffect(() => {
    if (!active || !canManage) {
      setSourceFiles([]);
      return;
    }
    void request<{ files: WorkspaceFile[] }>(`${API}/${active.id}/files`)
      .then(({ files }) => {
        setSourceFiles(files);
        setSelectedSourcePath((current) => files.some((file) => file.path === current) ? current : files[0]?.path ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the source files."));
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

  const runBuilderAgent = async (question: string, beforeIds: Set<string>) => {
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
    const acceptEvent = (raw: string) => {
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        let event: Record<string, unknown>;
        try { event = JSON.parse(line.slice(5).trim()) as Record<string, unknown>; } catch { continue; }
        if (event.activity && typeof event.activity === "object") {
          const activity = event.activity as { tool?: unknown; detail?: unknown; input?: unknown; output?: unknown };
          const tool = typeof activity.tool === "string" ? activity.tool : "Assistant tool";
          const detail = typeof activity.detail === "string" ? activity.detail : "";
          setPublishAgentSteps((steps) => [...steps, {
            id: `agent-${steps.length}-${tool}`,
            label: tool.replaceAll("_", " "),
            detail,
            input: typeof activity.input === "string" ? activity.input : undefined,
            output: typeof activity.output === "string" ? activity.output : undefined,
            status: "done",
          }]);
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
    const result = await request<{ workspaces: Workspace[] }>(API);
    setItems(result.workspaces);
    const created = result.workspaces.find((workspace) => !beforeIds.has(workspace.id));
    if (created) setSelected(created);
    else if (active) setSelected(result.workspaces.find((workspace) => workspace.id === active.id) ?? active);
    const files = created ?? active;
    if (files) {
      const fileResult = await request<{ files: WorkspaceFile[] }>(`${API}/${files.id}/files`);
      setSourceFiles(fileResult.files);
      setSelectedSourcePath(fileResult.files[0]?.path ?? "");
    }
  };

  const generate = async () => {
    setError("");
    setBusy(true);
    setPublishScreenshots({});
    setPublishAgentSteps([{ id: "generate", label: "Start workspace agent", detail: "The assistant will build the app through multiple tool rounds.", status: "running" }]);
    try {
      const beforeIds = new Set(items.map((item) => item.id));
      const capabilityText = capabilities.length ? capabilities.join(", ") : "none";
      await runBuilderAgent(`Build a custom workspace app for the team. Requirements: ${prompt}\n\nOnly grant these workspace capabilities: ${capabilityText}. Create the draft, then use the custom workspace file tools to inspect and refine its persistent source tree. Keep it as a draft for coordinator review; do not publish.`, beforeIds);
      setPrompt("");
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "done", detail: "Agent turn complete." } : step));
    } catch (err) {
      setPublishAgentSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "failed" as const } : step));
      setError(err instanceof Error ? err.message : "Could not build the workspace.");
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!active) return;
    setBusy(true);
    setError("");
    setPublishAgentSteps([]);
    setPublishScreenshots({});
    try {
      const response = await fetch(`${API}/${active.id}/publish`, {
        method: "POST", body: JSON.stringify({ accessMode, allowedInterviewerIds }),
        credentials: "include",
        headers: (() => {
          const headers = new Headers({ "Content-Type": "application/json" });
          const token = getStoredAuthToken();
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return headers;
        })(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Could not publish the workspace.");
      }
      if (!response.body) throw new Error("The visual review stream is unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      let streamFailed = false;
      const handleEvent = (event: PublishAgentEvent) => {
        if (event.type === "tool_start" && event.id) {
          setPublishAgentSteps((current) => [...current, { id: event.id!, label: event.tool ?? "Agent step", detail: event.detail, status: "running" }]);
        } else if (event.type === "tool_done" && event.id) {
          setPublishAgentSteps((current) => current.map((step) => step.id === event.id
            ? { ...step, status: event.passed === false ? "failed" : "done", detail: event.detail ?? step.detail }
            : step));
        } else if (event.type === "screenshot" && event.image) {
          setPublishScreenshots((current) => ({
            ...current,
            [event.theme ?? "light"]: event.image!,
          }));
          setPublishAgentSteps((current) => current.map((step) => step.id === event.id ? { ...step, status: "done" } : step));
        } else if (event.type === "review" && event.id) {
          setPublishAgentSteps((current) => current.map((step) => step.id === event.id
            ? { ...step, status: event.passed ? "done" : "failed", detail: event.issues?.join(" · ") || (event.passed ? "No visible issues found." : "Visual issues found.") }
            : step));
        } else if (event.type === "complete" && event.workspace) {
          completed = true;
          setSelected(event.workspace);
          setPublishAgentSteps((current) => [...current, { id: "published", label: "Publish workspace", detail: "Visual check passed.", status: "done" }]);
          void refresh();
        } else if (event.type === "failed") {
          streamFailed = true;
          setError(event.message ?? "Visual review failed; the workspace remains a draft.");
          setPublishAgentSteps((current) => current.map((step) => step.status === "running" ? { ...step, status: "failed" } : step));
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { handleEvent(JSON.parse(line) as PublishAgentEvent); } catch { /* Ignore malformed progress frames. */ }
        }
        if (done) break;
      }
      if (buffer.trim()) {
        try { handleEvent(JSON.parse(buffer) as PublishAgentEvent); } catch { /* Ignore malformed final frame. */ }
      }
      if (!completed && !streamFailed) setError("The agent did not finish the visual review.");
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
    setPublishScreenshots({});
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
      setSelectedSourcePath((current) => files.files.some((file) => file.path === current) ? current : files.files[0]?.path ?? "");
      const history = await request<{ versions: Version[] }>(`${API}/${active.id}/versions`);
      setVersions(history.versions);
      setPreviewVersion(null);
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
  const visibleSourceFiles = previewVersion?.sourceFiles ?? sourceFiles;
  const previewHtml = previewVersion
    ? compileWorkspaceSourceFiles(previewVersion.sourceFiles) ?? previewVersion.html
    : active?.html ?? "";

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
          <textarea id="workspace-prompt" disabled={!canManage} value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} maxLength={8000} placeholder="Example: Build a parts catalog for our robot. Track part names, suppliers, prices, and stock; let the team search and add records." className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm text-[hsl(var(--foreground))] outline-none focus:ring-2 focus:ring-[#16869a] disabled:opacity-60" />
          <label className="mt-4 grid gap-1.5 text-xs font-semibold text-[hsl(var(--foreground))]">
            <span>AI model</span>
            <select
              aria-label="Workspace builder model"
              data-testid="workspace-builder-model"
              value={selectedModel}
              onChange={(event) => chooseModel(event.target.value)}
              disabled={!canManage || modelsLoading || builderModels.length === 0}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-normal text-[hsl(var(--foreground))] disabled:opacity-60"
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
            <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">{previewVersion ? `Previewing saved version · ${previewVersion.message}` : active ? `${active.status === "published" ? "Published" : "Draft"} · ${active.capabilities.join(" · ") || "No capabilities"}` : "Generate an app to see it here."}</p>
          </div>
          {active && canManage && <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-[hsl(var(--foreground))]">
              <span>Who can use this app?</span>
              <select aria-label="Who can use this app?" value={accessMode} disabled={busy} onChange={(event) => setAccessMode(event.target.value as AccessMode)} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm text-[hsl(var(--foreground))]">
                <option value="team">Everyone on the team</option>
                <option value="owner">Only the creator</option>
                <option value="selected">Choose teammates</option>
              </select>
            </label>
            {active.status === "published" && <button type="button" disabled={busy || !accessChanged} onClick={() => void saveAccess()} className="rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save access</button>}
          </div>}
          {active && canManage && active.status === "draft" && <button type="button" disabled={busy} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-lg bg-[#183a4b] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-[#e6f0f2] dark:text-[#183a4b]"><Rocket size={14} /> Publish</button>}
          {active?.status === "published" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><Check size={13} /> Live</span>}
        </div>
        {publishAgentSteps.length > 0 && <section className="border-b border-[hsl(var(--border))] p-4" aria-live="polite" data-testid="publish-agent-activity">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Builder agent activity</h3>
          <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">{publishScreenshots.light || publishScreenshots.dark ? "Checks light- and dark-theme screenshots and browser runtime, repairs code or contrast issues, and blocks publishing if they remain." : "This agent runs on the server. You can leave this tab; draft files are saved as the agent works, and completed tool logs return here."}</p>
          <ol className="mt-2 space-y-2">
            {publishAgentSteps.map((step) => <li key={step.id} className="flex items-start gap-2 text-xs text-[hsl(var(--foreground))]">
              <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${step.status === "done" ? "bg-emerald-500" : step.status === "failed" ? "bg-red-500" : "animate-pulse bg-[#16869a]"}`} />
              <span className="min-w-0 flex-1"><b>{step.label}</b>{step.detail && <span className="ml-1 text-[#60757c] dark:text-[#b3c3cb]">{step.detail}</span>}
                {(step.input || step.output) && <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] font-medium text-[#16869a]">Tool call details</summary>
                  {step.input && <><span className="mt-1 block font-semibold">Input</span><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2">{step.input}</pre></>}
                  {step.output && <><span className="mt-1 block font-semibold">Result</span><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[hsl(var(--muted))] p-2">{step.output}</pre></>}
                </details>}
              </span>
            </li>)}
          </ol>
          {(["light", "dark"] as const).filter((theme) => publishScreenshots[theme]).length > 0 && <div className="mt-3 grid max-w-4xl gap-3 md:grid-cols-2">
            {(["light", "dark"] as const).map((theme) => publishScreenshots[theme] && <figure key={theme}>
              <img
                src={publishScreenshots[theme]}
                alt={theme === "light" ? "Latest screenshot reviewed by the builder agent" : "Latest dark-theme screenshot reviewed by the builder agent"}
                className="max-h-72 w-full rounded-lg border border-[hsl(var(--border))] object-contain object-left-top"
              />
              <figcaption className="mt-1 text-[11px] text-[#60757c] dark:text-[#b3c3cb]">Latest 1280 × 900 {theme} theme render reviewed before publishing.</figcaption>
            </figure>)}
          </div>}
        </section>}
        {active && canManage && <section className="border-b border-[hsl(var(--border))] p-4" aria-label="Workspace source tree" data-testid="workspace-source-tree">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Source tree</h3>
          {previewVersion && <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">Showing files from the selected saved version.</p>}
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
        {previewVersion && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-2">
          <span className="text-xs text-[hsl(var(--foreground))]">Saved {new Date(previewVersion.createdAt).toLocaleString()} · capabilities at save: {previewVersion.capabilities.join(" · ") || "none"}</span>
          <button type="button" data-testid="button-return-current-app" disabled={busy} onClick={() => setPreviewVersion(null)} className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs font-semibold text-[hsl(var(--foreground))]">Return to current app</button>
        </div>}
        {previewHtml
          ? <iframe ref={frame} title={`${active?.title ?? "Workspace"} ${previewVersion ? "saved version" : "preview"}`} sandbox="allow-scripts" srcDoc={sandboxDocument(previewHtml, resolvedTheme === "dark")} className="h-[70vh] min-h-[520px] w-full bg-white dark:bg-[#0b141b]" />
          : <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm text-[#60757c] dark:text-[#b3c3cb]"><div><Plus size={28} className="mx-auto mb-3 opacity-50" />Describe a workspace to generate its first draft.</div></div>}
        {active?.status === "draft" && canManage && <div className="border-t border-[hsl(var(--border))] p-4">
          <label htmlFor="workspace-revision" className="text-sm font-semibold text-[hsl(var(--foreground))]">Revise this draft</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="workspace-revision" value={revisionPrompt} onChange={(event) => setRevisionPrompt(event.target.value)} maxLength={4000} placeholder="Describe what to change or add…" className="min-w-0 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
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
