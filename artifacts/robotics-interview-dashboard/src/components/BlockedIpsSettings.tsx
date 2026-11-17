import { useState } from "react";
import { CircleOff, LoaderCircle, ShieldBan, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListBlockedIpsQueryKey,
  useBlockLoginIp,
  useListBlockedIps,
  useUnblockLoginIp,
} from "@workspace/api-client-react";

const field =
  "h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm text-[#182232] outline-none placeholder:text-[#9aa8ae] focus:border-[#16869a] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2] dark:placeholder:text-[#6b7f8a] dark:focus:border-[#3f8492]";
const addButton =
  "flex h-10 items-center gap-1.5 rounded-lg border border-[#cbd9da] bg-white px-3 text-xs font-semibold text-[#385762] transition hover:border-[#16869a] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3a5567] dark:bg-[#182935] dark:text-[#c3d3db] dark:hover:border-[#3f8492]";
const removeButton =
  "rounded-lg border border-[#e0b8b4] bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#a34d46] transition hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#7d4038] dark:bg-[#22191b] dark:text-[#e89087] dark:hover:bg-[#3a211d]";

/** Pull the server's { error } message out of an API failure. */
function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null | undefined)?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const message = (data as Record<string, unknown>).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatBlockedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function testIdSlug(ip: string): string {
  return ip.replace(/[^a-z0-9]/gi, "-");
}

/**
 * Team admins block exact IP addresses from this team's sign-in paths.
 * Blocking takes effect at the next sign-in for the team; it never signs out
 * someone who is already in, and the address can be unblocked at any time.
 */
export function BlockedIpsSettings() {
  const queryClient = useQueryClient();
  const list = useListBlockedIps({
    query: { queryKey: getListBlockedIpsQueryKey(), retry: false },
  });
  const block = useBlockLoginIp();
  const unblock = useUnblockLoginIp();
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListBlockedIpsQueryKey() });
  const busy = block.isPending || unblock.isPending;

  const submit = () => {
    setError("");
    setNotice("");
    const candidate = ip.trim();
    if (!candidate) {
      setError("Enter the IPv4 or IPv6 address to block.");
      return;
    }
    block.mutate(
      { data: { ip: candidate, ...(reason.trim() ? { reason: reason.trim() } : {}) } },
      {
        onSuccess: (saved) => {
          setIp("");
          setReason("");
          setNotice(`Blocked ${saved.ip} from signing in to this team.`);
          void refresh();
        },
        onError: (mutationError) => setError(apiErrorMessage(mutationError, "Could not block that address.")),
      },
    );
  };

  const remove = (target: string) => {
    setError("");
    setNotice("");
    unblock.mutate(
      { data: { ip: target } },
      {
        onSuccess: () => {
          setNotice(`Unblocked ${target}.`);
          void refresh();
        },
        onError: (mutationError) => setError(apiErrorMessage(mutationError, "Could not unblock that address.")),
      },
    );
  };

  const items = list.data?.items ?? [];

  return (
    <div>
      <p className="text-xs leading-5 text-[#7c8c91] dark:text-[#93a8b2]">
        Block an IP address from signing in to this team. Blocked addresses cannot use the team access code, passwords, passkeys, or create accounts.
        Blocking takes effect at the next sign-in — it does not sign anyone out who is already in. An address is blocked for every sign-in to this team and no other team.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          value={ip}
          onChange={(event) => setIp(event.target.value)}
          placeholder="203.0.113.10 or 2001:db8::1"
          aria-label="IP address to block"
          autoComplete="off"
          spellCheck={false}
          data-testid="input-blocked-ip"
          className={`${field} min-w-0 flex-1`}
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value.slice(0, 120))}
          placeholder="Note (optional)"
          aria-label="Reason (optional)"
          autoComplete="off"
          maxLength={120}
          data-testid="input-blocked-ip-reason"
          className={`${field} min-w-0 flex-1`}
        />
        <button type="submit" disabled={busy} data-testid="button-block-ip" className={addButton}>
          {block.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldBan size={14} />}
          Block
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-[#a34d46] dark:text-[#e89087]" data-testid="blocked-ip-error">{error}</p>}
      {notice && <p role="status" className="mt-2 text-xs text-[#12737d] dark:text-[#6fc3cf]" data-testid="blocked-ip-notice">{notice}</p>}
      {list.isLoading && <p className="mt-3 text-xs text-[#7c8c91] dark:text-[#93a8b2]" data-testid="blocked-ip-loading">Loading the blocklist…</p>}
      {list.isError && (
        <p className="mt-3 text-xs text-[#a34d46] dark:text-[#e89087]" data-testid="blocked-ip-load-error">
          Could not load the blocklist.{" "}
          <button type="button" onClick={() => list.refetch()} className="font-semibold text-[#16869a] dark:text-[#6fc3cf]">Retry</button>
        </p>
      )}
      {list.data && (items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#7c8c91] dark:text-[#93a8b2]" data-testid="blocked-ip-empty">
          <CircleOff size={13} aria-hidden="true" />
          No addresses are blocked.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((entry) => (
            <li
              key={entry.ip}
              data-testid={`blocked-ip-entry-${testIdSlug(entry.ip)}`}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e3ebeb] bg-white px-3 py-2 text-xs dark:border-[#31495a] dark:bg-[#0f1e27]"
            >
              <code className="mono rounded bg-[#eef3f2] px-2 py-0.5 text-[11px] font-semibold text-[#182232] dark:bg-[#16262f] dark:text-[#e6eef2]">{entry.ip}</code>
              {entry.reason && <span className="max-w-[18rem] truncate text-[#52666e] dark:text-[#b3c3cb]" title={entry.reason}>{entry.reason}</span>}
              <span className="text-[#8a999d] dark:text-[#6b828c]">
                {entry.createdByName ? `Blocked by ${entry.createdByName}` : "Blocked"}
                {entry.createdAt && Number.isFinite(new Date(entry.createdAt).getTime()) ? ` · ${formatBlockedAt(entry.createdAt)}` : ""}
              </span>
              <button
                type="button"
                onClick={() => remove(entry.ip)}
                disabled={busy}
                aria-label={`Unblock ${entry.ip}`}
                data-testid={`button-unblock-${testIdSlug(entry.ip)}`}
                className={`ml-auto flex items-center gap-1 ${removeButton}`}
              >
                <Trash2 size={11} aria-hidden="true" />
                Unblock
              </button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
