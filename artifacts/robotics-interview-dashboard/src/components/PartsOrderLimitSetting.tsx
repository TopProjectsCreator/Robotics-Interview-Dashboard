import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPartsOrderSettingsQueryKey,
  useGetPartsOrderSettings,
  useUpdatePartsOrderSettings,
} from "@workspace/api-client-react";

const MAX_ORDER_ITEMS = 1_000_000;

export function PartsOrderLimitSetting({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient();
  const queryKey = [...getGetPartsOrderSettingsQueryKey(), teamId];
  const settingsQuery = useGetPartsOrderSettings({
    query: {
      queryKey,
      enabled: Boolean(teamId),
      retry: false,
      refetchOnMount: "always",
    },
  });
  const updateSettings = useUpdatePartsOrderSettings();
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setDraft(settingsQuery.data?.maxOrderItems == null ? "" : String(settingsQuery.data.maxOrderItems));
    setFeedback(null);
  }, [settingsQuery.data, teamId]);

  const save = () => {
    const trimmed = draft.trim();
    const maxOrderItems = trimmed ? Number(trimmed) : null;
    if (
      maxOrderItems !== null &&
      (!Number.isInteger(maxOrderItems) || maxOrderItems < 1 || maxOrderItems > MAX_ORDER_ITEMS)
    ) {
      setFeedback({ kind: "error", text: `Enter a whole number from 1 to ${MAX_ORDER_ITEMS}, or leave it blank for no limit.` });
      return;
    }
    setFeedback(null);
    updateSettings.mutate({ data: { maxOrderItems } }, {
      onSuccess: (saved) => {
        queryClient.setQueryData(queryKey, saved);
        setDraft(saved.maxOrderItems == null ? "" : String(saved.maxOrderItems));
        setFeedback({ kind: "success", text: saved.maxOrderItems == null ? "Order-tray limit removed." : "Order-tray limit saved." });
      },
      onError: () => setFeedback({ kind: "error", text: "Could not save the order-tray limit. Try again." }),
    });
  };

  return (
    <section className="mt-2 border-t border-[#e5ecec] pt-2 dark:border-[#273c48]" data-testid="settings-parts-order-limit">
      <p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91] dark:text-[#93a8b2]">Parts order tray</p>
      <p className="mt-2 text-xs leading-5 text-[#7c8c91] dark:text-[#93a8b2]">
        Set the maximum total quantity in a draft order. This counts each line’s quantity, not just the number of products.
      </p>
      {settingsQuery.isLoading ? (
        <p className="mt-3 text-xs text-[#7c8c91] dark:text-[#93a8b2]" role="status">Loading order-tray settings…</p>
      ) : settingsQuery.isError ? (
        <p className="mt-3 text-xs text-[#a34d46] dark:text-[#e89087]" role="alert">Could not load this team’s order-tray settings.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="parts-order-item-limit" className="text-xs font-semibold text-[#182232] dark:text-[#e6eef2]">
              Maximum order-tray items
            </label>
            <input
              id="parts-order-item-limit"
              type="number"
              min={1}
              max={MAX_ORDER_ITEMS}
              step={1}
              inputMode="numeric"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setFeedback(null);
              }}
              placeholder="No limit"
              aria-describedby="parts-order-item-limit-help"
              data-testid="input-parts-order-item-limit"
              className="mt-1 h-10 w-full rounded-lg border border-[#dce5e5] bg-white px-3 text-base text-[#182232] outline-none focus:border-[#16869a] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2] dark:placeholder:text-[#6b7f8a] dark:focus:border-[#3f8492] md:text-sm"
            />
            <p id="parts-order-item-limit-help" className="mt-1 text-[11px] text-[#7c8c91] dark:text-[#93a8b2]">
              Leave blank for no limit.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={updateSettings.isPending || draft === (settingsQuery.data?.maxOrderItems == null ? "" : String(settingsQuery.data.maxOrderItems))}
            data-testid="button-save-parts-order-item-limit"
            className="h-10 rounded-lg bg-[#16869a] px-4 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#16869a] dark:hover:bg-[#1c8b9d]"
          >
            {updateSettings.isPending ? "Saving…" : "Save limit"}
          </button>
        </div>
      )}
      {feedback && (
        <p
          className={`mt-2 text-xs font-semibold ${feedback.kind === "error" ? "text-[#b34a42] dark:text-[#e89087]" : "text-[#247d63] dark:text-[#6fce8f]"}`}
          role={feedback.kind === "error" ? "alert" : "status"}
          data-testid="parts-order-item-limit-feedback"
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
