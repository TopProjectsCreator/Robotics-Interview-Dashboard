import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AssistantModelPicker } from "./AssistantModelPicker";
import {
  ALL_ASSISTANT_TOOL_NAMES,
  ASSISTANT_TOOL_GROUPS,
  ASSISTANT_TOOLS_STORAGE_KEY,
} from "./assistantTools";

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(ui, {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });
}

describe("AssistantModelPicker", () => {
  it("shows the recurring task alarm shortcut when requested", () => {
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        showRecurringTasks
      />,
    );

    expect(screen.getByRole("link", { name: "Recurring tasks" }))
      .toHaveAttribute("href", "/assistant/scheduled-tasks");
  });

  it("lets coordinators edit and save the team model policy", async () => {
    const onSaveModelPolicy = vi.fn();
    renderWithQuery(
      <AssistantModelPicker
        model="text-model"
        models={[{ id: "text-model", name: "Text model" }]}
        catalogModels={[
          { id: "text-model", name: "Text model" },
          { id: "vision-model", name: "Vision model", inputModalities: ["text", "image"] },
        ]}
        modelPolicy={{
          defaultModel: "text-model",
          locked: false,
          listMode: null,
          modelIds: [],
          availableModelIds: ["text-model", "vision-model"],
        }}
        loading={false}
        error={false}
        canManageAssistantPolicy
        onChange={vi.fn()}
        onSaveModelPolicy={onSaveModelPolicy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    fireEvent.change(await screen.findByLabelText("Team default model"), { target: { value: "vision-model" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Lock model choice to this default" }));
    fireEvent.change(screen.getByLabelText("Model restriction mode"), { target: { value: "allow" } });
    fireEvent.change(screen.getByLabelText("Restricted model IDs"), { target: { value: "vision-model" } });
    fireEvent.click(screen.getByTestId("assistant-policy-save"));

    expect(onSaveModelPolicy).toHaveBeenCalledWith({
      defaultModel: "vision-model",
      locked: true,
      listMode: "allow",
      modelIds: ["vision-model"],
    });
  });

  it("does not expose admin policy controls to members and disables locked model selection", () => {
    renderWithQuery(
      <AssistantModelPicker
        model="text-model"
        models={[{ id: "text-model", name: "Text model" }]}
        loading={false}
        error={false}
        modelLocked
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Assistant model" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    expect(screen.queryByTestId("assistant-model-policy")).not.toBeInTheDocument();
  });

  it("shows the provider catalog name for the selected MiniMax default", () => {
    renderWithQuery(
      <AssistantModelPicker
        model="minimax/minimax-m3.1-flash:free"
        models={[{
          id: "minimax/minimax-m3.1-flash:free",
          name: "MiniMax: MiniMax M3.1 Flash (free)",
        }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Assistant model" }))
      .toHaveTextContent("MiniMax: MiniMax M3.1 Flash (free)");
  });

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
    expect(screen.getByTestId("assistant-tools-count")).toHaveTextContent(`${ALL_ASSISTANT_TOOL_NAMES.length} of ${ALL_ASSISTANT_TOOL_NAMES.length} enabled`);
    expect(screen.getByTestId("toggle-assistant-skills")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("checkbox", { name: "Web search tool" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Generate image tool" })).toBeChecked();
  });

  it("shows only private MCP connection controls to non-coordinators", async () => {
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        canManageAssistantTools={false}
        onConnectOnshape={vi.fn()}
        onDisconnectOnshape={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    expect(await screen.findByText("Your assistant connections")).toBeInTheDocument();
    expect(screen.getByText("Only you can use these connections. Provider credentials are not shared with your team.")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-onshape-setting")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-custom-mcp-setting")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Web search tool" })).not.toBeInTheDocument();
    expect(screen.queryByText("Enable all")).not.toBeInTheDocument();
    expect(screen.queryByText("Assistant skills")).not.toBeInTheDocument();
  });

  it("collapses expanded team skills and still applies a tool selection", async () => {
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    const skillsToggle = await screen.findByTestId("toggle-assistant-skills");
    fireEvent.click(skillsToggle);
    expect(skillsToggle).toHaveAttribute("aria-expanded", "true");

    const webSearchTool = screen.getByRole("checkbox", { name: "Web search tool" });
    fireEvent.click(webSearchTool);

    expect(skillsToggle).toHaveAttribute("aria-expanded", "false");
    expect(webSearchTool).not.toBeChecked();
    expect(screen.getByTestId("assistant-tools-count")).toHaveTextContent("81 of 82 enabled");
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

  it("covers the complete static assistant tool catalog, including image and workspace actions", () => {
    expect(ALL_ASSISTANT_TOOL_NAMES).toHaveLength(82);
    expect(new Set(ALL_ASSISTANT_TOOL_NAMES).size).toBe(ALL_ASSISTANT_TOOL_NAMES.length);
    const names = new Set(ALL_ASSISTANT_TOOL_NAMES);
    for (const name of [
      "generate_image",
      "create_chat_mini_tool",
      "get_parts_inventory_details",
      "update_parts_inventory_details",
      "list_team_chat_messages",
      "list_team_chat_channels",
      "create_scheduled_assistant_task",
      "activate_scheduled_assistant_task",
      "list_scheduled_assistant_tasks",
      "update_scheduled_assistant_task",
      "pause_scheduled_assistant_task",
      "resume_scheduled_assistant_task",
      "cancel_scheduled_assistant_task",
      "read_team_chat_channel_history",
      "create_team_chat_channel",
      "ask_user",
      "create_custom_workspace",
      "list_custom_workspaces",
      "delete_custom_workspace",
      "list_code_project_files",
      "write_code_file",
    ]) {
      expect(names.has(name), `${name} should have an individual setting`).toBe(true);
    }
    expect(ASSISTANT_TOOL_GROUPS.find((group) => group.id === "search")?.tools
      .find((tool) => tool.name === "generate_image")?.label).toBe("Generate image");
  });

  it("persists an individual checkbox change in local storage", async () => {
    window.localStorage.removeItem(ASSISTANT_TOOLS_STORAGE_KEY);
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Generate image tool" }));
    expect(window.localStorage.getItem(ASSISTANT_TOOLS_STORAGE_KEY)).toBe('["generate_image"]');
  });

  it("shows connected MCP tools as individual controls and retains disabled selections", async () => {
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
        dynamicTools={[
          { name: "onshape_getDocument", label: "Onshape: Get Document", hint: "Read document", write: true },
          { name: "custom_mcp_write_file", label: "Custom MCP: Write File", hint: "Write file", write: true },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    expect(await screen.findByTestId("assistant-dynamic-tools")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-tools-count")).toHaveTextContent("84 of 84 enabled");
    fireEvent.click(screen.getByRole("checkbox", { name: "Onshape: Get Document tool" }));
    expect(onDisabledToolsChange).toHaveBeenCalledWith(["onshape_getDocument"]);
    fireEvent.click(screen.getByRole("button", { name: "Read-only" }));
    expect(onDisabledToolsChange.mock.lastCall?.[0]).toContain("onshape_getDocument");
    expect(onDisabledToolsChange.mock.lastCall?.[0]).toContain("custom_mcp_write_file");
  });

  it("persists a disabled dynamic MCP tool so subsequent assistant requests can carry it", async () => {
    window.localStorage.removeItem(ASSISTANT_TOOLS_STORAGE_KEY);
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        dynamicTools={[
          { name: "custom_mcp_write_file", label: "Custom MCP: Write File", hint: "Write file", write: true },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Custom MCP: Write File tool" }));
    expect(window.localStorage.getItem(ASSISTANT_TOOLS_STORAGE_KEY)).toBe('["custom_mcp_write_file"]');
    window.localStorage.removeItem(ASSISTANT_TOOLS_STORAGE_KEY);
  });

  it("lets coordinators disable linked repository reading", async () => {
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
    fireEvent.click(await screen.findByRole("checkbox", { name: "Linked skill repository tool" }));
    expect(onDisabledToolsChange).toHaveBeenCalledWith(["search_skill_repository"]);
  });

  it("lets coordinators disable assistant MCP connection requests", async () => {
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
    fireEvent.click(await screen.findByRole("checkbox", { name: "Request MCP connection tool" }));
    expect(onDisabledToolsChange).toHaveBeenCalledWith(["request_custom_mcp_connection"]);
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

  it("shows each connected custom MCP server and disconnects only the selected one", async () => {
    const onDisconnectCustomMcp = vi.fn();
    renderWithQuery(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
        customMcpConnections={[
          { id: "server-one", endpointUrl: "https://one.example/mcp" },
          { id: "server-two", endpointUrl: "https://two.example/mcp" },
        ]}
        onDisconnectCustomMcp={onDisconnectCustomMcp}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Assistant settings" }));
    expect(await screen.findByText("2 connected")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-custom-mcp-connection-server-one")).toHaveTextContent("https://one.example/mcp");
    expect(screen.getByTestId("assistant-custom-mcp-connection-server-two")).toHaveTextContent("https://two.example/mcp");
    fireEvent.click(screen.getByTestId("assistant-custom-mcp-disconnect-server-two"));
    expect(onDisconnectCustomMcp).toHaveBeenCalledWith("server-two");
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
    expect(gear).toHaveAttribute("title", expect.stringContaining("81 of 82 tools enabled"));

    fireEvent.click(gear);
    expect(await screen.findByTestId("assistant-tools-count")).toHaveTextContent("81 of 82 enabled");
    expect(screen.getByRole("checkbox", { name: "Web search tool" })).not.toBeChecked();

    const skillsToggle = screen.getByTestId("toggle-assistant-skills");
    fireEvent.click(skillsToggle);
    expect(skillsToggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Enable all" }));
    expect(skillsToggle).toHaveAttribute("aria-expanded", "false");
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