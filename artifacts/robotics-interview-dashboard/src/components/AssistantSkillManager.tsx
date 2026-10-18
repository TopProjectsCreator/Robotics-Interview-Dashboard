import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, LoaderCircle, Pencil, Plus, RotateCcw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import {
  getListAssistantSkillsQueryKey,
  useCreateAssistantSkill,
  useDeleteAssistantSkill,
  useListAssistantSkills,
  useUpdateAssistantSkill,
} from "@workspace/api-client-react";
import type { AssistantSkill } from "@workspace/api-client-react";
import { ASSISTANT_TOOL_GROUPS } from "./assistantTools";

type SkillDraft = {
  name: string;
  description: string;
  instructions: string;
  actions: string[];
  enabled: boolean;
};

const EMPTY_DRAFT: SkillDraft = { name: "", description: "", instructions: "", actions: [], enabled: true };
const ACTIONS = ASSISTANT_TOOL_GROUPS.flatMap((group) =>
  group.tools.map((tool) => ({ ...tool, group: group.label })),
);

type AssistantSkillManagerProps = {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function AssistantSkillManager({ expanded: controlledExpanded, onExpandedChange }: AssistantSkillManagerProps = {}) {
  const queryClient = useQueryClient();
  const skillsQuery = useListAssistantSkills();
  const createSkill = useCreateAssistantSkill();
  const updateSkill = useUpdateAssistantSkill();
  const deleteSkill = useDeleteAssistantSkill();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (value: boolean) => {
    if (controlledExpanded === undefined) setInternalExpanded(value);
    onExpandedChange?.(value);
  };
  const [draft, setDraft] = useState<SkillDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const skills = skillsQuery.data?.items ?? [];
  const beginCreate = () => {
    setFeedback(null);
    setEditingId("new");
    setViewingId(null);
    setDraft({ ...EMPTY_DRAFT });
  };
  const beginEdit = (skill: AssistantSkill) => {
    setFeedback(null);
    setEditingId(skill.id);
    setViewingId(null);
    setDraft({
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      actions: skill.actions,
      enabled: skill.enabled,
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT });
  };
  const persist = async () => {
    if (!draft.name.trim() || !draft.description.trim() || !draft.instructions.trim()) {
      setFeedback({ kind: "error", text: "Add a name, summary, and instructions before saving." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        instructions: draft.instructions.trim(),
        actions: draft.actions,
        enabled: draft.enabled,
      };
      if (editingId === "new") {
        await createSkill.mutateAsync({ data: payload });
        setFeedback({ kind: "success", text: "Skill added to the team library." });
      } else if (editingId) {
        await updateSkill.mutateAsync({ skillId: editingId, data: payload });
        setFeedback({ kind: "success", text: "Skill changes saved for the team." });
      }
      await queryClient.invalidateQueries({ queryKey: getListAssistantSkillsQueryKey() });
      cancelEdit();
    } catch (error) {
      setFeedback({ kind: "error", text: messageFromError(error) });
    } finally {
      setSaving(false);
    }
  };
  const toggleEnabled = async (skill: AssistantSkill) => {
    setFeedback(null);
    try {
      await updateSkill.mutateAsync({ skillId: skill.id, data: { enabled: !skill.enabled } });
      await queryClient.invalidateQueries({ queryKey: getListAssistantSkillsQueryKey() });
      setFeedback({ kind: "success", text: `${skill.name} ${skill.enabled ? "paused" : "enabled"} for the team.` });
    } catch (error) {
      setFeedback({ kind: "error", text: messageFromError(error) });
    }
  };
  const removeSkill = async (skill: AssistantSkill) => {
    setFeedback(null);
    try {
      await deleteSkill.mutateAsync({ skillId: skill.id });
      await queryClient.invalidateQueries({ queryKey: getListAssistantSkillsQueryKey() });
      setConfirmDeleteId(null);
      setViewingId(null);
      setFeedback({ kind: "success", text: `${skill.name} removed from the team library.` });
    } catch (error) {
      setFeedback({ kind: "error", text: messageFromError(error) });
    }
  };

  return (
    <section className="assistant-skill-manager" aria-label="Team-shared assistant skills" data-testid="assistant-skill-manager">
      <div className="assistant-skill-heading">
        <button
          type="button"
          className="assistant-skill-heading-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          data-testid="toggle-assistant-skills"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span className="assistant-skill-heading-icon"><ShieldCheck size={15} /></span>
          <span className="assistant-skill-heading-copy">
            <strong>Team skills</strong>
            <small>Repeat trusted workflows</small>
          </span>
          <span className="assistant-skill-total">{skills.length}</span>
        </button>
        {expanded && (
          <button type="button" className="assistant-skill-add" onClick={beginCreate} aria-label="Create skill" data-testid="create-assistant-skill">
            <Plus size={14} /> New
          </button>
        )}
      </div>

      {expanded && (
        <div className="assistant-skill-content">
          <p className="assistant-skill-note">Shared with your team. Skills guide responses using approved assistant actions.</p>

          {feedback && (
            <p className={`assistant-skill-feedback assistant-skill-feedback-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"} data-testid="assistant-skill-feedback">
              {feedback.kind === "success" ? <Check size={13} /> : <ShieldCheck size={13} />}
              <span>{feedback.text}</span>
              <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={13} /></button>
            </p>
          )}

          {editingId && (
            <div className="assistant-skill-editor" data-testid="assistant-skill-editor">
              <div className="assistant-skill-editor-title">
                <strong>{editingId === "new" ? "New team skill" : "Edit team skill"}</strong>
                <button type="button" onClick={cancelEdit} aria-label="Close skill editor"><X size={15} /></button>
              </div>
              <label className="assistant-skill-field">
                <span>Name</span>
                <input autoFocus maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Interview debrief" data-testid="input-skill-name" />
              </label>
              <label className="assistant-skill-field">
                <span>Short description</span>
                <input maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="When this workflow is useful" data-testid="input-skill-description" />
              </label>
              <label className="assistant-skill-field">
                <span>Instructions</span>
                <textarea maxLength={8000} rows={4} value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} placeholder="Describe the trusted steps and expected response…" data-testid="input-skill-instructions" />
              </label>
              <fieldset className="assistant-skill-action-picker">
                <legend>Approved actions <span>{draft.actions.length} selected</span></legend>
                <div className="assistant-skill-action-list">
                  {ACTIONS.map((action) => {
                    const checked = draft.actions.includes(action.name);
                    return (
                      <label key={action.name} className="assistant-skill-action-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setDraft({
                            ...draft,
                            actions: event.target.checked
                              ? [...draft.actions, action.name]
                              : draft.actions.filter((name) => name !== action.name),
                          })}
                          data-testid={`skill-action-${action.name}`}
                        />
                        <span><strong>{action.label}</strong><small>{action.group} · {action.hint}</small></span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="assistant-skill-enabled-check">
                <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} data-testid="input-skill-enabled" />
                <span>Available to the assistant</span>
              </label>
              <div className="assistant-skill-editor-actions">
                <button type="button" className="assistant-skill-cancel" onClick={cancelEdit} disabled={saving}>Cancel</button>
                <button type="button" className="assistant-skill-save" onClick={persist} disabled={saving} data-testid="save-assistant-skill">
                  {saving ? <LoaderCircle size={13} className="assistant-skill-spin" /> : <Save size={13} />}
                  {saving ? "Saving…" : "Save skill"}
                </button>
              </div>
            </div>
          )}

          {skillsQuery.isLoading && (
            <div className="assistant-skill-skeleton" role="status" aria-label="Loading team skills">
              <span /><span /><span />
            </div>
          )}
          {skillsQuery.isError && !skillsQuery.isLoading && (
            <div className="assistant-skill-load-error" role="alert">
              <span>Team skills could not be loaded.</span>
              <button type="button" onClick={() => skillsQuery.refetch()} data-testid="retry-assistant-skills"><RotateCcw size={12} /> Retry</button>
            </div>
          )}
          {!skillsQuery.isLoading && !skillsQuery.isError && skills.length === 0 && !editingId && (
            <div className="assistant-skill-empty" data-testid="assistant-skills-empty">
              <div className="assistant-skill-empty-mark"><ShieldCheck size={17} /></div>
              <strong>No team skills yet</strong>
              <span>Save a proven workflow once, then reuse it across interviews.</span>
              <button type="button" onClick={beginCreate}>Create the first skill <Plus size={13} /></button>
            </div>
          )}

          {!skillsQuery.isLoading && skills.length > 0 && (
            <div className="assistant-skill-list">
              {skills.map((skill) => {
                const isViewing = viewingId === skill.id;
                const isConfirmingDelete = confirmDeleteId === skill.id;
                return (
                  <article key={skill.id} className={`assistant-skill-card${skill.enabled ? "" : " is-disabled"}`} data-testid={`assistant-skill-${skill.id}`}>
                    <div className="assistant-skill-card-top">
                      <button type="button" className="assistant-skill-name-button" onClick={() => { setViewingId(isViewing ? null : skill.id); setEditingId(null); }} aria-expanded={isViewing} data-testid={`view-skill-${skill.id}`}>
                        <span className={`assistant-skill-status-dot${skill.enabled ? " is-on" : ""}`} />
                        <span>{skill.name}</span>
                      </button>
                      <div className="assistant-skill-card-actions">
                        <button type="button" onClick={() => toggleEnabled(skill)} aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`} aria-pressed={skill.enabled} disabled={updateSkill.isPending} className={`assistant-skill-enable${skill.enabled ? " is-on" : ""}`} data-testid={`toggle-skill-${skill.id}`}>
                          <span />
                        </button>
                        <button type="button" onClick={() => beginEdit(skill)} aria-label={`Edit ${skill.name}`} className="assistant-skill-icon-button" data-testid={`edit-skill-${skill.id}`}><Pencil size={13} /></button>
                        <button type="button" onClick={() => setConfirmDeleteId(isConfirmingDelete ? null : skill.id)} aria-label={`Delete ${skill.name}`} className="assistant-skill-icon-button assistant-skill-delete-button" data-testid={`delete-skill-${skill.id}`}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="assistant-skill-description">{skill.description}</p>
                    {isConfirmingDelete ? (
                      <div className="assistant-skill-delete-confirm" role="group" aria-label={`Confirm deletion of ${skill.name}`}>
                        <span>Remove this shared skill?</span>
                        <button type="button" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                        <button type="button" onClick={() => removeSkill(skill)} disabled={deleteSkill.isPending} data-testid={`confirm-delete-skill-${skill.id}`}>
                          {deleteSkill.isPending ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    ) : null}
                    {isViewing && (
                      <div className="assistant-skill-detail">
                        <p className="assistant-skill-detail-label">Instructions</p>
                        <p className="assistant-skill-instructions">{skill.instructions}</p>
                        <p className="assistant-skill-detail-label">Approved actions</p>
                        <div className="assistant-skill-action-chips">
                          {skill.actions.length
                            ? skill.actions.map((name) => <span key={name}>{ACTIONS.find((action) => action.name === name)?.label ?? name}</span>)
                            : <span className="assistant-skill-no-actions">No actions selected</span>}
                        </div>
                        <p className="assistant-skill-updated">Updated {new Date(skill.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
