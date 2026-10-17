import { useMemo, useState } from "react";
import { Bot, Settings, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_ASSISTANT_TOOL_NAMES,
  ASSISTANT_TOOL_GROUPS,
  WRITE_TOOL_NAMES,
  loadDisabledTools,
  normalizeDisabledTools,
  saveDisabledTools,
} from "./assistantTools";

export type AssistantModelOption = {
  id: string;
  name?: string;
  thinkingLevels?: ("low" | "medium" | "high")[];
};

export type AssistantThinkingLevel = "auto" | "low" | "medium" | "high";

type AssistantModelPickerProps = {
  model: string;
  models: AssistantModelOption[];
  loading: boolean;
  error: boolean;
  onChange: (model: string) => void;
  thinkingLevel?: AssistantThinkingLevel;
  onThinkingLevelChange?: (level: AssistantThinkingLevel) => void;
  disabledTools?: string[];
  onDisabledToolsChange?: (tools: string[]) => void;
};

export function AssistantModelPicker({
  model,
  models,
  loading,
  error,
  onChange,
  thinkingLevel = "auto",
  onThinkingLevelChange,
  disabledTools: controlledDisabled,
  onDisabledToolsChange,
}: AssistantModelPickerProps) {
  const options = models.length ? models : model ? [{ id: model }] : [];
  const [internalDisabled, setInternalDisabled] = useState<string[]>(() => loadDisabledTools());
  const [toolsOpen, setToolsOpen] = useState(false);
  const disabledTools = useMemo(
    () => normalizeDisabledTools(controlledDisabled ?? internalDisabled),
    [controlledDisabled, internalDisabled],
  );
  const disabledSet = useMemo(() => new Set(disabledTools), [disabledTools]);
  const enabledCount = ALL_ASSISTANT_TOOL_NAMES.length - disabledTools.length;

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

  return (
    <div className="assistant-model-picker-wrap">
      <div className="assistant-model-picker-row">
        <Select
          value={options.some((option) => option.id === model) ? model : ""}
          disabled={loading || models.length === 0}
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
              placeholder={loading ? "Loading…" : error ? "Unavailable" : "Choose a model"}
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
        <Popover open={toolsOpen} onOpenChange={setToolsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Assistant tools"
              title={disabledTools.length ? `${enabledCount} of ${ALL_ASSISTANT_TOOL_NAMES.length} tools enabled` : "Assistant tools"}
              data-testid="assistant-tools-gear"
              className="assistant-tools-gear"
            >
              <Settings size={15} />
              {disabledTools.length > 0 && (
                <span className="assistant-tools-gear-dot" aria-hidden="true" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="assistant-tools-popover">
            <div className="assistant-tools-head">
              <div>
                <p className="assistant-tools-title">Assistant tools</p>
                <p className="assistant-tools-subtitle" data-testid="assistant-tools-count">
                  {enabledCount} of {ALL_ASSISTANT_TOOL_NAMES.length} enabled
                </p>
              </div>
              <div className="assistant-tools-head-actions">
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
                  onClick={() => updateDisabled([...WRITE_TOOL_NAMES])}
                  disabled={disabledTools.length === WRITE_TOOL_NAMES.size && [...WRITE_TOOL_NAMES].every((name) => disabledSet.has(name))}
                >
                  Read-only
                </button>
              </div>
            </div>
            <div className="assistant-tools-groups">
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
            </div>
            <p className="assistant-tools-foot">
              Disabled tools are hidden from the model and blocked if called.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <span className="assistant-model-picker-error" role="status">
          Model list unavailable
        </span>
      )}
    </div>
  );
}