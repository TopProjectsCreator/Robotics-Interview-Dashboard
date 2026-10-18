import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AssistantModelPicker } from "./AssistantModelPicker";

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(ui, {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });
}

describe("AssistantModelPicker", () => {
  it("shows provider models and reports the selected id", async () => {
    const onChange = vi.fn();
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[
          { id: "openrouter/free" },
          { id: "provider/new-model", name: "New provider model" },
        ]}
        loading={false}
        error={false}
        onChange={onChange}
      />,
    );

    const picker = screen.getByRole("combobox", { name: "Assistant model" });
    expect(picker).toHaveTextContent("openrouter/free");

    fireEvent.keyDown(picker, { key: "ArrowDown" });
    expect(await screen.findByRole("listbox")).toHaveAttribute("data-align", "start");
    fireEvent.click(await screen.findByRole("option", { name: "New provider model" }));
    expect(onChange).toHaveBeenCalledWith("provider/new-model");
  });

  it("keeps the current model visible and disables selection while loading", () => {
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[]}
        loading
        error={false}
        onChange={vi.fn()}
      />,
    );

    const picker = screen.getByRole("combobox", { name: "Assistant model" });
    expect(picker).toBeDisabled();
    expect(picker).toHaveTextContent("openrouter/free");
  });

  it("offers thinking levels only for models whose provider metadata advertises reasoning", async () => {
    const onThinkingLevelChange = vi.fn();
    const { rerender } = renderWithQuery(
      <AssistantModelPicker
        model="plain-model"
        models={[{ id: "plain-model", thinkingLevels: [] }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        onThinkingLevelChange={onThinkingLevelChange}
      />,
    );
    const thinkingPicker = screen.getByRole("combobox", { name: "Assistant thinking level" });
    expect(thinkingPicker).toBeDisabled();
    expect(thinkingPicker).toHaveAttribute("title", "This model does not expose thinking controls");

    rerender(
      <AssistantModelPicker
        model="reasoning-model"
        models={[{ id: "reasoning-model", thinkingLevels: ["low", "medium", "high"] }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        onThinkingLevelChange={onThinkingLevelChange}
      />,
    );
    const supportedPicker = screen.getByRole("combobox", { name: "Assistant thinking level" });
    expect(supportedPicker).toBeEnabled();
    fireEvent.click(supportedPicker);
    fireEvent.click(await screen.findByRole("option", { name: "Medium" }));
    expect(onThinkingLevelChange).toHaveBeenCalledWith("medium");
  });

  it("shows a gear inline with the model dropdown that opens the tools menu", async () => {
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
      />,
    );

    const picker = screen.getByRole("combobox", { name: "Assistant model" });
    const gear = screen.getByRole("button", { name: "Assistant settings" });
    // Gear sits in the same inline row as the dropdown.
    expect(gear.closest(".assistant-model-picker-row")).toContainElement(picker);
    expect(screen.getByTestId("assistant-tools-gear")).toBe(gear);

    fireEvent.click(gear);
    expect(await screen.findByText("Assistant settings")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-tools-count")).toHaveTextContent("44 of 44 enabled");
    expect(screen.getByRole("checkbox", { name: "Web search tool" })).toBeChecked();
  });

  it("reports disabled tools when a tool is toggled off", async () => {
    const onDisabledToolsChange = vi.fn();
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        disabledTools={[]}
        onDisabledToolsChange={onDisabledToolsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Web search tool" }));
    expect(onDisabledToolsChange).toHaveBeenCalledWith(["web_search"]);
  });

  it("accepts a custom MCP endpoint and starts its connection flow", async () => {
    const onConnectCustomMcp = vi.fn();
    const onCustomMcpEndpointChange = vi.fn();
    const { rerender } = renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        customMcpEndpoint=""
        onCustomMcpEndpointChange={onCustomMcpEndpointChange}
        onConnectCustomMcp={onConnectCustomMcp}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    const endpoint = await screen.findByRole("textbox", { name: "MCP endpoint URL" });
    fireEvent.change(endpoint, { target: { value: "https://tools.example/mcp" } });
    expect(onCustomMcpEndpointChange).toHaveBeenCalledWith("https://tools.example/mcp");
    rerender(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        customMcpEndpoint="https://tools.example/mcp"
        onCustomMcpEndpointChange={onCustomMcpEndpointChange}
        onConnectCustomMcp={onConnectCustomMcp}
      />,
    );
    fireEvent.click(screen.getByTestId("assistant-custom-mcp-toggle"));
    expect(onConnectCustomMcp).toHaveBeenCalledOnce();
  });

  it("shows MCP API-key fields only after the server requires an API key", async () => {
    const props = {
      model: "openrouter/free",
      models: [{ id: "openrouter/free" }],
      loading: false,
      error: false,
      onChange: vi.fn(),
      customMcpEndpoint: "https://tools.example/mcp",
      onConnectCustomMcp: vi.fn(),
    };
    const { rerender } = renderWithQuery(<AssistantModelPicker {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    expect(screen.queryByLabelText("MCP API key")).not.toBeInTheDocument();
    rerender(<AssistantModelPicker {...props} customMcpApiKeyRequired />);
    expect(screen.getByLabelText("MCP API key")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP API key header name")).toHaveValue("X-API-Key");
  });

  it("reflects controlled disabled tools with a count and read-only shortcut", async () => {
    const onDisabledToolsChange = vi.fn();
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        disabledTools={["web_search"]}
        onDisabledToolsChange={onDisabledToolsChange}
      />,
    );

    const gear = screen.getByTestId("assistant-tools-gear");
    expect(gear).toHaveAttribute("title", expect.stringContaining("43 of 44 tools enabled"));

    fireEvent.click(gear);
    expect(await screen.findByTestId("assistant-tools-count")).toHaveTextContent("43 of 44 enabled");
    expect(screen.getByRole("checkbox", { name: "Web search tool" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Enable all" }));
    expect(onDisabledToolsChange).toHaveBeenCalledWith([]);
  });

  it("shows Onshape connection controls inside assistant settings", async () => {
    const onConnectOnshape = vi.fn();
    const onDisconnectOnshape = vi.fn();
    const { rerender } = renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        onshapeConnected={false}
        onConnectOnshape={onConnectOnshape}
        onDisconnectOnshape={onDisconnectOnshape}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    expect(await screen.findByTestId("assistant-onshape-setting")).toHaveTextContent("Not connected");
    fireEvent.click(screen.getByRole("button", { name: "Connect Onshape" }));
    expect(onConnectOnshape).toHaveBeenCalledOnce();

    rerender(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        onshapeConnected
        onDisconnectOnshape={onDisconnectOnshape}
      />,
    );
    expect(screen.getByTestId("assistant-onshape-setting")).toHaveTextContent("Connected");
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Onshape" }));
    expect(onDisconnectOnshape).toHaveBeenCalledOnce();
  });
});