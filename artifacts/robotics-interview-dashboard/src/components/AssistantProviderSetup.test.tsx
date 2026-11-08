import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
  const providers = [
    {
      id: "anthropic",
      name: "Anthropic",
      protocol: "anthropic-messages",
      description: "Messages API",
      modelCount: 1,
    },
    {
      id: "openai",
      name: "OpenAI",
      protocol: "openai-chat-completions",
      description: "Chat Completions",
      modelCount: 1,
    },
    {
      id: "custom-openai-compatible",
      name: "Custom OpenAI-compatible endpoint",
      protocol: "openai-compatible",
      description: "Bring a compatible endpoint",
      modelCount: 0,
    },
  ];
  const models = [{
    id: "claude-demo",
    name: "Claude Demo",
    description: "Multimodal assistant",
    contextLength: 128000,
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    toolCalling: true,
    reasoning: true,
  }];
  const validate = vi.fn((_input, callbacks) => callbacks?.onSuccess?.({ valid: true, message: "Connection verified." }));
  const save = vi.fn((_input, callbacks) => callbacks?.onSuccess?.({
    configured: true,
    providerId: "anthropic",
    providerName: "Anthropic",
    modelId: "claude-demo",
    protocol: "anthropic-messages",
    endpointUrl: null,
    updatedAt: "2026-11-06T00:00:00.000Z",
  }));
  const remove = vi.fn((_input, callbacks) => callbacks?.onSuccess?.());
  return {
    providers,
    models,
    validate,
    save,
    remove,
    useListAssistantProviderCatalog: vi.fn((params) => ({
      data: {
        items: providers.filter((item) => !params?.search ||
          `${item.name} ${item.protocol} ${item.id}`.toLowerCase().includes(params.search.toLowerCase())),
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })),
    useGetAssistantProviderConfiguration: vi.fn(() => ({
      data: {
        configured: false,
        providerId: null,
        providerName: null,
        modelId: null,
        protocol: null,
        endpointUrl: null,
        updatedAt: null,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })),
    useSearchModelsByProvider: vi.fn((providerId, params) => ({
      data: {
        items: providerId === "anthropic"
          ? models.filter((item) => !params?.search ||
            `${item.name} ${item.id}`.toLowerCase().includes(params.search.toLowerCase()))
          : [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })),
  };
});

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getGetAssistantProviderConfigurationQueryKey: () => ["/api/assistant/provider-config"],
  getListAssistantProviderCatalogQueryKey: (params?: unknown) => ["/api/assistant/providers", params],
  getSearchModelsByProviderQueryKey: (providerId: string, params?: unknown) => [`/api/assistant/providers/${providerId}/models`, params],
  useGetAssistantProviderConfiguration: api.useGetAssistantProviderConfiguration,
  useListAssistantProviderCatalog: api.useListAssistantProviderCatalog,
  useSearchModelsByProvider: api.useSearchModelsByProvider,
  useValidateAssistantProviderConfiguration: () => ({ mutate: api.validate, isPending: false, reset: vi.fn() }),
  useSaveAssistantProviderConfiguration: () => ({ mutate: api.save, isPending: false, reset: vi.fn() }),
  useRemoveAssistantProviderConfiguration: () => ({ mutate: api.remove, isPending: false, reset: vi.fn() }),
}));

import { AIProviderSettingsCategory } from "../App";
import { AssistantProviderSetup } from "./AssistantProviderSetup";

function ProviderSettingsFlow({ canManageProvider }: { canManageProvider: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <AIProviderSettingsCategory canManageProvider={canManageProvider} onOpenProviderSetup={() => setOpen(true)} />
    <AssistantProviderSetup open={open} onOpenChange={setOpen} teamId="team-a" />
  </>;
}

function renderSetup(open = true, onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    onOpenChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AssistantProviderSetup open={open} onOpenChange={onOpenChange} teamId="team-a" />
      </QueryClientProvider>,
    ),
  };
}

