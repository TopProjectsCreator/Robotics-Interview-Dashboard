import { Check, Link2, X } from "lucide-react";

export type AssistantMcpConnectionRequest = {
  type: "custom_mcp_connection";
  endpointUrl: string;
};

type AssistantMcpConnectionPromptProps = {
  request: AssistantMcpConnectionRequest;
  connected?: boolean;
  busy?: boolean;
  apiKeyRequired?: boolean;
  apiKey?: string;
  apiKeyHeader?: string;
  apiKeyPrefix?: string;
  error?: string;
  onApiKeyChange?: (value: string) => void;
  onApiKeyHeaderChange?: (value: string) => void;
  onApiKeyPrefixChange?: (value: string) => void;
  onConnect: (endpointUrl: string) => void;
  onDismiss: () => void;
};

export function AssistantMcpConnectionPrompt({
  request,
  connected = false,
  busy = false,
  apiKeyRequired = false,
  apiKey = "",
  apiKeyHeader = "X-API-Key",
  apiKeyPrefix = "",
  error = "",
  onApiKeyChange,
  onApiKeyHeaderChange,
  onApiKeyPrefixChange,
  onConnect,
  onDismiss,
}: AssistantMcpConnectionPromptProps) {
  return (
    <section
      className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
      aria-label="Custom MCP connection request"
      data-testid="assistant-mcp-connection-prompt"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {connected ? <Check size={16} /> : <Link2 size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            {connected ? "MCP server connected" : "Connect a custom MCP server?"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {connected
              ? "The assistant can use this server's available tools in later turns."
              : "Review the destination. Nothing is contacted unless you choose Connect."}
          </p>
          <p
            className="mt-3 break-all rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs"
            data-testid="assistant-mcp-connection-endpoint"
          >
            {request.endpointUrl}
          </p>
        </div>
        {!connected && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss MCP connection request"
            title="Dismiss"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted"
            data-testid="button-dismiss-assistant-mcp-connection"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {!connected && apiKeyRequired && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="assistant-mcp-api-key-fields">
          <label className="grid gap-1 text-xs font-medium">
            API key
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => onApiKeyChange?.(event.target.value)}
              aria-label="MCP API key"
              data-testid="assistant-mcp-api-key"
              className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-base md:text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Header name
            <input
              value={apiKeyHeader}
              onChange={(event) => onApiKeyHeaderChange?.(event.target.value)}
              aria-label="MCP API key header name"
              data-testid="assistant-mcp-api-key-header"
              className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-base md:text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Header prefix
            <input
              value={apiKeyPrefix}
              onChange={(event) => onApiKeyPrefixChange?.(event.target.value)}
              aria-label="MCP API key header prefix"
              placeholder="Optional, e.g. Bearer"
              data-testid="assistant-mcp-api-key-prefix"
              className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-base md:text-sm"
            />
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      {!connected && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => onConnect(request.endpointUrl)}
            disabled={busy || (apiKeyRequired && !apiKey.trim())}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            data-testid="button-connect-assistant-mcp"
          >
            {busy ? "Connecting…" : apiKeyRequired ? "Retry connection" : "Connect"}
          </button>
        </div>
      )}
    </section>
  );
}
