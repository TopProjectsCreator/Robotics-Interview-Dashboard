import { useState, type FormEvent } from "react";
import { useUpdateTeamAccessCode } from "@workspace/api-client-react";

const fieldClass = "h-10 min-w-0 flex-1 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm text-[#182232] outline-none placeholder:text-[#9aa8ae] focus:border-[#16869a] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2] dark:placeholder:text-[#6b7f8a] dark:focus:border-[#3f8492]";

function messageFor(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const body = error.data;
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  }
  return error instanceof Error ? error.message : "Could not update the team access code. Try again.";
}

export function TeamAccessCodeSettings({
  canManage,
}: {
  canManage: boolean;
}) {
  const updateCode = useUpdateTeamAccessCode();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!canManage) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const code = draft.trim();
    if (code.length < 4 || code.length > 128) {
      setError("Choose a team access code with 4–128 characters.");
      return;
    }
    updateCode.mutate({ data: { code } }, {
      onSuccess: (result) => {
        setDraft("");
        setNotice(result.message);
      },
      onError: (mutationError) => setError(messageFor(mutationError)),
    });
  };

  return (
    <section className="mt-4 border-t border-[#e5ecec] pt-3 dark:border-[#273c48]" data-testid="settings-team-access-code">
      <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#16869a] dark:text-[#6fc3cf]">Team access code</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-[#7c8c91] dark:text-[#93a8b2]">
        Set a new code for future sign-ins. Your current code is never shown, and teammates who are already signed in stay signed in.
      </p>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <label htmlFor="team-access-code-new" className="sr-only">New team access code</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="team-access-code-new"
            type="password"
            autoComplete="new-password"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
              setNotice("");
            }}
            minLength={4}
            maxLength={128}
            placeholder="Enter a new code"
            data-testid="input-new-team-access-code"
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={updateCode.isPending || draft.trim().length < 4}
            data-testid="button-save-team-access-code"
            className="rounded-lg bg-[#16869a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#16869a] dark:hover:bg-[#1c8b9d]"
          >
            {updateCode.isPending ? "Saving…" : "Save new code"}
          </button>
        </div>
        {notice && <p role="status" aria-live="polite" className="text-xs font-semibold text-[#247d63] dark:text-[#6fce8f]" data-testid="team-access-code-success">{notice}</p>}
        {error && <p role="alert" className="text-xs font-semibold text-[#b34a42] dark:text-[#e89087]" data-testid="team-access-code-error">{error}</p>}
      </form>
    </section>
  );
}
