import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTheme } from "next-themes";
import { ArrowLeft, LoaderCircle, Sparkles } from "lucide-react";
import { getGetSessionQueryKey, useGetSession, type CustomWorkspace } from "@workspace/api-client-react";
import { getStoredAuthToken } from "../authSession";
import { sandboxDocument } from "../lib/customWorkspaceRuntime";

const API = "/api/custom-workspaces";
type Workspace = CustomWorkspace & { critiqueRounds?: number; verifiedCritiqueRounds?: number };
type BridgeRequest = { channel: "workspace-bridge"; id: string; method: string; payload?: unknown };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getStoredAuthToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, credentials: "include", headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "The request failed.");
  }
  return body as T;
}

export function CustomWorkspaceAppPage({ workspaceId }: { workspaceId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const teamId = session.data?.teamId ?? "";
  const interviewerId = session.data?.interviewerId ?? "";
  const workspaceQuery = useQuery({
    queryKey: ["custom-workspace", workspaceId, teamId, interviewerId],
    enabled: Boolean(workspaceId) && session.data?.authenticated === true,
    queryFn: async () => (await request<{ workspace: Workspace }>(
      `${API}/${encodeURIComponent(workspaceId)}`,
    )).workspace,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const workspace = workspaceQuery.data;

  useEffect(() => {
    const onMessage = async (event: MessageEvent<BridgeRequest>) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== "workspace-bridge") return;
      const message = event.data;
      const respond = (result?: unknown, errorText?: string) => {
        frame.current?.contentWindow?.postMessage({
          channel: "workspace-bridge-result",
          id: message.id,
          result,
          error: errorText,
        }, "*");
      };
      if (!workspace) return respond(undefined, "Workspace not found.");
      try {
        if (message.method === "data.list" && workspace.capabilities.includes("data")) {
          respond((await request<{ records: unknown[] }>(`${API}/${workspace.id}/data`)).records);
        } else if (message.method === "data.create" && workspace.capabilities.includes("data")) {
          const record = (message.payload as { record?: unknown } | undefined)?.record;
          respond((await request<{ record: unknown }>(`${API}/${workspace.id}/data`, {
            method: "POST",
            body: JSON.stringify({ record }),
          })).record);
        } else if (message.method === "data.update" && workspace.capabilities.includes("data")) {
          const { id, record } = (message.payload ?? {}) as { id?: unknown; record?: unknown };
          respond((await request<{ record: unknown }>(`${API}/${workspace.id}/data/${encodeURIComponent(String(id ?? ""))}`, {
            method: "PATCH",
            body: JSON.stringify({ record }),
          })).record);
        } else if (message.method === "data.delete" && workspace.capabilities.includes("data")) {
          const { id } = (message.payload ?? {}) as { id?: unknown };
          respond(await request<{ deleted: boolean }>(`${API}/${workspace.id}/data/${encodeURIComponent(String(id ?? ""))}`, {
            method: "DELETE",
          }));
        } else if (message.method === "llm.ask" && workspace.capabilities.includes("llm")) {
          const prompt = (message.payload as { prompt?: unknown } | undefined)?.prompt;
          respond((await request<{ answer: string }>(`${API}/${workspace.id}/llm`, {
            method: "POST",
            body: JSON.stringify({ prompt }),
          })).answer);
        } else {
          respond(undefined, "This workspace has not been granted that capability.");
        }
      } catch (error) {
        respond(undefined, error instanceof Error ? error.message : "The capability request failed.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [workspace]);

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center rounded-3xl border border-[#dce5e5] bg-white text-sm text-[#60757c] dark:border-[#2a3f52] dark:bg-[#15232d] dark:text-[#b3c3cb]" data-testid="status-custom-app-loading">
        <LoaderCircle size={18} className="mr-2 animate-spin" aria-hidden="true" />
        Loading app…
      </div>
    );
  }

  if (workspaceQuery.isError || !workspace || typeof workspace.html !== "string") {
    return (
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#dce5e5] bg-white p-6 text-[#182232] dark:border-[#2a3f52] dark:bg-[#15232d] dark:text-[#e8eff2]" data-testid="status-custom-app-error">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#16869a] hover:underline dark:text-[#73c9c0]" data-testid="link-back-to-workspaces">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to workspaces
        </Link>
        <h1 className="mt-5 text-2xl font-semibold">App unavailable</h1>
        <p className="mt-2 text-sm text-[#65747a] dark:text-[#afc1c9]">
          {workspaceQuery.error instanceof Error
            ? workspaceQuery.error.message
            : workspace
              ? "The saved app content is unavailable."
              : "This app is unavailable or your account does not have access."}
        </p>
      </section>
    );
  }

  const darkMode = resolvedTheme === "dark";
  const previewHtml = sandboxDocument(workspace.html, darkMode);
  const isDraft = workspace.status === "draft";

  return (
    <section className="overflow-hidden rounded-3xl border border-[#dce5e5] bg-white text-[#182232] shadow-sm dark:border-[#2a3f52] dark:bg-[#15232d] dark:text-[#e8eff2]" data-testid={`custom-app-${workspace.id}`}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dce5e5] px-4 py-4 dark:border-[#2a3f52] sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e3f4f2] text-[#16869a] dark:bg-[#1d3a43] dark:text-[#73c9c0]">
            <Sparkles size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl" data-testid={`text-custom-app-title-${workspace.id}`}>{workspace.title}</h1>
            {workspace.description && (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#65747a] dark:text-[#afc1c9]" data-testid={`text-custom-app-description-${workspace.id}`}>
                {workspace.description}
              </p>
            )}
          </div>
        </div>
        <span className={`mono rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.14em] ${
          isDraft
            ? "border-[#e2d4a5] bg-[#fff8df] text-[#665426] dark:border-[#6f6039] dark:bg-[#3c3525] dark:text-[#e3d6ad]"
            : "border-[#b8d8d3] bg-[#e8f5f0] text-[#35666a] dark:border-[#35616a] dark:bg-[#173542] dark:text-[#b8ddd9]"
        }`} data-testid={`status-custom-app-${workspace.id}`}>
          {isDraft ? "Draft" : "Published"}
        </span>
      </header>
      <iframe
        ref={frame}
        title={`${workspace.title} app`}
        srcDoc={previewHtml}
        sandbox="allow-scripts"
        className="block h-[min(76vh,900px)] min-h-[560px] w-full bg-white dark:bg-[#101b23]"
        data-testid={`iframe-custom-app-${workspace.id}`}
      />
    </section>
  );
}
