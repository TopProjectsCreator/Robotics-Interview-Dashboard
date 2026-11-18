import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCadIconPolicyQueryKey, updateCadIconPolicy, useGetCadIconPolicy, type CadIcon } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { CAD_ICON_OPTIONS, DEFAULT_CAD_ICON_IDS } from "@/lib/cadIcons";

export function CadIconSettings() {
  const queryClient = useQueryClient();
  const iconPolicy = useGetCadIconPolicy({
    query: { queryKey: getGetCadIconPolicyQueryKey(), retry: false },
  });
  const [draft, setDraft] = useState<CadIcon[]>([...DEFAULT_CAD_ICON_IDS]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (iconPolicy.data) setDraft([...iconPolicy.data.enabledIcons]);
  }, [iconPolicy.data]);

  const savedIcons = iconPolicy.data?.enabledIcons ?? DEFAULT_CAD_ICON_IDS;
  const save = async () => {
    const enabledIcons = CAD_ICON_OPTIONS
      .filter(({ id }) => draft.includes(id))
      .map(({ id }) => id);
    if (!enabledIcons.length || saving) return;

    setSaving(true);
    setNotice("");
    setError("");
    try {
      await updateCadIconPolicy({ enabledIcons });
      await queryClient.invalidateQueries({ queryKey: getGetCadIconPolicyQueryKey() });
      setNotice("CAD icon choices saved.");
    } catch (caught) {
      const apiError = (caught as { data?: { error?: unknown } }).data?.error;
      setError(
        typeof apiError === "string"
          ? apiError
          : caught instanceof Error && caught.message
            ? caught.message
            : "Could not save the team's icon choices. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" data-testid="cad-icon-policy">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Available bot icons</h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Choose which Lucide icons your team can use in the CAD workspace. Existing bots keep their current icon.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {draft.length} selected
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft([...DEFAULT_CAD_ICON_IDS]);
              setNotice("");
              setError("");
            }}
            disabled={saving || iconPolicy.isLoading || iconPolicy.isError ||
              CAD_ICON_OPTIONS.every(({ id }) => draft.includes(id))}
            data-testid="button-restore-all-cad-icons"
          >
            Restore all icons
          </Button>
        </div>
      </div>

      {iconPolicy.isError && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive" role="alert" data-testid="cad-icon-policy-error">
            Could not load the team&apos;s icon choices.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void iconPolicy.refetch()}>
            Retry
          </Button>
        </div>
      )}

      <fieldset
        className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        disabled={saving || iconPolicy.isLoading || iconPolicy.isError}
      >
        <legend className="sr-only">Available bot icons</legend>
        {CAD_ICON_OPTIONS.map(({ id, label, Icon }) => {
          const checked = draft.includes(id);
          return (
            <label
              key={id}
              className="flex min-h-11 items-center gap-2.5 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition hover:border-primary/50"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={checked && draft.length <= 1}
                onChange={(event) => {
                  setDraft((current) => event.target.checked
                    ? [...new Set([...current, id])]
                    : current.filter((icon) => icon !== id));
                  setNotice("");
                }}
                data-testid={`cad-icon-policy-${id}`}
                className="accent-primary"
              />
              <Icon size={16} aria-hidden="true" className="text-primary" />
              <span>{label}</span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div aria-live="polite" className="min-h-5 text-xs">
          {error && <p className="text-destructive" data-testid="cad-icon-policy-save-error">{error}</p>}
          {!error && notice && <p className="text-emerald-700 dark:text-emerald-300" role="status" data-testid="cad-icon-policy-saved">{notice}</p>}
        </div>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || iconPolicy.isLoading || iconPolicy.isError || draft.length === 0 ||
            draft.join(",") === savedIcons.join(",")}
          data-testid="button-save-cad-icon-policy"
        >
          {saving ? "Saving…" : "Save icon choices"}
        </Button>
      </div>
    </section>
  );
}
