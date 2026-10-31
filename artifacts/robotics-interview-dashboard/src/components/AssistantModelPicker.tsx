import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Bot, Settings, Sparkles } from "lucide-react";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AssistantSkillManager } from "./AssistantSkillManager";
import {
  ALL_ASSISTANT_TOOL_NAMES,
  ASSISTANT_TOOL_GROUPS,
  WRITE_TOOL_NAMES,
  type AssistantToolItem,
  loadDisabledTools,
  normalizeDisabledTools,
  saveDisabledTools,
} from "./assistantTools";

export type AssistantModelOption = {
  id: string;
  name?: string;
  thinkingLevels?: ("low" | "medium" | "high")[];
  inputModalities?: string[];
};

export type AssistantModelPolicyView = {
  defaultModel: string;
  locked: boolean;
  listMode: "allow" | "block" | null;
  modelIds: string[];
  availableModelIds: string[];
  unavailableModelIds?: string[];
  policyError?: string;
};

export type AssistantModelPolicyHistoryEntryView = {
  id: string;
  coordinatorId: string;
  coordinatorName: string;
  previousPolicy: Omit<AssistantModelPolicyView, "availableModelIds" | "policyError">;
  newPolicy: Omit<AssistantModelPolicyView, "availableModelIds" | "policyError">;
  createdAt: string;
};

export type AssistantThinkingLevel = "auto" | "low" | "medium" | "high";
export type CustomMcpConnectionItem = { id: string; endpointUrl: string };

type AssistantModelPickerProps = {
  model: string;
  models: AssistantModelOption[];
  loading: boolean;
  error: boolean;
  onChange: (model: string) => void;
  modelLocked?: boolean;
  canManageAssistantPolicy?: boolean;
  catalogModels?: AssistantModelOption[];
  modelPolicy?: AssistantModelPolicyView;
  modelPolicyLoading?: boolean;
  modelPolicyError?: string;
  modelPolicySaving?: boolean;
  modelPolicyHistory?: AssistantModelPolicyHistoryEntryView[];
  modelPolicyHistoryLoading?: boolean;
  modelPolicyHistoryError?: string;
  onSaveModelPolicy?: (policy: Omit<AssistantModelPolicyView, "availableModelIds">) => void;
  onSettingsOpenChange?: (open: boolean) => void;
  showRecurringTasks?: boolean;
  canManageAssistantTools?: boolean;
  thinkingLevel?: AssistantThinkingLevel;
  onThinkingLevelChange?: (level: AssistantThinkingLevel) => void;
  disabledTools?: string[];
  onDisabledToolsChange?: (tools: string[]) => void;
  dynamicTools?: AssistantToolItem[];
  dynamicToolsError?: string;
  onshapeConnected?: boolean;
  onshapeBusy?: boolean;
  onshapeError?: string;
  onConnectOnshape?: () => void;
  onDisconnectOnshape?: () => void;
  customMcpEndpoint?: string;
  customMcpConnections?: CustomMcpConnectionItem[];
  customMcpConnectionsLoading?: boolean;
  customMcpApiKeyRequired?: boolean;
  customMcpApiKey?: string;
  customMcpApiKeyHeader?: string;
  customMcpApiKeyPrefix?: string;
  customMcpBusy?: boolean;
  customMcpError?: string;
  onCustomMcpEndpointChange?: (value: string) => void;
  onCustomMcpApiKeyChange?: (value: string) => void;
  onCustomMcpApiKeyHeaderChange?: (value: string) => void;
  onCustomMcpApiKeyPrefixChange?: (value: string) => void;
  onConnectCustomMcp?: () => void;
  onDisconnectCustomMcp?: (connectionId: string) => void;
};

