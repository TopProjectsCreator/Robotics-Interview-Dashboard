import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAssistantToolPolicyQueryKey,
  getGetAssistantUsageQueryKey,
  useGetAssistantToolPolicy,
  useGetAssistantUsage,
  useUpdateAssistantToolPolicy,
  type AssistantToolPolicyInput,
} from "@workspace/api-client-react";
import { ASSISTANT_TOOL_GROUPS, isDynamicAssistantToolName } from "./assistantTools";

type DynamicTool = { name: string; label: string; description?: string };

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatCount(value: number | null): string {
  return value == null ? "Unavailable" : new Intl.NumberFormat().format(value);
}

function titleForTool(name: string): string {
  return name.replace(/^(?:onshape_|custom_mcp_)/, "")
    .replace(/^cw_[a-f0-9]{16}_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function collectTools(dynamic: DynamicTool[]) {
  const staticTools = ASSISTANT_TOOL_GROUPS.flatMap((group) =>
    group.tools.map((tool) => ({ name: tool.name, label: tool.label, group: group.label })),
  );
  const tools = new Map(staticTools.map((tool) => [tool.name, tool]));
  for (const tool of dynamic) {
    if (!isDynamicAssistantToolName(tool.name)) continue;
    tools.set(tool.name, {
      name: tool.name,
      label: tool.label || titleForTool(tool.name),
      group: tool.name.startsWith("onshape_") ? "Onshape" : tool.name.startsWith("cw_") ? "Custom apps" : "Custom MCP",
    });
  }
  return [...tools.values()].sort((left, right) =>
    left.group.localeCompare(right.group) || left.label.localeCompare(right.label),
  );
}

export function AssistantGovernanceSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient();
  const [endDate, setEndDate] = useState(() => utcDate(new Date()));
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 29);
    return utcDate(date);
  });
  const [dynamicTools, setDynamicTools] = useState<DynamicTool[]>([]);
  const [dynamicToolsError, setDynamicToolsError] = useState("");
  const [draft, setDraft] = useState<AssistantToolPolicyInput | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const toolPolicyQuery = useGetAssistantToolPolicy({
    query: {
      queryKey: [...getGetAssistantToolPolicyQueryKey(), teamId],
      enabled: Boolean(teamId),
      retry: false,
    },
  });
  const usageQuery = useGetAssistantUsage({ startDate, endDate }, {
    query: {
      queryKey: [...getGetAssistantUsageQueryKey({ startDate, endDate }), teamId],
      enabled: Boolean(teamId && startDate && endDate && startDate <= endDate),
      retry: false,
    },
  });
  const updatePolicy = useUpdateAssistantToolPolicy({
    mutation: {
      onSuccess: (saved) => {
        setDraft({
          teamDisabledTools: saved.teamDisabledTools,
          roleDisabledTools: saved.roleDisabledTools,
        });
        setSaveNotice("Tool restrictions saved.");
        queryClient.setQueryData([...getGetAssistantToolPolicyQueryKey(), teamId], saved);
      },
      onError: () => setSaveNotice("Tool restrictions could not be saved. Try again."),
    },
  });
  useEffect(() => {
    const policy = toolPolicyQuery.data;
    if (policy) {
      setDraft({
        teamDisabledTools: policy.teamDisabledTools,
        roleDisabledTools: policy.roleDisabledTools,
      });
    }
  }, [toolPolicyQuery.data]);
  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}api/assistant/tools`, { credentials: "include" })
      .then(async (response) => {
        const value = await response.json() as { tools?: DynamicTool[] };
        if (!response.ok) throw new Error("Could not load connected tools.");
        if (!active) return;
        setDynamicTools(Array.isArray(value.tools) ? value.tools.filter((tool) =>
          tool && typeof tool.name === "string",
        ) : []);
        setDynamicToolsError("");
      })
      .catch(() => {
        if (active) setDynamicToolsError("Connected MCP and custom-app tools could not be loaded.");
      });
    return () => { active = false; };
  }, [teamId]);

  const tools = useMemo(() => collectTools(dynamicTools), [dynamicTools]);
  const policy = toolPolicyQuery.data;
  const metrics = usageQuery.data?.totals;
  const fieldClass = "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground";
  const toggleTool = (name: string, roleKey?: string) => {
    setSaveNotice("");
    setDraft((current) => {
      const next: AssistantToolPolicyInput = current
        ? { teamDisabledTools: [...current.teamDisabledTools], roleDisabledTools: { ...current.roleDisabledTools } }
        : { teamDisabledTools: [], roleDisabledTools: {} };
      if (!roleKey) {
        next.teamDisabledTools = next.teamDisabledTools.includes(name)
          ? next.teamDisabledTools.filter((tool) => tool !== name)
          : [...next.teamDisabledTools, name];
      } else {
        const selected = next.roleDisabledTools[roleKey] ?? [];
        const updated = selected.includes(name)
          ? selected.filter((tool) => tool !== name)
          : [...selected, name];
        if (updated.length) next.roleDisabledTools[roleKey] = updated;
        else delete next.roleDisabledTools[roleKey];
      }
      return next;
    });
  };
  const isDisabled = (name: string, roleKey?: string) => roleKey
    ? (draft?.roleDisabledTools[roleKey] ?? []).includes(name)
    : (draft?.teamDisabledTools ?? []).includes(name);
  const savePolicy = () => {
    if (!draft) return;
    setSaveNotice("");
    const roleDisabledTools = Object.fromEntries(
      Object.entries(draft.roleDisabledTools).filter(([, selected]) => selected.length > 0),
    );
    updatePolicy.mutate({ data: { ...draft, roleDisabledTools } });
  };
  const report = usageQuery.data;
  const tokenCell = (value: number | null) => value == null ? "—" : formatCount(value);

  return <section className="mt-4 border-t border-border pt-4" data-testid="settings-assistant-governance">
    <p className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Assistant usage &amp; tools</p>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Review assistant activity and restrict tools for the whole team or selected roles. Dates use UTC; “—” means the provider did not report that token count.</p>

    <div className="mt-4 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold">From
          <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} data-testid="assistant-usage-start-date" />
        </label>
        <label className="grid gap-1 text-xs font-semibold">Through
          <input type="date" value={endDate} min={startDate} max={utcDate(new Date())} onChange={(event) => setEndDate(event.target.value)} className={fieldClass} data-testid="assistant-usage-end-date" />
        </label>
      </div>
      {usageQuery.isLoading && <p role="status" className="mt-3 text-xs text-muted-foreground">Loading assistant usage…</p>}
      {usageQuery.isError && <div className="mt-3 flex items-center justify-between gap-2 text-xs text-destructive"><p>Usage data could not be loaded.</p><button type="button" onClick={() => void usageQuery.refetch()} className="rounded-lg border border-border px-3 py-2 font-semibold">Retry</button></div>}
      {metrics && <>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["User prompts", metrics.prompts],
            ["Provider requests", metrics.providerRequests],
            ["Input tokens", metrics.inputTokens],
            ["Output tokens", metrics.outputTokens],
            ["Total tokens", metrics.totalTokens],
            ["Tools used", report?.tools.length ?? 0],
          ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{formatCount(value as number | null)}</p>
          </div>)}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          {metrics.completedPrompts} completed · {metrics.failedPrompts} failed · {metrics.cancelledPrompts} cancelled · {metrics.runningPrompts} in progress prompts.
          {" "}{metrics.successfulRequests} successful · {metrics.failedRequests} failed · {metrics.cancelledRequests} cancelled · {metrics.runningRequests} in progress provider requests.
          {" "}{metrics.usageUnavailableRequests} requests had no provider-reported token counts; failed or cancelled requests may not have usage data.
        </p>
        {!report?.users.length
          ? <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No assistant prompts were recorded in this date range.</p>
          : <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground"><tr>
                <th scope="col" className="px-3 py-2">Team member</th><th scope="col" className="px-3 py-2">Prompts</th><th scope="col" className="px-3 py-2">Requests</th><th scope="col" className="px-3 py-2">Input</th><th scope="col" className="px-3 py-2">Output</th><th scope="col" className="px-3 py-2">Total</th><th scope="col" className="px-3 py-2">No usage</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {report.users.map((user) => <tr key={user.accountId}>
                  <th scope="row" className="px-3 py-2 font-medium">{user.displayName}<span className="ml-1 text-muted-foreground">· {user.role}</span></th>
                  <td className="px-3 py-2">{formatCount(user.metrics.prompts)} <span className="text-muted-foreground">({user.metrics.failedPrompts} failed, {user.metrics.cancelledPrompts} cancelled)</span></td>
                  <td className="px-3 py-2">{formatCount(user.metrics.providerRequests)}</td>
                  <td className="px-3 py-2">{tokenCell(user.metrics.inputTokens)}</td>
                  <td className="px-3 py-2">{tokenCell(user.metrics.outputTokens)}</td>
                  <td className="px-3 py-2">{tokenCell(user.metrics.totalTokens)}</td>
                  <td className="px-3 py-2">{user.metrics.usageUnavailableRequests}</td>
                </tr>)}
              </tbody>
            </table>
          </div>}
        {!!report?.tools.length && <div className="mt-4">
          <h3 className="text-xs font-semibold">Most-used tools</h3>
          <ol className="mt-2 grid gap-1 sm:grid-cols-2">
            {report.tools.slice(0, 8).map((tool, index) => <li key={tool.name} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground">{index + 1}.</span>{titleForTool(tool.name)}</span>
              <span className="shrink-0 font-semibold">{formatCount(tool.invocations)}</span>
            </li>)}
          </ol>
        </div>}
      </>}
    </div>

    <div className="mt-4 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold">Tool access</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">A team-wide block applies even if a role allows the tool. These rules are enforced by the server, including scheduled work.</p></div>
        <button type="button" onClick={savePolicy} disabled={!draft || updatePolicy.isPending || toolPolicyQuery.isLoading || toolPolicyQuery.isError} data-testid="button-save-assistant-tool-policy" className="min-h-10 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {updatePolicy.isPending ? "Saving…" : "Save tool access"}
        </button>
      </div>
      {toolPolicyQuery.isLoading && <p role="status" className="mt-3 text-xs text-muted-foreground">Loading tool policy…</p>}
      {toolPolicyQuery.isError && <div className="mt-3 flex items-center justify-between gap-2 text-xs text-destructive"><p>Tool restrictions could not be loaded.</p><button type="button" onClick={() => void toolPolicyQuery.refetch()} className="rounded-lg border border-border px-3 py-2 font-semibold">Retry</button></div>}
      {dynamicToolsError && <p role="status" className="mt-3 text-xs text-muted-foreground">{dynamicToolsError}</p>}
      {policy && draft && <>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground"><tr>
              <th scope="col" className="px-3 py-2">Assistant tool</th>
              <th scope="col" className="px-3 py-2 text-center">Everyone</th>
              {policy.roles.map((role) => <th key={role.key} scope="col" className="max-w-32 px-2 py-2 text-center">{role.label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border">
              {tools.map((tool) => <tr key={tool.name}>
                <th scope="row" className="px-3 py-2 font-medium">
                  <span className="block">{tool.label}</span><span className="block max-w-48 truncate text-[10px] font-normal text-muted-foreground" title={tool.name}>{tool.group} · {tool.name}</span>
                </th>
                <td className="px-3 py-2 text-center"><input type="checkbox" aria-label={`Disable ${tool.label} for everyone`} checked={isDisabled(tool.name)} onChange={() => toggleTool(tool.name)} className="h-4 w-4 accent-primary" /></td>
                {policy.roles.map((role) => <td key={role.key} className="px-2 py-2 text-center">
                  <input type="checkbox" aria-label={`Disable ${tool.label} for ${role.label}`} checked={isDisabled(tool.name, role.key)} onChange={() => toggleTool(tool.name, role.key)} className="h-4 w-4 accent-primary" />
                </td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        {!tools.length && <p className="mt-3 text-xs text-muted-foreground">No assistant tools are available to configure.</p>}
      </>}
      {saveNotice && <p role={updatePolicy.isError ? "alert" : "status"} className={`mt-2 text-xs ${updatePolicy.isError ? "text-destructive" : "text-muted-foreground"}`} data-testid="assistant-tool-policy-status">{saveNotice}</p>}
      {toolPolicyQuery.data?.updatedAt && <p className="mt-2 text-[10px] text-muted-foreground">Last saved {new Date(toolPolicyQuery.data.updatedAt).toLocaleString()}.</p>}
    </div>
  </section>;
}
