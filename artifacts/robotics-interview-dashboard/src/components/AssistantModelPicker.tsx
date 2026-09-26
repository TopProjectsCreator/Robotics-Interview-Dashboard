import { Bot } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          align="end"
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
      {error && (
        <span className="assistant-model-picker-error" role="status">
          Model list unavailable
        </span>
      )}
    </div>
  );
}