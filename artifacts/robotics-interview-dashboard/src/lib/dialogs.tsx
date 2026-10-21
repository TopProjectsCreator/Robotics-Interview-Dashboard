import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { ModalOverlay } from "@/components/ModalOverlay";

/**
 * In-app replacements for window.alert / window.prompt / window.confirm.
 *
 * Native dialogs freeze the whole tab, cannot be styled, look out of place in
 * dark mode, and are unusable in headless tests. These helpers return plain
 * promises so call sites keep their familiar shape:
 *
 *   if (!(await confirmAction({ title: "Delete it?" }))) return;
 *   const name = await askValue({ title: "Folder name" });
 *   notify({ title: "Saved" });
 *
 * Render <DialogHost /> once near the app root.
 */

type ConfirmRequest = {
  kind: "confirm";
  title: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};

type InputRequest = {
  kind: "input";
  title: string;
  label?: string;
  detail?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  resolve: (value: string | null) => void;
};

type DialogRequest = ConfirmRequest | InputRequest;

let currentRequest: DialogRequest | null = null;
const subscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function publish() {
  subscribers.forEach((callback) => callback());
}

function closeRequest(result: boolean | string | null) {
  const request = currentRequest;
  if (!request) return;
  currentRequest = null;
  publish();
  if (request.kind === "confirm") {
    request.resolve(result === true);
  } else {
    request.resolve(typeof result === "string" ? result : null);
  }
}

export function confirmAction(options: {
  title: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    currentRequest = { kind: "confirm", ...options, resolve };
    publish();
  });
}

export function askValue(options: {
  title: string;
  label?: string;
  detail?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
}): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    currentRequest = { kind: "input", ...options, resolve };
    publish();
  });
}

/** In-app replacement for window.alert — a non-blocking toast. */
export function notify(options: { title: string; description?: string }) {
  toast({ title: options.title, description: options.description });
}

export function DialogHost() {
  const request = useSyncExternalStore(subscribe, () => currentRequest, () => null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (request?.kind === "input") setDraft(request.initial ?? "");
  }, [request]);

  // If the host unmounts mid-dialog (route change, test cleanup), settle the
  // promise so no caller is left awaiting forever.
  useEffect(() => {
    return () => {
      if (currentRequest) closeRequest(currentRequest.kind === "confirm" ? false : null);
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape is handled by the shared overlay shell.
      if (event.key === "Enter" && request.kind === "input" && draft.trim()) {
        event.preventDefault();
        closeRequest(draft.trim());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request, draft]);

  if (!request) return null;

  const isInput = request.kind === "input";
  const danger = request.kind === "confirm" && request.danger === true;
  const cancel = () => closeRequest(request.kind === "confirm" ? false : null);
  const accept = () => {
    if (request.kind === "confirm") closeRequest(true);
    else closeRequest(draft.trim() || (request.initial ?? ""));
  };

  return (
    <ModalOverlay
      onClose={cancel}
      label={request.title}
      testId="app-dialog"
      backdropClassName="bg-[#112433]/55 dark:bg-[#050d13]/80"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#dce5e5] bg-white p-6 shadow-2xl dark:border-[#2a3f4c] dark:bg-[#13222c] dark:text-[#e8eef2]"
        data-testid="app-dialog-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-6">{request.title}</p>
            {request.detail && (
              <p className="mt-1.5 text-sm leading-5 text-[#63747c] dark:text-[#93a8b2]">{request.detail}</p>
            )}
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="Close"
            data-testid="app-dialog-close"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#60757c] transition hover:bg-[#f1f6f5] dark:text-[#9db2bd] dark:hover:bg-[#1e3340]"
          >
            <X size={16} />
          </button>
        </div>

        {isInput && (
          <label className="mt-4 block">
            {request.label && (
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-[#63747c] dark:text-[#a9bcc6]">
                {request.label}
              </span>
            )}
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={request.placeholder}
              data-testid="app-dialog-input"
              className="h-11 w-full rounded-lg border border-[#dce5e5] bg-white px-3 text-base md:text-sm text-[#182232] outline-none placeholder:text-[#9aa8ae] focus:border-[#16869a] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2] dark:placeholder:text-[#6b7f8a] dark:focus:border-[#3f8492]"
            />
          </label>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            data-testid="app-dialog-cancel"
            className="min-h-11 rounded-lg border border-[#cbd9da] bg-white px-4 py-2 text-sm font-semibold text-[#385762] transition hover:border-[#16869a] dark:border-[#3a5567] dark:bg-[#182935] dark:text-[#c3d3db] dark:hover:border-[#3f8492]"
          >
            {request.kind === "confirm" ? request.cancelLabel ?? "Cancel" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={isInput && !draft.trim()}
            data-testid={isInput ? "app-dialog-submit" : "app-dialog-confirm"}
            className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? "bg-[#b34a42] text-white hover:bg-[#c2544b]"
                : "bg-[#16869a] text-white hover:bg-[#106d7a] dark:bg-[#16869a] dark:hover:bg-[#1c8b9d]"
            }`}
          >
            {isInput ? request.confirmLabel ?? "Save" : request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
