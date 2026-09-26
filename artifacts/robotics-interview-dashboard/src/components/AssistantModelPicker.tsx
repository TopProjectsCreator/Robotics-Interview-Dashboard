import { Bot, ChevronDown } from "lucide-react";

export type AssistantModelOption = {
  id: string;
  name?: string;
};

type AssistantModelPickerProps = {
  model: string;
  models: AssistantModelOption[];
  loading: boolean;
  error: boolean;
  onChange: (model: string) => void;
};

export function AssistantModelPicker({
  model,
  models,
  loading,
  error,
  onChange,
}: AssistantModelPickerProps) {
  const options = models.length ? models : model ? [{ id: model }] : [];

  return (
    <div className="assistant-model-picker-wrap">
      <label className="assistant-model-picker">
        <Bot size={14} aria-hidden="true" />
        <span>Model:</span>
        <select
          aria-label="Assistant model"
          data-testid="assistant-model-picker"
          value={model}
          disabled={loading || models.length === 0}
          onChange={(event) => onChange(event.target.value)}
          title={model}
        >
          {!options.length && <option value="">Loading models…</option>}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name || option.id}
            </option>
          ))}
        </select>
        <ChevronDown size={13} aria-hidden="true" />
      </label>
      {error && (
        <span className="assistant-model-picker-error" role="status">
          Model list unavailable
        </span>
      )}
    </div>
  );
}