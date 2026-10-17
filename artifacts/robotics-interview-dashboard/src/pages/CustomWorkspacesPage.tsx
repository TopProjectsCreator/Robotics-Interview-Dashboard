import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Code2, LoaderCircle, Plus, Rocket, Sparkles } from "lucide-react";
import { getGetSessionQueryKey, useGetSession, type CustomWorkspace, type CustomWorkspaceVersion } from "@workspace/api-client-react";

type Capability = CustomWorkspace["capabilities"][number];
type Workspace = CustomWorkspace;
type Version = CustomWorkspaceVersion;
type AccessMode = Workspace["accessMode"];
type TeamMember = { id: string; displayName: string };
type BridgeRequest = { channel: "workspace-bridge"; id: string; method: string; payload?: unknown };

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

function sandboxDocument(html: string): string {
  const safeMeta = CSP + BRIDGE;
  if (/<head(?:\\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\\s[^>]*)?>/i, (head) => `${head}${safeMeta}`);
  return `<!doctype html><html><head>${safeMeta}</head><body>${html}</body></html>`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The request failed.");
  return body as T;
}

export function CustomWorkspacesPage() {
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const canManage = session.data?.role === "coordinator";
  const [items, setItems] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [prompt, setPrompt] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [accessMode, setAccessMode] = useState<AccessMode>("team");
  const [allowedInterviewerIds, setAllowedInterviewerIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const active = useMemo(() => selected ?? items[0] ?? null, [items, selected]);

  const refresh = async () => {
    const result = await request<{ workspaces: Workspace[] }>(API);
    setItems(result.workspaces);
    setSelected((current) => current && result.workspaces.find((item) => item.id === current.id) || null);
  };
  useEffect(() => { void refresh().catch((err) => setError(err.message)); }, []);
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
    if (!active || active.status !== "draft" || !canManage) {
      setVersions([]);
      return;
    }
    void request<{ versions: Version[] }>(`${API}/${active.id}/versions`)
      .then((result) => setVersions(result.versions))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load version history."));
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

  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      const result = await request<{ workspace: Workspace }>(`${API}/generate`, {
        method: "POST", body: JSON.stringify({ prompt, capabilities }),
      });
      await refresh();
      setSelected(result.workspace);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the workspace.");
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ workspace: Workspace }>(`${API}/${active.id}/publish`, {
        method: "POST", body: JSON.stringify({ accessMode, allowedInterviewerIds }),
      });
      setSelected(result.workspace);
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
    try {
      const result = await request<{ workspace: Workspace }>(`${API}/${active.id}/revise`, {
        method: "POST", body: JSON.stringify({ prompt: revisionPrompt }),
      });
      setSelected(result.workspace);
      setRevisionPrompt("");
      await refresh();
    } catch (err) {
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
      const history = await request<{ versions: Version[] }>(`${API}/${active.id}/versions`);
      setVersions(history.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore the selected version.");
    } finally {
      setBusy(false);
    }
  };

  const accessChanged = active && (
    active.accessMode !== accessMode ||
    [...(active.allowedInterviewerIds ?? [])].sort().join("\0") !== [...allowedInterviewerIds].sort().join("\0")
  );

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
            <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">{active ? `${active.status === "published" ? "Published" : "Draft"} · ${active.capabilities.join(" · ") || "No capabilities"}` : "Generate an app to see it here."}</p>
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
        {active && canManage && accessMode === "selected" && <div className="border-b border-[hsl(var(--border))] p-4">
          <fieldset disabled={busy}>
            <legend className="text-sm font-semibold text-[hsl(var(--foreground))]">Choose teammates</legend>
            <p className="mt-1 text-xs text-[#60757c] dark:text-[#b3c3cb]">Only selected accounts can open this app or use its data and AI tools.</p>
            {teamMembers.length
              ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {teamMembers.map((member) => <li key={member.id}>
                  <label className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]">
                    <input type="checkbox" checked={allowedInterviewerIds.includes(member.id)} onChange={(event) => setAllowedInterviewerIds((current) => event.target.checked
                      ? [...new Set([...current, member.id])]
                      : current.filter((id) => id !== member.id))} />
                    <span>{member.displayName}</span>
                  </label>
                </li>)}
              </ul>
              : <p className="mt-3 text-sm text-[#60757c] dark:text-[#b3c3cb]">{teamMembersLoading ? "Loading team members…" : "No teammates are available."}</p>}
          </fieldset>
        </div>}
        {active?.html
          ? <iframe ref={frame} title={`${active.title} preview`} sandbox="allow-scripts" srcDoc={sandboxDocument(active.html)} className="h-[70vh] min-h-[520px] w-full bg-white" />
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
              {active.status === "draft" && canManage && <button type="button" disabled={busy} onClick={() => void restore(version.id)} className="rounded-md border border-[hsl(var(--border))] px-2 py-1 font-semibold text-[hsl(var(--foreground))] disabled:opacity-50">Restore</button>}
            </li>)}
          </ul>
        </div>}
      </section>
    </div>
  </main>;
}