export function AssistantModelPicker({
  model,
  models,
  loading,
  error,
  onChange,
  modelLocked = false,
  canManageAssistantPolicy = false,
  catalogModels = [],
  modelPolicy,
  modelPolicyLoading = false,
  modelPolicyError = "",
  modelPolicySaving = false,
  modelPolicyHistory = [],
  modelPolicyHistoryLoading = false,
  modelPolicyHistoryError = "",
  onSaveModelPolicy,
  onSettingsOpenChange,
  showRecurringTasks = false,
  canManageAssistantTools = true,
  thinkingLevel = "auto",
  onThinkingLevelChange,
  disabledTools: controlledDisabled,
  onDisabledToolsChange,
  dynamicTools = [],
  dynamicToolsError = "",
  onshapeConnected = false,
  onshapeBusy = false,
  onshapeError = "",
  onConnectOnshape,
  onDisconnectOnshape,
  customMcpEndpoint = "",
  customMcpConnections = [],
  customMcpConnectionsLoading = false,
  customMcpApiKeyRequired = false,
  customMcpApiKey = "",
  customMcpApiKeyHeader = "X-API-Key",
  customMcpApiKeyPrefix = "",
  customMcpBusy = false,
  customMcpError = "",
  onCustomMcpEndpointChange,
  onCustomMcpApiKeyChange,
  onCustomMcpApiKeyHeaderChange,
  onCustomMcpApiKeyPrefixChange,
  onConnectCustomMcp,
  onDisconnectCustomMcp,
}: AssistantModelPickerProps) {
  const options = models.length ? models : model ? [{ id: model }] : [];
  const [policyDefault, setPolicyDefault] = useState("");
  const [policyLocked, setPolicyLocked] = useState(false);
  const [policyMode, setPolicyMode] = useState<"none" | "allow" | "block">("none");
  const [policyIdsText, setPolicyIdsText] = useState("");
  useEffect(() => {
    if (!modelPolicy) return;
    setPolicyDefault(modelPolicy.defaultModel);
    setPolicyLocked(modelPolicy.locked);
    setPolicyMode(modelPolicy.listMode ?? "none");
    setPolicyIdsText(Array.isArray(modelPolicy.modelIds) ? modelPolicy.modelIds.join("\n") : "");
  }, [modelPolicy]);
  const policyIds = useMemo(
    () => [...new Set(policyIdsText.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean))],
    [policyIdsText],
  );
  const draftEffectiveModels = useMemo(() => catalogModels.filter((option) =>
    policyMode === "allow"
      ? policyIds.includes(option.id)
      : policyMode === "block"
        ? !policyIds.includes(option.id)
        : true,
  ), [catalogModels, policyIds, policyMode]);
  const unavailablePolicyModels = useMemo(() => {
    if (modelPolicy?.unavailableModelIds) return modelPolicy.unavailableModelIds;
    if (!modelPolicy) return [];
    const availableIds = new Set(catalogModels.map((option) => option.id));
    return [...new Set([modelPolicy.defaultModel, ...modelPolicy.modelIds])]
      .filter((modelId) => !availableIds.has(modelId));
  }, [catalogModels, modelPolicy]);
  const describePolicy = (policy: AssistantModelPolicyHistoryEntryView["previousPolicy"]) => {
    const restriction = policy.listMode === null
      ? "No model list restrictions"
      : `${policy.listMode === "allow" ? "Allow only" : "Block"}: ${policy.modelIds.join(", ")}`;
    return `Default: ${policy.defaultModel} · ${policy.locked ? "Locked" : "Unlocked"} · ${restriction}`;
  };
  const [internalDisabled, setInternalDisabled] = useState<string[]>(() => loadDisabledTools());
  const [toolsOpen, setToolsOpen] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const disabledTools = useMemo(
    () => normalizeDisabledTools(controlledDisabled ?? internalDisabled),
    [controlledDisabled, internalDisabled],
  );
  const disabledSet = useMemo(() => new Set(disabledTools), [disabledTools]);
  const dynamicToolNames = useMemo(
    () => dynamicTools.map((tool) => tool.name).filter((name) => !ALL_ASSISTANT_TOOL_NAMES.includes(name)),
    [dynamicTools],
  );
  const availableToolNames = useMemo(
    () => [...ALL_ASSISTANT_TOOL_NAMES, ...dynamicToolNames],
    [dynamicToolNames],
  );
  const disabledCount = availableToolNames.filter((name) => disabledSet.has(name)).length;
  const enabledCount = availableToolNames.length - disabledCount;
  const readOnlyDisabledTools = [...new Set([...WRITE_TOOL_NAMES, ...dynamicToolNames])];

  const updateDisabled = (next: string[]) => {
    const normalized = normalizeDisabledTools(next);
    if (onDisabledToolsChange) onDisabledToolsChange(normalized);
    else {
      setInternalDisabled(normalized);
      saveDisabledTools(normalized);
    }
  };

  const toggleTool = (name: string, checked: boolean) => {
    const next = new Set(disabledTools);
    if (checked) next.delete(name);
    else next.add(name);
    updateDisabled([...next]);
  };

  const toggleGroup = (names: string[], checked: boolean) => {
    const next = new Set(disabledTools);
    for (const name of names) {
      if (checked) next.delete(name);
      else next.add(name);
    }
    updateDisabled([...next]);
  };

  const collapseSkillsForToolInteraction = () => {
    if (skillsExpanded) setSkillsExpanded(false);
  };

  return (
    <div className="assistant-model-picker-wrap">
      <div className="assistant-model-picker-row">
        <Select
          value={options.some((option) => option.id === model) ? model : ""}
          disabled={loading || models.length === 0 || modelLocked}
          onValueChange={onChange}
        >
          <SelectTrigger
            aria-label="Assistant model"
            data-testid="assistant-model-picker"
            title={model}
            className="assistant-model-trigger"
          >
            <span className="assistant-model-trigger-label" aria-hidden="true">
              <Bot size={15} />
              <span>Model</span>
            </span>
            <SelectValue
              className="assistant-model-current"
              placeholder={loading ? "Loading…" : error ? "Unavailable" : modelLocked ? "Locked by admin" : "Choose a model"}
            />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            className="assistant-model-menu"
          >
            {options.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                className="assistant-model-option"
              >
                {option.name || option.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={thinkingLevel}
          disabled={!options.find((option) => option.id === model)?.thinkingLevels?.length}
          onValueChange={(value) => onThinkingLevelChange?.(value as AssistantThinkingLevel)}
        >
          <SelectTrigger
            aria-label="Assistant thinking level"
            data-testid="assistant-thinking-picker"
            title={options.find((option) => option.id === model)?.thinkingLevels?.length
              ? "Thinking level"
              : "This model does not expose thinking controls"}
            className="assistant-thinking-trigger"
          >
            <span className="assistant-model-trigger-label" aria-hidden="true">
              <Sparkles size={14} />
              <span>Think</span>
            </span>
            <SelectValue className="assistant-thinking-current" />
          </SelectTrigger>
          <SelectContent position="popper" align="end" className="assistant-thinking-menu">
            <SelectItem value="auto">Auto</SelectItem>
            {(options.find((option) => option.id === model)?.thinkingLevels ?? []).map((level) => (
              <SelectItem key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showRecurringTasks && (
          <Link
            href="/assistant/scheduled-tasks"
            aria-label="Recurring tasks"
            title="Recurring tasks"
            data-testid="assistant-scheduled-tasks-link"
            className="assistant-scheduled-tasks-link"
          >
            <AlarmClock size={17} aria-hidden="true" />
          </Link>
        )}
        <Popover open={toolsOpen} onOpenChange={(open) => {
          setToolsOpen(open);
          onSettingsOpenChange?.(open);
        }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Assistant settings"
              title={!canManageAssistantTools
                ? "Manage your MCP connections"
                : disabledCount ? `${enabledCount} of ${availableToolNames.length} tools enabled` : "Assistant settings"}
              data-testid="assistant-tools-gear"
              className="assistant-tools-gear"
            >
              <Settings size={15} />
              {canManageAssistantTools && disabledCount > 0 && (
                <span className="assistant-tools-gear-dot" aria-hidden="true" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="assistant-tools-popover">
            <div className="assistant-tools-head">
              <div>
                <p className="assistant-tools-title">{canManageAssistantTools ? "Assistant settings" : "Your assistant connections"}</p>
                <p className="assistant-tools-subtitle" data-testid="assistant-tools-count">
                  {canManageAssistantTools
                    ? `${enabledCount} of ${availableToolNames.length} enabled`
                    : "Private to your account"}
                </p>
              </div>
              {canManageAssistantTools && <div className="assistant-tools-head-actions" onClickCapture={collapseSkillsForToolInteraction}>
                <button
                  type="button"
                  className="assistant-tools-link"
                  onClick={() => updateDisabled([])}
                  disabled={disabledTools.length === 0}
                >
                  Enable all
                </button>
                <button
                  type="button"
                  className="assistant-tools-link"
                  onClick={() => updateDisabled(readOnlyDisabledTools)}
                  disabled={readOnlyDisabledTools.every((name) => disabledSet.has(name))}
                >
                  Read-only
                </button>
              </div>}
            </div>
            {!canManageAssistantTools && (
              <p className="assistant-tools-subtitle">Only you can use these connections. Provider credentials are not shared with your team.</p>
            )}
            {canManageAssistantPolicy && <section className="assistant-model-policy" aria-label="Team model policy" data-testid="assistant-model-policy">
              <div className="assistant-model-policy-heading">
                <div>
                  <p className="assistant-onshape-setting-title">Team model policy</p>
                  <p className="assistant-onshape-setting-status">Applies to assistant and workspace agents.</p>
                </div>
                {modelLocked && <span className="assistant-model-policy-lock">Locked</span>}
              </div>
              {modelPolicyLoading ? <p className="assistant-model-policy-note">Loading team policy…</p> : <>
                <label className="assistant-model-policy-field">
                  Default model
                  <select
                    aria-label="Team default model"
                    value={policyDefault}
                    onChange={(event) => setPolicyDefault(event.target.value)}
                    disabled={!catalogModels.length}
                    data-testid="assistant-policy-default"
                  >
                    {policyDefault && !catalogModels.some((option) => option.id === policyDefault) && (
                      <option value={policyDefault} disabled>{policyDefault} · unavailable</option>
                    )}
                    {catalogModels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name || option.id}{option.inputModalities?.includes("image") ? " · vision" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="assistant-model-policy-toggle">
                  <Checkbox checked={policyLocked} onCheckedChange={(checked) => setPolicyLocked(checked === true)} />
                  <span>Lock model choice to this default</span>
                </label>
                <label className="assistant-model-policy-field">
                  Model restrictions
                  <select
                    aria-label="Model restriction mode"
                    value={policyMode}
                    onChange={(event) => setPolicyMode(event.target.value as "none" | "allow" | "block")}
                    data-testid="assistant-policy-list-mode"
                  >
                    <option value="none">No list restriction</option>
                    <option value="allow">Allow only listed models</option>
                    <option value="block">Block listed models</option>
                  </select>
                </label>
                {policyMode !== "none" && <label className="assistant-model-policy-field">
                  Exact model IDs, one per line
                  <textarea
                    aria-label="Restricted model IDs"
                    value={policyIdsText}
                    onChange={(event) => setPolicyIdsText(event.target.value)}
                    rows={3}
                    maxLength={25_599}
                    placeholder="provider/model-id"
                    data-testid="assistant-policy-model-ids"
                  />
                </label>}
                <p className="assistant-model-policy-note">
                  Effective choices: {draftEffectiveModels.length}
                  {draftEffectiveModels.length > 0 && ` · ${draftEffectiveModels.slice(0, 4).map((option) => option.name || option.id).join(", ")}${draftEffectiveModels.length > 4 ? ", …" : ""}`}
                </p>
                {unavailablePolicyModels.length > 0 && (
                  <p role="alert" className="assistant-model-policy-warning" data-testid="assistant-policy-unavailable-models">
                    The saved policy references unavailable model IDs: {unavailablePolicyModels.join(", ")}.
                    Select an available default if needed and remove or replace unavailable restriction IDs, then save the policy.
                    No model has been substituted automatically.
                  </p>
                )}
                {modelPolicyError && <p role="alert" className="assistant-model-policy-error">{modelPolicyError}</p>}
                <button
                  type="button"
                  className="assistant-onshape-setting-action"
                  onClick={() => onSaveModelPolicy?.({
                    defaultModel: policyDefault,
                    locked: policyLocked,
                    listMode: policyMode === "none" ? null : policyMode,
                    modelIds: policyMode === "none" ? [] : policyIds,
                  })}
                  disabled={modelPolicySaving || !policyDefault || (policyMode !== "none" && policyIds.length === 0)}
                  data-testid="assistant-policy-save"
                >
                  {modelPolicySaving ? "Saving…" : "Save team policy"}
                </button>
              </>}
            </section>}
            {canManageAssistantPolicy && <section className="assistant-model-policy-history" aria-label="Team model policy history" data-testid="assistant-model-policy-history">
              <div className="assistant-model-policy-heading">
                <p className="assistant-onshape-setting-title">Policy change history</p>
                <span className="assistant-model-policy-note">Read-only · latest 50</span>
              </div>
              {modelPolicyHistoryLoading
                ? <p className="assistant-model-policy-note" role="status">Loading policy history…</p>
                : modelPolicyHistoryError
                  ? <p className="assistant-model-policy-error" role="alert">{modelPolicyHistoryError}</p>
                  : modelPolicyHistory.length === 0
                    ? <p className="assistant-model-policy-note">No policy changes recorded yet.</p>
                    : <ol className="assistant-model-policy-history-list">
                      {modelPolicyHistory.map((entry) => (
                        <li key={entry.id} data-testid={`assistant-policy-history-item-${entry.id}`}>
                          <div className="assistant-model-policy-history-meta">
                            <strong>{entry.coordinatorName}</strong>
                            <span title={`Coordinator ID: ${entry.coordinatorId}`}>{entry.coordinatorId}</span>
                            <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                          </div>
                          <p><strong>Before:</strong> {describePolicy(entry.previousPolicy)}</p>
                          <p><strong>After:</strong> {describePolicy(entry.newPolicy)}</p>
                        </li>
                      ))}
                    </ol>}
            </section>}
            {(onConnectOnshape || onDisconnectOnshape) && (
              <section className="assistant-onshape-setting" aria-label="Onshape connection" data-testid="assistant-onshape-setting">
                <div className="assistant-onshape-setting-copy">
                  <p className="assistant-onshape-setting-title">Onshape connection</p>
                  <p className="assistant-onshape-setting-status" role="status">
                    {onshapeBusy
                      ? onshapeConnected ? "Disconnecting…" : "Connecting…"
                      : onshapeConnected ? "Connected" : "Not connected"}
                  </p>
                </div>
                <button
                  type="button"
                  className="assistant-onshape-setting-action"
                  onClick={onshapeConnected ? onDisconnectOnshape : onConnectOnshape}
                  disabled={onshapeBusy}
                  aria-label={onshapeConnected ? "Disconnect Onshape" : "Connect Onshape"}
                  title="Subscribe to Onshape's FeatureScript MCP Server in the App Store first"
                  data-testid="assistant-onshape-toggle"
                >
                  {onshapeBusy
                    ? onshapeConnected ? "Disconnecting…" : "Connecting…"
                    : onshapeConnected ? "Disconnect" : "Connect"}
                </button>
                {onshapeError && <p className="assistant-onshape-setting-error" role="alert">{onshapeError}</p>}
              </section>
            )}
            <section className="assistant-custom-mcp-connections" aria-label="Custom MCP servers" data-testid="assistant-custom-mcp-setting">
              <div className="assistant-tools-head">
                <div>
                  <p className="assistant-onshape-setting-title">Custom MCP servers</p>
                  <p className="assistant-onshape-setting-status" role="status">
                    {customMcpConnectionsLoading
                      ? "Loading connections…"
                      : customMcpConnections.length
                        ? `${customMcpConnections.length} connected`
                        : "No custom servers connected"}
                  </p>
                </div>
              </div>
              {customMcpConnections.map((connection) => (
                <div className="assistant-onshape-setting" key={connection.id} data-testid={`assistant-custom-mcp-connection-${connection.id}`}>
                  <div className="assistant-onshape-setting-copy">
                    <p className="assistant-onshape-setting-title">Custom MCP server</p>
                    <p className="assistant-onshape-setting-status" role="status">Connected</p>
                    <p className="assistant-onshape-setting-status assistant-mcp-endpoint-label">{connection.endpointUrl}</p>
                  </div>
                  <button
                    type="button"
                    className="assistant-onshape-setting-action"
                    onClick={() => onDisconnectCustomMcp?.(connection.id)}
                    disabled={customMcpBusy}
                    aria-label={`Disconnect ${connection.endpointUrl}`}
                    data-testid={`assistant-custom-mcp-disconnect-${connection.id}`}
                  >
                    {customMcpBusy ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ))}
              <div className="assistant-custom-mcp-add">
                <p className="assistant-onshape-setting-title">Add a custom MCP server</p>
                <p className="assistant-onshape-setting-status" role="status">
                  {customMcpBusy ? "Connecting…" : customMcpApiKeyRequired ? "API key required" : "Enter an HTTPS endpoint"}
                </p>
                <input
                  type="url"
                  value={customMcpEndpoint}
                  onChange={(event) => onCustomMcpEndpointChange?.(event.target.value)}
                  placeholder="https://example.com/mcp"
                  aria-label="MCP endpoint URL"
                  data-testid="assistant-custom-mcp-endpoint"
                  className="assistant-mcp-endpoint"
                />
                {customMcpApiKeyRequired && (
                <div className="assistant-mcp-api-key-fields">
                  <label>
                    API key
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={customMcpApiKey}
                      onChange={(event) => onCustomMcpApiKeyChange?.(event.target.value)}
                      aria-label="MCP API key"
                      data-testid="assistant-custom-mcp-api-key"
                      className="assistant-mcp-endpoint"
                    />
                  </label>
                  <label>
                    Header name
                    <input
                      type="text"
                      value={customMcpApiKeyHeader}
                      onChange={(event) => onCustomMcpApiKeyHeaderChange?.(event.target.value)}
                      aria-label="MCP API key header name"
                      data-testid="assistant-custom-mcp-api-key-header"
                      className="assistant-mcp-endpoint"
                    />
                  </label>
                  <label>
                    Header prefix
                    <input
                      type="text"
                      value={customMcpApiKeyPrefix}
                      onChange={(event) => onCustomMcpApiKeyPrefixChange?.(event.target.value)}
                      placeholder="Optional, e.g. Bearer"
                      aria-label="MCP API key header prefix"
                      data-testid="assistant-custom-mcp-api-key-prefix"
                      className="assistant-mcp-endpoint"
                    />
                  </label>
                </div>
              )}
                <button
                  type="button"
                  className="assistant-onshape-setting-action"
                  onClick={onConnectCustomMcp}
                  disabled={customMcpBusy || !customMcpEndpoint.trim() || (customMcpApiKeyRequired && !customMcpApiKey.trim())}
                  data-testid="assistant-custom-mcp-toggle"
                >
                  {customMcpBusy ? "Connecting…" : "Connect"}
                </button>
              </div>
              {customMcpError && <p className="assistant-onshape-setting-error" role="alert">{customMcpError}</p>}
            </section>
            {canManageAssistantTools && <AssistantSkillManager expanded={skillsExpanded} onExpandedChange={setSkillsExpanded} />}
            {canManageAssistantTools && <div className="assistant-tools-groups" onClickCapture={collapseSkillsForToolInteraction}>
              {ASSISTANT_TOOL_GROUPS.map((group) => {
                const names = group.tools.map((tool) => tool.name);
                const enabledInGroup = names.filter((name) => !disabledSet.has(name)).length;
                const allChecked = enabledInGroup === names.length;
                const someChecked = enabledInGroup > 0 && enabledInGroup < names.length;
                return (
                  <fieldset key={group.id} className="assistant-tools-group">
                    <div className="assistant-tools-group-head">
                      <Checkbox
                        id={`assistant-tools-group-${group.id}`}
                        checked={someChecked ? "indeterminate" : allChecked}
                        onCheckedChange={(checked) => toggleGroup(names, checked === true)}
                        aria-label={`${group.label} tools`}
                      />
                      <label htmlFor={`assistant-tools-group-${group.id}`} className="assistant-tools-group-label">
                        {group.label}
                        <span className="assistant-tools-group-count">
                          {enabledInGroup}/{names.length}
                        </span>
                      </label>
                    </div>
                    <p className="assistant-tools-group-desc">{group.description}</p>
                    <div className="assistant-tools-list">
                      {group.tools.map((tool) => {
                        const enabled = !disabledSet.has(tool.name);
                        return (
                          <label key={tool.name} className="assistant-tools-item" title={tool.hint}>
                            <Checkbox
                              checked={enabled}
                              onCheckedChange={(checked) => toggleTool(tool.name, checked === true)}
                              aria-label={`${tool.label} tool`}
                            />
                            <span className="assistant-tools-item-text">
                              <span className="assistant-tools-item-label">{tool.label}</span>
                              <span className="assistant-tools-item-hint">{tool.hint}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
              {dynamicToolNames.length > 0 && (
                <fieldset className="assistant-tools-group" data-testid="assistant-dynamic-tools">
                  <div className="assistant-tools-group-head">
                    <Checkbox
                      id="assistant-tools-group-dynamic"
                      checked={
                        dynamicToolNames.every((name) => disabledSet.has(name))
                          ? false
                          : dynamicToolNames.every((name) => !disabledSet.has(name))
                            ? true
                            : "indeterminate"
                      }
                      onCheckedChange={(checked) => toggleGroup(dynamicToolNames, checked === true)}
                      aria-label="Connected service tools"
                    />
                    <label htmlFor="assistant-tools-group-dynamic" className="assistant-tools-group-label">
                      Connected service tools
                      <span className="assistant-tools-group-count">
                        {dynamicToolNames.filter((name) => !disabledSet.has(name)).length}/{dynamicToolNames.length}
                      </span>
                    </label>
                  </div>
                  <p className="assistant-tools-group-desc">Tools discovered from your connected Onshape and custom MCP services.</p>
                  <div className="assistant-tools-list">
                    {dynamicTools.filter((tool) => dynamicToolNames.includes(tool.name)).map((tool) => (
                      <label key={tool.name} className="assistant-tools-item" title={tool.hint}>
                        <Checkbox
                          checked={!disabledSet.has(tool.name)}
                          onCheckedChange={(checked) => toggleTool(tool.name, checked === true)}
                          aria-label={`${tool.label} tool`}
                        />
                        <span className="assistant-tools-item-text">
                          <span className="assistant-tools-item-label">{tool.label}</span>
                          <span className="assistant-tools-item-hint">{tool.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {dynamicToolsError && (
                <p role="status" className="assistant-tools-foot" data-testid="assistant-dynamic-tools-error">
                  {dynamicToolsError}
                </p>
              )}
            </div>}
            {canManageAssistantTools && <p className="assistant-tools-foot">
              Disabled tools are hidden from the model and blocked if called.
            </p>}
          </PopoverContent>
        </Popover>
      </div>
      {modelLocked && <span className="assistant-model-picker-error" role="status">Model choice is locked by your team admin.</span>}
      {error && (
        <span className="assistant-model-picker-error" role="status">
          Model list unavailable
        </span>
      )}
    </div>
  );
}