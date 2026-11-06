import { useEffect, useMemo, useRef, useState } from "react";
import {
  getGetAssistantProviderConfigurationQueryKey,
  getListAssistantProviderCatalogQueryKey,
  getSearchModelsByProviderQueryKey,
  useGetAssistantProviderConfiguration,
  useListAssistantProviderCatalog,
  useRemoveAssistantProviderConfiguration,
  useSaveAssistantProviderConfiguration,
  useSearchModelsByProvider,
  useValidateAssistantProviderConfiguration,
} from "@workspace/api-client-react";
import type {
  AssistantProviderCatalogItem,
  AssistantProviderModelCatalogItem,
  AssistantProviderConfigurationInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import "./AssistantProviderSetup.css";

type AssistantProviderSetupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onConfigurationChanged?: () => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function formatContextLength(value?: number | null) {
  if (!value) return "Context not listed";
  return `${new Intl.NumberFormat().format(value)} token context`;
}

export function AssistantProviderSetup({
  open,
  onOpenChange,
  teamId,
  onConfigurationChanged,
}: AssistantProviderSetupProps) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [providerId, setProviderId] = useState("");
  const [selectedProviderRecord, setSelectedProviderRecord] = useState<AssistantProviderCatalogItem | null>(null);
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connection, setConnection] = useState<{ state: "idle" | "success" | "error"; message: string }>({
    state: "idle",
    message: "",
  });
  const [actionError, setActionError] = useState("");

  const catalogQueryParams = useMemo(() => ({
    ...(providerSearch.trim() ? { search: providerSearch.trim() } : {}),
  }), [providerSearch]);
  const modelQueryParams = useMemo(() => ({
    ...(modelSearch.trim() ? { search: modelSearch.trim() } : {}),
  }), [modelSearch]);
  const catalogQuery = useListAssistantProviderCatalog(catalogQueryParams, {
    query: { enabled: open, queryKey: getListAssistantProviderCatalogQueryKey(catalogQueryParams) },
  });
  const statusQuery = useGetAssistantProviderConfiguration({
    query: { enabled: open, queryKey: [...getGetAssistantProviderConfigurationQueryKey(), teamId] },
  });
  const modelQuery = useSearchModelsByProvider(providerId, modelQueryParams, {
    query: {
      enabled: open && Boolean(providerId),
      queryKey: getSearchModelsByProviderQueryKey(providerId, modelQueryParams),
    },
  });
  const validateMutation = useValidateAssistantProviderConfiguration();
  const saveMutation = useSaveAssistantProviderConfiguration();
  const removeMutation = useRemoveAssistantProviderConfiguration();

  const providers = catalogQuery.data?.items ?? [];
  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? selectedProviderRecord;
  const models = modelQuery.data?.items ?? [];
  const selectedModel: AssistantProviderModelCatalogItem | undefined = models.find((model) => model.id === modelId);
  const isCompatible = selectedProvider?.protocol === "openai-compatible";
  const configured = statusQuery.data?.configured === true;
  const busy = validateMutation.isPending || saveMutation.isPending || removeMutation.isPending;

  useEffect(() => {
    setProviderId("");
    setSelectedProviderRecord(null);
    setModelId("");
    setModelSearch("");
    setEndpointUrl("");
    setApiKey("");
    setConnection({ state: "idle", message: "" });
    setActionError("");
  }, [teamId]);

  useEffect(() => {
    if (!open) {
      setApiKey("");
      setShowKey(false);
      validateMutation.reset();
      saveMutation.reset();
      return;
    }
    priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      );
      const focusable = Array.from(items).filter((item) => item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) return;
    priorFocusRef.current?.focus();
  }, [open]);

  const resetConnection = () => {
    setConnection({ state: "idle", message: "" });
    setActionError("");
  };

  useEffect(() => {
    const status = statusQuery.data;
    if (!open || !status?.configured || !status.providerId || providerId) return;
    const provider = providers.find((item) => item.id === status.providerId);
    setProviderId(status.providerId);
    if (provider) setSelectedProviderRecord(provider);
    setModelId(status.modelId ?? "");
    setEndpointUrl(status.endpointUrl ?? "");
  }, [open, statusQuery.data, providers, providerId]);

  const selectProvider = (provider: AssistantProviderCatalogItem) => {
    if (providerId === provider.id) return;
    setProviderId(provider.id);
    setSelectedProviderRecord(provider);
    setModelId("");
    setModelSearch("");
    setEndpointUrl("");
    resetConnection();
  };

  const buildInput = (): AssistantProviderConfigurationInput | null => {
    const trimmedKey = apiKey.trim();
    const trimmedModel = modelId.trim();
    const endpoint = endpointUrl.trim();
    if (!providerId) {
      setActionError("Choose a provider before continuing.");
      return null;
    }
    if (!trimmedModel) {
      setActionError("Enter or select a model ID.");
      return null;
    }
    if (!trimmedKey) {
      setActionError("Enter the provider API key to test or save this connection.");
      return null;
    }
    if (isCompatible && !endpoint) {
      setActionError("An API endpoint is required for a compatible provider.");
      return null;
    }
    if (isCompatible && !/^https:\/\//i.test(endpoint)) {
      setActionError("Enter a full public endpoint URL beginning with https://.");
      return null;
    }
    setActionError("");
    return {
      providerId,
      modelId: trimmedModel,
      apiKey: trimmedKey,
      ...(endpoint ? { endpointUrl: endpoint } : {}),
    };
  };

  const testConnection = () => {
    const input = buildInput();
    if (!input) return;
    setConnection({ state: "idle", message: "Checking the provider connection…" });
    validateMutation.mutate({ data: input }, {
      onSuccess: (result) => setConnection({
        state: result.valid ? "success" : "error",
        message: result.message,
      }),
      onSettled: () => validateMutation.reset(),
      onError: (error) => setConnection({
        state: "error",
        message: getErrorMessage(error, "Connection test failed. Check the endpoint and key, then retry."),
      }),
    });
  };

  const saveConfiguration = () => {
    const input = buildInput();
    if (!input) return;
    saveMutation.mutate({ data: input }, {
      onSuccess: async () => {
        setApiKey("");
        setShowKey(false);
        setConnection({ state: "success", message: "Provider configuration saved for the team." });
        await queryClient.invalidateQueries({ queryKey: [...getGetAssistantProviderConfigurationQueryKey(), teamId] });
        onConfigurationChanged?.();
        saveMutation.reset();
      },
      onError: (error) => {
        setActionError(getErrorMessage(error, "Could not save this configuration. Your key is still available to retry."));
        saveMutation.reset();
      },
    });
  };

  const removeConfiguration = () => {
    if (!window.confirm("Remove the team's AI provider configuration? Coordinators can configure it again at any time.")) return;
    setActionError("");
    removeMutation.mutate(undefined, {
      onSuccess: async () => {
        setApiKey("");
        setConnection({ state: "idle", message: "" });
        await queryClient.invalidateQueries({ queryKey: [...getGetAssistantProviderConfigurationQueryKey(), teamId] });
        onConfigurationChanged?.();
      },
      onError: (error) => setActionError(getErrorMessage(error, "Could not remove the provider. Retry when the service is available.")),
    });
  };

  const retryCatalog = () => { void catalogQuery.refetch(); };
  const retryModels = () => { void modelQuery.refetch(); };

  if (!open) return null;

  return (
    <div
      className="provider-setup-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        ref={dialogRef}
        className="provider-setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-setup-title"
        aria-describedby="provider-setup-description"
        data-testid="assistant-provider-setup-dialog"
        data-team-id={teamId}
      >
        <div className="provider-setup-topline" aria-hidden="true" />
        <header className="provider-setup-header">
          <div className="provider-setup-heading">
            <p className="provider-setup-eyebrow"><Sparkles size={13} aria-hidden="true" /> Team assistant · provider control</p>
            <h1 className="provider-setup-title" id="provider-setup-title">Connect an AI provider</h1>
            <p className="provider-setup-intro" id="provider-setup-description">
              Configure one provider for your robotics team. Credentials are tested before saving and are never shown again.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="provider-setup-close"
            aria-label="Close provider setup"
            data-testid="assistant-provider-setup-close"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="provider-setup-body">
          <aside className="provider-setup-side" aria-label="Choose an AI provider">
            <div className="provider-setup-section-head">
              <h2 className="provider-setup-section-title">Provider</h2>
              <span className="provider-setup-section-index">01 / 03</span>
            </div>
            <label className="provider-setup-field-label" htmlFor="provider-setup-provider-search">Search providers</label>
            <div className="provider-setup-search-wrap">
              <Search size={15} aria-hidden="true" />
              <input
                id="provider-setup-provider-search"
                className="provider-setup-input provider-setup-search"
                type="search"
                value={providerSearch}
                onChange={(event) => setProviderSearch(event.target.value)}
                placeholder="Name or protocol"
                autoComplete="off"
                data-testid="assistant-provider-search"
              />
            </div>
            <div className="provider-setup-provider-list" role="group" aria-label="AI providers" aria-busy={catalogQuery.isLoading}>
              {catalogQuery.isLoading ? (
                <div className="provider-setup-skeleton" aria-label="Loading providers"><span /><span /><span /></div>
              ) : catalogQuery.isError ? (
                <div className="provider-setup-empty" role="alert">
                  <div className="provider-setup-inline-error">
                    <span>{getErrorMessage(catalogQuery.error, "Provider catalog could not be loaded.")}</span>
                    <button type="button" className="provider-setup-retry" onClick={retryCatalog} data-testid="assistant-provider-catalog-retry">Retry</button>
                  </div>
                </div>
              ) : providers.length ? providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  aria-pressed={providerId === provider.id}
                  className="provider-setup-provider"
                  onClick={() => selectProvider(provider)}
                  data-testid={`assistant-provider-option-${provider.id}`}
                >
                  <span className="provider-setup-provider-name">{provider.name}</span>
                  <span className="provider-setup-provider-count">{provider.modelCount} models</span>
                  <span className="provider-setup-provider-desc">{provider.description || provider.protocol}</span>
                  <span className="provider-setup-provider-protocol">{provider.protocol}</span>
                </button>
              )) : (
                <div className="provider-setup-empty" role="status">No providers match this search.</div>
              )}
            </div>
            <p className="provider-setup-side-note">
              Provider access applies to the whole team. Choose a listed provider, or use the compatible option for your own OpenAI-style endpoint.
            </p>
          </aside>
          <main className="provider-setup-main">
            {configured && (
              <section className="provider-setup-status" aria-label="Current provider status" data-testid="assistant-provider-configured-status">
                <span className="provider-setup-status-icon"><CheckCircle2 size={17} aria-hidden="true" /></span>
                <div className="provider-setup-status-copy">
                  <strong>Team provider is configured</strong>
                  <p>
                    {statusQuery.data?.providerName || "Provider"} · <code>{statusQuery.data?.modelId}</code>
                    {statusQuery.data?.updatedAt && <> · updated {new Date(statusQuery.data.updatedAt).toLocaleDateString()}</>}
                  </p>
                  <p>Only safe connection details are displayed here. The saved credential is not retrievable.</p>
                </div>
              </section>
            )}
            {statusQuery.isLoading && (
              <div className="provider-setup-loading" role="status" data-testid="assistant-provider-status-loading">Checking team configuration…</div>
            )}
            {statusQuery.isError && (
              <div className="provider-setup-inline-error" role="alert" data-testid="assistant-provider-status-error">
                <span>{getErrorMessage(statusQuery.error, "Could not load saved provider status.")}</span>
                <button type="button" className="provider-setup-retry" onClick={() => void statusQuery.refetch()} data-testid="assistant-provider-status-retry">Retry</button>
              </div>
            )}
            <div className="provider-setup-section-head">
              <h2 className="provider-setup-section-title">Choose a model</h2>
              <span className="provider-setup-section-index">02 / 03</span>
            </div>
            {!selectedProvider ? (
              <div className="provider-setup-card" role="status" data-testid="assistant-provider-select-prompt">
                <div className="provider-setup-empty">Select a provider to browse its available models.</div>
              </div>
            ) : (
              <section className="provider-setup-card" aria-label={`${selectedProvider.name} models`} data-testid="assistant-provider-model-section">
                <div className="provider-setup-selected-summary">
                  <div>
                    <strong>{selectedProvider.name}</strong>
                    <span>{selectedProvider.protocol}</span>
                  </div>
                  <span className="provider-setup-badge">{selectedProvider.modelCount} listed</span>
                </div>
                <label className="provider-setup-field-label" htmlFor="provider-setup-model-search">
                  {isCompatible ? "Search listed models" : "Search models"}
                </label>
                <div className="provider-setup-search-wrap provider-setup-model-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    id="provider-setup-model-search"
                    className="provider-setup-input provider-setup-search"
                    type="search"
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder="Model name or exact ID"
                    autoComplete="off"
                    data-testid="assistant-provider-model-search"
                  />
                </div>
                {isCompatible ? (
                  <p className="provider-setup-model-hint">You can use a listed model below or enter an exact model ID from your compatible API.</p>
                ) : null}
                {modelQuery.isLoading ? (
                  <div className="provider-setup-model-list" aria-busy="true" aria-label="Loading models">
                    <div className="provider-setup-skeleton"><span /><span /><span /></div>
                  </div>
                ) : modelQuery.isError ? (
                  <div className="provider-setup-inline-error" role="alert" data-testid="assistant-provider-model-error">
                    <span>{getErrorMessage(modelQuery.error, "Model catalog could not be loaded.")}</span>
                    <button type="button" className="provider-setup-retry" onClick={retryModels} data-testid="assistant-provider-model-retry">Retry</button>
                  </div>
                ) : (
                  <div className="provider-setup-model-list" role="group" aria-label={`${selectedProvider.name} models`} aria-busy={modelQuery.isFetching}>
                    {models.length ? models.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        aria-pressed={modelId === model.id}
                        className="provider-setup-model-option"
                        onClick={() => { setModelId(model.id); resetConnection(); }}
                        data-testid={`assistant-provider-model-option-${model.id}`}
                      >
                        <span className="provider-setup-model-name">{model.name}</span>
                        <span className="provider-setup-model-id">{model.id}</span>
                        {model.description && <span className="provider-setup-model-desc">{model.description}</span>}
                      </button>
                    )) : (
                      <div className="provider-setup-empty" role="status">No models found. Try another search.</div>
                    )}
                  </div>
                )}
                {isCompatible && (
                  <div className="provider-setup-model-manual">
                    <label className="provider-setup-field-label" htmlFor="provider-setup-model-id">
                      Exact model ID <span className="provider-setup-required">Required</span>
                    </label>
                    <input
                      id="provider-setup-model-id"
                      className="provider-setup-input"
                      value={modelId}
                      onChange={(event) => { setModelId(event.target.value); resetConnection(); }}
                      placeholder="vendor/model-name"
                      autoComplete="off"
                      spellCheck={false}
                      data-testid="assistant-provider-model-id"
                    />
                    <p className="provider-setup-model-hint">Enter the ID exactly as your endpoint expects it; no model ID is substituted automatically.</p>
                  </div>
                )}
                {selectedModel && (
                  <div className="provider-setup-details" aria-label="Selected model capabilities" data-testid="assistant-provider-model-capabilities">
                    <span className="provider-setup-capability">{formatContextLength(selectedModel.contextLength)}</span>
                    {selectedModel.inputModalities.map((modality) => (
                      <span className="provider-setup-capability" key={`in-${modality}`}>Input: {modality}</span>
                    ))}
                    {selectedModel.outputModalities.map((modality) => (
                      <span className="provider-setup-capability" key={`out-${modality}`}>Output: {modality}</span>
                    ))}
                    <span className={`provider-setup-capability${selectedModel.toolCalling ? " is-on" : ""}`}>
                      {selectedModel.toolCalling ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />} Tool calling
                    </span>
                    <span className={`provider-setup-capability${selectedModel.reasoning ? " is-on" : ""}`}>
                      {selectedModel.reasoning ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />} Reasoning
                    </span>
                  </div>
                )}
                {modelId && !isCompatible && !selectedModel && (
                  <div className="provider-setup-details" role="status" data-testid="assistant-provider-model-selected-id">
                    <span className="provider-setup-capability">Selected exact ID: {modelId}</span>
                  </div>
                )}
              </section>
            )}
            <div className="provider-setup-section-head">
              <h2 className="provider-setup-section-title">Credentials and endpoint</h2>
              <span className="provider-setup-section-index">03 / 03</span>
            </div>
            <section className="provider-setup-card" aria-label="Provider credentials">
              {selectedProvider && (
                <div className="provider-setup-selected-summary">
                  <div>
                    <strong>{selectedProvider.name}</strong>
                    <span>{modelId || "No model selected"}</span>
                  </div>
                  <span className="provider-setup-badge">Team scope</span>
                </div>
              )}
              {isCompatible && (
                <div style={{ marginBottom: 13 }}>
                  <label className="provider-setup-field-label" htmlFor="provider-setup-endpoint">
                    API endpoint <span className="provider-setup-required">Required</span>
                  </label>
                  <input
                    id="provider-setup-endpoint"
                    className="provider-setup-input"
                    type="url"
                    value={endpointUrl}
                    onChange={(event) => { setEndpointUrl(event.target.value); resetConnection(); }}
                    placeholder="https://api.example.com/v1"
                    autoComplete="url"
                    spellCheck={false}
                    data-testid="assistant-provider-endpoint"
                  />
                  <p className="provider-setup-hint">Use the base API URL for your OpenAI-compatible service.</p>
                </div>
              )}
              <label className="provider-setup-field-label" htmlFor="provider-setup-api-key">
                {configured ? "Replacement API key" : "API key"} <span className="provider-setup-required">Required to test or save</span>
              </label>
              <div className="provider-setup-key-row">
                <input
                  id="provider-setup-api-key"
                  className="provider-setup-input"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => { setApiKey(event.target.value); resetConnection(); }}
                  autoComplete="new-password"
                  spellCheck={false}
                  placeholder={configured ? "Enter a new key to replace the saved one" : "Paste provider API key"}
                  data-testid="assistant-provider-api-key"
                />
                <button
                  type="button"
                  className="provider-setup-visibility"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  aria-pressed={showKey}
                  onClick={() => setShowKey((current) => !current)}
                  data-testid="assistant-provider-api-key-visibility"
                >
                  {showKey ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="provider-setup-hint">The key stays in this open form only. It is never included in a URL, browser storage, or the saved status response.</p>
              {connection.state !== "idle" && (
                <div
                  className="provider-setup-connection"
                  role={connection.state === "error" ? "alert" : "status"}
                  aria-live="polite"
                  data-state={connection.state}
                  data-testid="assistant-provider-connection-status"
                >
                  {connection.state === "success" ? <CheckCircle2 size={16} aria-hidden="true" /> :
                    connection.state === "error" ? <AlertCircle size={16} aria-hidden="true" /> :
                      <LoaderCircle size={16} aria-hidden="true" />}
                  <span className="provider-setup-connection-copy">
                    <strong>{connection.state === "success" ? "Connection verified" : connection.state === "error" ? "Connection needs attention" : "Testing connection"}</strong>
                    {connection.message}
                  </span>
                </div>
              )}
              {actionError && <div className="provider-setup-inline-error" role="alert" data-testid="assistant-provider-action-error">{actionError}</div>}
            </section>
            <p className="provider-setup-divider-label">Credential handling</p>
            <div className="provider-setup-status" data-testid="assistant-provider-security-note">
              <span className="provider-setup-status-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
              <div className="provider-setup-status-copy">
                <strong>Private by design</strong>
                <p><LockKeyhole size={11} aria-hidden="true" /> Credentials are encrypted by the service and are not returned to this dashboard.</p>
                <p><CircleHelp size={11} aria-hidden="true" /> Test first to confirm this team can reach the selected model.</p>
              </div>
            </div>
          </main>
        </div>
        <footer className="provider-setup-footer">
          <div className="provider-setup-footnote" role="note" data-testid="assistant-provider-team-scope">
            <KeyRound size={14} aria-hidden="true" />
            <span>Shared with your team. Only safe provider status is retained in this view.</span>
          </div>
          <div className="provider-setup-actions">
            {configured && (
              <button
                type="button"
                className="provider-setup-button provider-setup-button-danger"
                onClick={removeConfiguration}
                disabled={busy}
                data-testid="assistant-provider-remove"
              >
                {removeMutation.isPending ? <LoaderCircle size={14} className="provider-setup-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                {removeMutation.isPending ? "Removing…" : "Remove provider"}
              </button>
            )}
            <button
              type="button"
              className="provider-setup-button"
              onClick={testConnection}
              disabled={busy || !providerId || !modelId.trim() || !apiKey.trim() || (isCompatible && !endpointUrl.trim())}
              data-testid="assistant-provider-test"
            >
              {validateMutation.isPending ? <LoaderCircle size={14} aria-hidden="true" /> : <Zap size={14} aria-hidden="true" />}
              {validateMutation.isPending ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              className="provider-setup-button provider-setup-button-primary"
              onClick={saveConfiguration}
              disabled={busy || !providerId || !modelId.trim() || !apiKey.trim() || (isCompatible && !endpointUrl.trim())}
              data-testid="assistant-provider-save"
            >
              {saveMutation.isPending ? <LoaderCircle size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
              {saveMutation.isPending ? "Saving…" : configured ? "Replace configuration" : "Save for team"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default AssistantProviderSetup;
