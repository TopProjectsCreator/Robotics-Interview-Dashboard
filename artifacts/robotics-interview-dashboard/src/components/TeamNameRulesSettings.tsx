import { useEffect, useState, type FormEvent } from "react";
import {
  getGetTeamNameRulesQueryKey,
  useGetTeamNameRules,
  useUpdateTeamNameRules,
  type TeamNameRule,
  type TeamNameRuleMatchType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const matchChoices: { value: TeamNameRuleMatchType; label: string; explanation: string }[] = [
  { value: "contains", label: "Contains", explanation: "Rejects names that include this text anywhere." },
  { value: "startsWith", label: "Starts with", explanation: "Rejects names that begin with this text." },
  { value: "endsWith", label: "Ends with", explanation: "Rejects names that finish with this text." },
  { value: "exact", label: "Matches exactly", explanation: "Rejects a name only when the whole name matches this text." },
];

const fieldClass = "h-10 min-w-0 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm text-[#182232] outline-none focus:border-[#16869a] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2] dark:focus:border-[#3f8492]";
const buttonClass = "rounded-lg border border-[#cbd9da] bg-white px-3 py-2 text-xs font-semibold text-[#385762] transition hover:border-[#16869a] disabled:opacity-50 dark:border-[#3a5567] dark:bg-[#182935] dark:text-[#c3d3db] dark:hover:border-[#3f8492]";

function messageFor(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const body = error.data;
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  }
  return error instanceof Error ? error.message : "Could not save name rules. Try again.";
}

export function TeamNameRulesSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient();
  const queryKey = [...getGetTeamNameRulesQueryKey(), teamId];
  const query = useGetTeamNameRules({ query: { queryKey, refetchOnMount: "always" } });
  const saveRules = useUpdateTeamNameRules();
  const [draft, setDraft] = useState<TeamNameRule[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (query.data) setDraft(query.data.rules.map((rule) => ({ ...rule })));
  }, [query.data]);

  const updateRule = (index: number, patch: Partial<TeamNameRule>) => {
    setDraft((current) => current.map((rule, row) => row === index ? { ...rule, ...patch } : rule));
    setError("");
    setNotice("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const rules = draft.map((rule) => ({ ...rule, text: rule.text.trim().replace(/\s+/g, " ") }));
    if (rules.some((rule) => !rule.text)) {
      setError("Enter text for each rule or remove the empty rule.");
      return;
    }
    saveRules.mutate({ data: { rules } }, {
      onSuccess: async (saved) => {
        setDraft(saved.rules.map((rule) => ({ ...rule })));
        setNotice("Name rules saved for the whole team.");
        await queryClient.invalidateQueries({ queryKey });
      },
      onError: (mutationError) => setError(messageFor(mutationError)),
    });
  };

  return (
    <section className="mt-4 border-t border-[#e5ecec] pt-3 dark:border-[#273c48]" data-testid="settings-team-name-rules">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#16869a] dark:text-[#6fc3cf]">Name rules</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-[#7c8c91] dark:text-[#93a8b2]">
            Keep certain names from being used by new interviewers or during account renames. These rules do not rename existing accounts.
          </p>
        </div>
        <button
          type="button"
          disabled={draft.length >= 50 || query.isLoading}
          onClick={() => {
            setDraft((current) => [...current, { matchType: "contains", text: "" }]);
            setError("");
            setNotice("");
          }}
          data-testid="button-add-team-name-rule"
          className={buttonClass}
        >
          Add rule
        </button>
      </div>

      {query.isLoading && <p className="mt-3 text-xs text-[#7c8c91] dark:text-[#93a8b2]">Loading team name rules…</p>}
      {query.isError && <p role="alert" className="mt-3 text-xs font-semibold text-[#b34a42] dark:text-[#e89087]">Could not load team name rules. Close and reopen settings to try again.</p>}
      {!query.isLoading && !query.isError && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          {draft.length === 0 && <p className="rounded-lg border border-dashed border-[#dce5e5] px-3 py-3 text-xs text-[#7c8c91] dark:border-[#31495a] dark:text-[#93a8b2]">No name rules yet. Add one to block a specific word or name pattern.</p>}
          {draft.map((rule, index) => {
            const choice = matchChoices.find((item) => item.value === rule.matchType) ?? matchChoices[0];
            return (
              <div key={index} className="rounded-xl border border-[#e5ecec] bg-[#f8fbfa] p-3 dark:border-[#2a3f4c] dark:bg-[#10202a]" data-testid={`team-name-rule-${index}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`team-name-rule-type-${index}`}>Name match type</label>
                  <select
                    id={`team-name-rule-type-${index}`}
                    value={rule.matchType}
                    onChange={(event) => updateRule(index, { matchType: event.target.value as TeamNameRuleMatchType })}
                    data-testid={`select-team-name-rule-type-${index}`}
                    className={`${fieldClass} flex-1`}
                  >
                    {matchChoices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <label className="sr-only" htmlFor={`team-name-rule-text-${index}`}>Text to match</label>
                  <input
                    id={`team-name-rule-text-${index}`}
                    value={rule.text}
                    onChange={(event) => updateRule(index, { text: event.target.value })}
                    maxLength={40}
                    placeholder="Enter ordinary text"
                    data-testid={`input-team-name-rule-text-${index}`}
                    className={`${fieldClass} flex-[2]`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDraft((current) => current.filter((_, row) => row !== index));
                      setError("");
                      setNotice("");
                    }}
                    aria-label={`Remove name rule ${index + 1}`}
                    data-testid={`button-remove-team-name-rule-${index}`}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-[#a84840] transition hover:bg-[#f8e9e7] dark:text-[#e89087] dark:hover:bg-[#3b2728]"
                  >
                    Remove
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#7c8c91] dark:text-[#93a8b2]">{choice.explanation}</p>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saveRules.isPending} data-testid="button-save-team-name-rules" className="rounded-lg bg-[#16869a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:opacity-50">
              {saveRules.isPending ? "Saving…" : "Save rules"}
            </button>
            <span aria-live="polite" className="text-xs font-semibold text-[#247d63] dark:text-[#6fce8f]">{notice}</span>
          </div>
          {error && <p role="alert" className="text-xs font-semibold text-[#b34a42] dark:text-[#e89087]" data-testid="team-name-rules-error">{error}</p>}
        </form>
      )}
    </section>
  );
}
