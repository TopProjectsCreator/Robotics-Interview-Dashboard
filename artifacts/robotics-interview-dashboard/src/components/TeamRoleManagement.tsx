import { useEffect, useMemo, useState } from "react";
import {
  getGetSessionQueryKey,
  getListInterviewersQueryKey,
  getListTeamRolesQueryKey,
  useAssignCustomRole,
  useCreateTeamRole,
  useDeleteTeamRole,
  useListTeamRoles,
  useUpdateTeamRole,
  type InterviewerAccount,
  type TeamRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PERMISSION_CATEGORIES, type PermissionId } from "@workspace/api-zod";

type RoleDraft = { name: string; permissions: PermissionId[] };

const emptyDraft: RoleDraft = { name: "", permissions: [] };

export function TeamRoleManagement({
  teamId,
  accounts,
  accountsLoading,
}: {
  teamId?: string;
  accounts: InterviewerAccount[];
  accountsLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const enabled = Boolean(teamId);
  const rolesQuery = useListTeamRoles({
    query: { queryKey: [...getListTeamRolesQueryKey(), teamId], enabled, retry: false },
  });
  const createRole = useCreateTeamRole();
  const updateRole = useUpdateTeamRole();
  const deleteRole = useDeleteTeamRole();
  const assignRole = useAssignCustomRole();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft);
  const [notice, setNotice] = useState("");
  const [busyAccountId, setBusyAccountId] = useState("");
  const roles = rolesQuery.data?.roles ?? [];
  const selectedPermissions = useMemo(() => new Set(draft.permissions), [draft.permissions]);

  useEffect(() => {
    if (editingId === null) return;
    const role = roles.find((item) => item.id === editingId);
    if (role) setDraft({ name: role.name, permissions: [...role.permissions] as PermissionId[] });
  }, [editingId, roles]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getListTeamRolesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListInterviewersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
  };
  const togglePermission = (permission: PermissionId) => {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };
  const saveRole = () => {
    const name = draft.name.trim().replace(/\s+/g, " ");
    if (!name) {
      setNotice("Enter a name for this role.");
      return;
    }
    setNotice("");
    const data = { name, permissions: [...draft.permissions] };
    const options = {
      onSuccess: () => {
        setDraft(emptyDraft);
        setEditingId(null);
        setNotice("Role saved.");
        invalidate();
      },
      onError: () => setNotice("Could not save this role. Check the name and try again."),
    };
    if (editingId) updateRole.mutate({ roleId: editingId, data }, options);
    else createRole.mutate({ data }, options);
  };
  const removeRole = (role: TeamRole) => {
    if (!window.confirm(`Delete “${role.name}”? Accounts using it will return to their built-in role.`)) return;
    setNotice("");
    deleteRole.mutate({ roleId: role.id }, {
      onSuccess: () => {
        if (editingId === role.id) {
          setEditingId(null);
          setDraft(emptyDraft);
        }
        setNotice("Role deleted.");
        invalidate();
      },
      onError: () => setNotice("Could not delete this role."),
    });
  };
  const changeAssignment = (account: InterviewerAccount, customRoleId: string) => {
    setBusyAccountId(account.id);
    assignRole.mutate({ interviewerId: account.id, data: { customRoleId: customRoleId || null } }, {
      onSuccess: () => {
        setBusyAccountId("");
        setNotice(`Role access updated for ${account.displayName}.`);
        invalidate();
      },
      onError: () => {
        setBusyAccountId("");
        setNotice(`Could not update the role for ${account.displayName}.`);
        void queryClient.invalidateQueries({ queryKey: getListInterviewersQueryKey() });
      },
    });
  };
  const field = "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary";
  const quietButton = "min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent";
  const isSaving = createRole.isPending || updateRole.isPending || deleteRole.isPending;

  return <section className="mt-3 border-t border-[#e5ecec] pt-4 dark:border-[#273c48]" data-testid="settings-custom-roles">
    <p className="mono text-[10px] uppercase tracking-[.16em] text-[#7c8c91] dark:text-[#93a8b2]">Custom roles</p>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Build team roles from the available capabilities. Admin account, role, workspace-access, and site-owner controls are never included.</p>
    {rolesQuery.isLoading && <p className="mt-3 text-xs text-muted-foreground">Loading team roles…</p>}
    {rolesQuery.isError && <div className="mt-3 flex items-center justify-between gap-2 text-xs text-destructive"><span>Roles could not be loaded. Role assignment is unavailable.</span><button type="button" className={quietButton} onClick={() => void rolesQuery.refetch()}>Retry</button></div>}
    {roles.length > 0 && <div className="mt-3 space-y-2">
      {roles.map((role) => <div key={role.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5" data-testid={`team-role-${role.id}`}>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{role.name}</p><p className="text-[11px] text-muted-foreground">{role.permissions.length} capabilities</p></div>
        <div className="flex gap-2"><button type="button" className={quietButton} onClick={() => { setEditingId(role.id); setDraft({ name: role.name, permissions: [...role.permissions] as PermissionId[] }); setNotice(""); }}>Edit</button><button type="button" className="min-h-10 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10" disabled={deleteRole.isPending} onClick={() => removeRole(role)}>Delete</button></div>
      </div>)}
    </div>}
    {!accountsLoading && accounts.length > 0 && <div className="mt-4 space-y-2" data-testid="custom-role-assignments">
      <p className="text-xs font-semibold">Assign roles to team accounts</p>
      {accounts.filter((account) => account.role !== "coordinator" && account.role !== "admin").map((account) => <label key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
        <span className="text-xs font-medium">{account.displayName}</span>
        <select aria-label={`Custom role for ${account.displayName}`} data-testid={`select-custom-role-${account.id}`} value={account.customRoleId ?? ""} disabled={rolesQuery.isLoading || rolesQuery.isError || busyAccountId === account.id} onChange={(event) => changeAssignment(account, event.target.value)} className={`${field} max-w-[min(14rem,100%)]`}>
          <option value="">Built-in role</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </label>)}
    </div>}
    <div className="mt-4 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{editingId ? "Edit role" : "Create role"}</p>
        {editingId && <button type="button" className={quietButton} onClick={() => { setEditingId(null); setDraft(emptyDraft); setNotice(""); }}>New role</button>}
      </div>
      <label className="mt-3 block text-xs font-semibold">Role name
        <input value={draft.name} maxLength={60} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} data-testid="input-custom-role-name" placeholder="e.g. Build lead" className={`${field} mt-1 w-full`} />
      </label>
      <div className="mt-3 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
        {PERMISSION_CATEGORIES.map((category) => <fieldset key={category.id}>
          <legend className="mb-1 text-xs font-semibold">{category.label}</legend>
          <div className="space-y-1.5">
            {category.permissions.map((permission) => <label key={permission.id} className="flex min-h-8 items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={selectedPermissions.has(permission.id)} onChange={() => togglePermission(permission.id)} data-testid={`checkbox-permission-${permission.id}`} className="h-4 w-4 accent-primary" />
              <span>{permission.label}</span>
            </label>)}
          </div>
        </fieldset>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={isSaving || !teamId || rolesQuery.isError} onClick={saveRole} data-testid="button-save-custom-role" className="min-h-10 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{isSaving ? "Saving…" : editingId ? "Save role" : "Create role"}</button>
        <button type="button" disabled={isSaving} onClick={() => setDraft((current) => ({ ...current, permissions: [] }))} className={quietButton}>Clear permissions</button>
      </div>
    </div>
    {notice && <p role="status" className="mt-2 text-xs text-muted-foreground" data-testid="custom-role-notice">{notice}</p>}
  </section>;
}
