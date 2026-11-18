import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCadIconPolicyQueryKey,
  useGetCadIconPolicy,
  useUpdateCadIconPolicy,
  type CadIcon,
} from "@workspace/api-client-react";

import { CAD_ICON_OPTIONS, DEFAULT_CAD_ICON_IDS } from "@/lib/cadIcons";

export function CadIconPolicySetting() {
  const queryClient = useQueryClient();
  const queryKey = getGetCadIconPolicyQueryKey();
  const iconPolicy = useGetCadIconPolicy({
    query: {
      queryKey,
      retry: false,
      refetchOnMount: "always",
    },
  });
  const updateIconPolicy = useUpdateCadIconPolicy();
  const [draft, setDraft] = useState<CadIcon[]>([...DEFAULT_CAD_ICON_IDS]);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (iconPolicy.data) setDraft([...iconPolicy.data.enabledIcons]);
  }, [iconPolicy.data]);

  const enabledIcons = iconPolicy.data?.enabledIcons ?? DEFAULT_CAD_ICON_IDS;
  const orderedDraft = CAD_ICON_OPTIONS.filter(({ id }) => draft.includes(id)).map(({ id }) => id);
  const dirty = orderedDraft.join(",") !== [...enabledIcons].join(",");

  const save = () => {
    if (orderedDraft.length === 0) return;
    setFeedback(null);
    updateIconPolicy.mutate({ data: { enabledIcons: orderedDraft } }, {
      onSuccess: (saved) => {
        // The CAD workspace reads the same query key, so this keeps the bot
        // icon pickers in sync without waiting for a refetch.
        queryClient.setQueryData(queryKey, saved);
        setFeedback({ kind: "success", text: "CAD icon choices saved." });
      },
      onError: () => setFeedback({ kind: "error", text: "Could not save the CAD icon choices. Try again." }),
    });
  };

  return (
    <section className="mt-2 border-t border-[#e5ecec] pt-2 dark:border-[#273c48]" data-testid="settings-cad-icon-policy">
      <p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91] dark:text-[#93a8b2]">CAD bot icons</p>
      <p className="mt-2 text-xs leading-5 text-[#7c8c91] dark:text-[#93a8b2]">
        Choose which Lucide icons your team can use for CAD bots. Existing bots keep their current icon.
      </p>
      {iconPolicy.isLoading ? (
        <p className="mt-3 text-xs text-[#7c8c91] dark:text-[#93a8b2]" role="status">Loading the team's icon choices…</p>
      ) : iconPolicy.isError ? (
        <p className="mt-3 text-xs font-semibold text-[#b34a42] dark:text-[#e89087]" role="alert" data-testid="cad-icon-policy-error">
          Could not load this team's icon choices.
        </p>
      ) : (
        <fieldset className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3" disabled={updateIconPolicy.isPending}>
          <legend className="sr-only">Available bot icons</legend>
          {CAD_ICON_OPTIONS.map(({ id, label, Icon }) => {
            const checked = draft.includes(id);
            return (
              <label
                key={id}
                className="flex min-h-9 items-center gap-2 rounded-lg border border-[#dce5e5] bg-white px-2 text-[11px] text-[#182232] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && draft.length <= 1}
                  onChange={(event) => {
                    setDraft((current) => event.target.checked
                      ? [...new Set([...current, id])]
                      : current.filter((icon) => icon !== id));
                    setFeedback(null);
                  }}
                  data-testid={`cad-icon-policy-${id}`}
                  className="h-4 w-4 accent-[#16869a]"
                />
                <Icon size={14} aria-hidden="true" />
                <span>{label}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      <button
        type="button"
        onClick={save}
        disabled={updateIconPolicy.isPending || iconPolicy.isLoading || iconPolicy.isError || orderedDraft.length === 0 || !dirty}
        data-testid="button-save-cad-icon-policy"
        className="mt-3 h-10 rounded-lg bg-[#16869a] px-4 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#16869a] dark:hover:bg-[#1c8b9d]"
      >
        {updateIconPolicy.isPending ? "Saving…" : "Save icon choices"}
      </button>
      {feedback && (
        <p
          className={`mt-2 text-xs font-semibold ${feedback.kind === "error" ? "text-[#b34a42] dark:text-[#e89087]" : "text-[#247d63] dark:text-[#6fce8f]"}`}
          role={feedback.kind === "error" ? "alert" : "status"}
          data-testid="cad-icon-policy-feedback"
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
