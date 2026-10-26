import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssistantMcpConnectionPrompt } from "./AssistantMcpConnectionPrompt";

const request = {
  type: "custom_mcp_connection" as const,
  endpointUrl: "https://tools.example/mcp",
};

describe("AssistantMcpConnectionPrompt", () => {
  it("shows the proposed destination and requires an explicit Connect action", () => {
    const onConnect = vi.fn();
    const onDismiss = vi.fn();

    render(<AssistantMcpConnectionPrompt request={request} onConnect={onConnect} onDismiss={onDismiss} />);

    expect(screen.getByTestId("assistant-mcp-connection-endpoint")).toHaveTextContent(request.endpointUrl);
    expect(screen.getByText(/Nothing is contacted unless you choose Connect/)).toBeInTheDocument();
    expect(onConnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));
    expect(onConnect).toHaveBeenCalledWith(request.endpointUrl);
  });

  it("dismisses without invoking the connect action", () => {
    const onConnect = vi.fn();
    const onDismiss = vi.fn();
    render(<AssistantMcpConnectionPrompt request={request} onConnect={onConnect} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId("button-dismiss-assistant-mcp-connection"));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("exposes the existing API-key challenge fields and a retry action", () => {
    const onConnect = vi.fn();
    const onApiKeyChange = vi.fn();
    const onApiKeyHeaderChange = vi.fn();
    const onApiKeyPrefixChange = vi.fn();
    const props = {
      request,
      onConnect,
      onDismiss: vi.fn(),
      apiKeyRequired: true,
      apiKey: "secret-value",
      apiKeyHeader: "Authorization",
      apiKeyPrefix: "Bearer",
      onApiKeyChange,
      onApiKeyHeaderChange,
      onApiKeyPrefixChange,
    };
    const { rerender } = render(<AssistantMcpConnectionPrompt {...props} />);

    expect(screen.getByLabelText("MCP API key")).toHaveValue("secret-value");
    expect(screen.getByLabelText("MCP API key header name")).toHaveValue("Authorization");
    expect(screen.getByLabelText("MCP API key header prefix")).toHaveValue("Bearer");
    fireEvent.change(screen.getByLabelText("MCP API key"), { target: { value: "new-secret" } });
    fireEvent.change(screen.getByLabelText("MCP API key header name"), { target: { value: "X-Token" } });
    fireEvent.change(screen.getByLabelText("MCP API key header prefix"), { target: { value: "Token" } });
    expect(onApiKeyChange).toHaveBeenCalledWith("new-secret");
    expect(onApiKeyHeaderChange).toHaveBeenCalledWith("X-Token");
    expect(onApiKeyPrefixChange).toHaveBeenCalledWith("Token");

    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));
    expect(onConnect).toHaveBeenCalledWith(request.endpointUrl);

    rerender(<AssistantMcpConnectionPrompt {...props} busy error="The API key was rejected." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The API key was rejected.");
    expect(screen.getByTestId("button-connect-assistant-mcp")).toBeDisabled();
  });

  it("shows a successful OAuth or API-key connection without offering another connect action", () => {
    render(<AssistantMcpConnectionPrompt request={request} connected onConnect={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText("MCP server connected")).toBeInTheDocument();
    expect(screen.queryByTestId("button-connect-assistant-mcp")).not.toBeInTheDocument();
  });
});
