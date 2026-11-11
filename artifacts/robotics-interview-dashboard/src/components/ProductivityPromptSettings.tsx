import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import {
  getGetChatProductivitySettingsQueryKey,
  useGetChatProductivitySettings,
  useUpdateChatProductivitySettings,
} from "@workspace/api-client-react";

export function ProductivityPromptSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient();
  const queryKey = [...getGetChatProductivitySettingsQueryKey(), teamId];
  const settings = useGetChatProductivitySettings({
    query: {
      queryKey,
      retry: false,
    },
  });
  const updateSettings = useUpdateChatProductivitySettings();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (settings.data) setDraft(settings.data.customMessage);
  }, [settings.data?.customMessage]);

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    updateSettings.mutate({ data: { customMessage: draft.trim() } }, {
      onSuccess: (saved) => {
        queryClient.setQueryData(queryKey, saved);
        setDraft(saved.customMessage);
        setNotice("Custom message saved.");
      },
      onError: () => setNotice("Could not save the custom message. Try again."),
    });
  };

  const field = "min-h-24 w-full resize-y rounded-lg border border-[#dce5e5] bg-white px-3 py-2 text-sm text-[#182232] outline-none placeholder:text-[#9aa8ae] focus:border-[#16869a] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2] dark:placeholder:text-[#6b7f8a] dark:focus:border-[#3f8492]";

  return (
    <div className="mt-2 border-t border-[#e5ecec] pt-2 dark:border-[#273c48]" data-testid="settings-productivity-prompt">
      <p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91] dark:text-[#93a8b2]">Productivity meter</p>
      <p className="mt-2 text-xs leading-5 text-[#7c8c91] dark:text-[#93a8b2]">
        Add team-specific guidance to automatic and selected-range AI reviews. Existing scoring, privacy, and response-format rules still apply.
      </p>
      {settings.isLoading && <p className="mt-3 text-xs text-[#7c8c91] dark:text-[#93a8b2]" data-testid="productivity-prompt-loading">Loading productivity settings…</p>}
      {settings.isError && <p role="alert" className="mt-3 text-xs text-[#a34d46] dark:text-[#e89087]" data-testid="productivity-prompt-load-error">Could not load productivity settings.</p>}
      {settings.data && (
        <form onSubmit={save} className="mt-3 space-y-2">
          <label htmlFor="productivity-custom-message" className="block text-xs font-semibold">Custom message for the AI</label>
          <textarea
            id="productivity-custom-message"
            value={draft}
            maxLength={2000}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setNotice("");
            }}
            data-testid="input-productivity-custom-message"
            placeholder="For example: Focus on concrete progress against the team's current build goals."
            className={field}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-[#7c8c91] dark:text-[#93a8b2]">{draft.length}/2000 characters</span>
            <button
              type="submit"
              disabled={updateSettings.isPending || draft.trim() === settings.data.customMessage}
              data-testid="button-save-productivity-custom-message"
              className="inline-flex items-center gap-2 rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#16869a] dark:hover:bg-[#1c8b9d]"
            >
              {updateSettings.isPending && <LoaderCircle size={14} className="animate-spin" />}
              {updateSettings.isPending ? "Saving…" : "Save custom message"}
            </button>
          </div>
          {notice && (
            <p role={notice.startsWith("Could not") ? "alert" : "status"} data-testid="productivity-prompt-result" className={`text-xs ${notice.startsWith("Could not") ? "text-[#a34d46] dark:text-[#e89087]" : "text-[#247d63] dark:text-[#6fce8f]"}`}>
              {notice}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