describe("AssistantProviderSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("provides a focused accessible dialog with searchable provider and model result lists", async () => {
    const { onOpenChange } = renderSetup();
    const dialog = screen.getByRole("dialog", { name: "Connect an AI provider" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("group", { name: "AI providers" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search providers" }), {
      target: { value: "anthropic" },
    });
    expect(screen.getByRole("button", { name: /Anthropic/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /OpenAI Chat Completions/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Anthropic/ }));

    fireEvent.change(screen.getByRole("searchbox", { name: "Search models" }), {
      target: { value: "claude" },
    });
    const model = await screen.findByRole("button", { name: /Claude Demo/ });
    fireEvent.click(model);
    expect(model).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("assistant-provider-model-capabilities")).toHaveTextContent("Input: image");
    expect(screen.getByTestId("assistant-provider-model-capabilities")).toHaveTextContent("Tool calling");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps keyboard focus inside and restores it to the opening control", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const previousOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get: () => document.body,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onOpenChange = vi.fn();
    const view = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <AssistantProviderSetup open={open} onOpenChange={onOpenChange} teamId="team-a" />
      </QueryClientProvider>
    );

    try {
      const { rerender } = render(view(true));
      const dialog = screen.getByRole("dialog", { name: "Connect an AI provider" });
      await waitFor(() => expect(screen.getByTestId("assistant-provider-setup-close")).toHaveFocus());
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0]!;
      const last = focusable.at(-1)!;

      first.focus();
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(first).toHaveFocus();

      rerender(view(false));
      await waitFor(() => expect(trigger).toHaveFocus());
    } finally {
      trigger.remove();
      if (previousOffsetParent) {
        Object.defineProperty(HTMLElement.prototype, "offsetParent", previousOffsetParent);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "offsetParent");
      }
    }
  });

  it("requires a key, validates and saves only the selected provider configuration", async () => {
    renderSetup();
    fireEvent.click(screen.getByRole("button", { name: /Anthropic/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Claude Demo/ }));
    const key = screen.getByTestId("assistant-provider-api-key");
    fireEvent.change(key, { target: { value: "one-time-key" } });

    fireEvent.click(screen.getByTestId("assistant-provider-test"));
    expect(api.validate).toHaveBeenCalledWith(
      { data: { providerId: "anthropic", modelId: "claude-demo", apiKey: "one-time-key" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    await waitFor(() => expect(screen.getByTestId("assistant-provider-connection-status")).toHaveTextContent("Connection verified"));

    fireEvent.click(screen.getByTestId("assistant-provider-save"));
    expect(api.save).toHaveBeenCalledWith(
      { data: { providerId: "anthropic", modelId: "claude-demo", apiKey: "one-time-key" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(window.localStorage.getItem("assistant-provider-api-key")).toBeNull();
  });

  it("keeps catalog and credential entry out of the surface when it is closed", () => {
    renderSetup(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search providers")).not.toBeInTheDocument();
  });

  it.each(["light", "dark"] as const)("opens and closes the team-scoped provider setup from AI settings in %s mode", async (theme) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    document.documentElement.classList.toggle("dark", theme === "dark");

    render(
      <QueryClientProvider client={queryClient}>
        <ProviderSettingsFlow canManageProvider />
      </QueryClientProvider>,
    );

    const category = screen.getByTestId("settings-ai-provider");
    const action = screen.getByRole("button", { name: "Custom Provider" });
    expect(category).toHaveTextContent("AI");
    expect(action).toHaveClass("min-h-11", "w-full", "bg-card", "text-foreground");

    fireEvent.click(action);
    const dialog = await screen.findByRole("dialog", { name: "Connect an AI provider" });
    expect(dialog).toHaveAttribute("data-team-id", "team-a");
    fireEvent.click(screen.getByRole("button", { name: "Close provider setup" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Connect an AI provider" })).not.toBeInTheDocument());
  });

  it("does not render the AI provider action for accounts without management access", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ProviderSettingsFlow canManageProvider={false} />
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId("settings-ai-provider")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

