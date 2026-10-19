export type AssistantMcpConnectionRequest = {
  type: "custom_mcp_connection";
  endpointUrl: string;
};

export function assistantMcpConnectionRequestEnabled(input: {
  coordinator: boolean;
  partsMode: boolean;
  disabled: boolean;
  skillAllowed: boolean;
}): boolean {
  return input.coordinator && !input.partsMode && !input.disabled && input.skillAllowed;
}

export const ASSISTANT_MCP_CONNECTION_REQUEST_TOOL = {
  type: "function" as const,
  function: {
    name: "request_custom_mcp_connection",
    description: "Ask the signed-in coordinator to connect a custom MCP endpoint. This only presents a confirmation prompt; it does not contact or connect to the endpoint. Use only when the coordinator explicitly asks to connect a server.",
    parameters: {
      type: "object",
      properties: {
        endpointUrl: { type: "string", maxLength: 2048, description: "HTTPS MCP endpoint URL to show for user confirmation" },
      },
      required: ["endpointUrl"],
      additionalProperties: false,
    },
  },
};

export function parseAssistantMcpConnectionRequest(raw: string):
  | { ok: true; request: AssistantMcpConnectionRequest }
  | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: "The MCP connection request arguments were malformed." };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "The MCP connection request arguments must be an object." };
  }
  const args = value as Record<string, unknown>;
  if (Object.keys(args).length !== 1 || typeof args.endpointUrl !== "string") {
    return { ok: false, error: "Provide only one endpointUrl string." };
  }
  const endpointUrl = args.endpointUrl.trim();
  if (!endpointUrl || endpointUrl.length > 2048) {
    return { ok: false, error: "The MCP endpoint URL must be between 1 and 2048 characters." };
  }
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    return { ok: false, error: "The MCP endpoint URL is malformed." };
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    return { ok: false, error: "The MCP endpoint must use HTTPS and cannot include credentials or a fragment." };
  }
  return {
    ok: true,
    request: { type: "custom_mcp_connection", endpointUrl: parsed.toString() },
  };
}
