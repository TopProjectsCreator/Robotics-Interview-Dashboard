import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssistantModelPicker } from "./AssistantModelPicker";

describe("AssistantModelPicker", () => {
  it("shows provider models and reports the selected id", () => {
    const onChange = vi.fn();
    render(
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
    expect(picker).toHaveValue("openrouter/free");
    expect(screen.getByRole("option", { name: "New provider model" })).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "provider/new-model" } });
    expect(onChange).toHaveBeenCalledWith("provider/new-model");
  });

  it("keeps the current model visible and disables selection while loading", () => {
    render(
      <AssistantModelPicker
        model="openrouter/free"
        models={[]}
        loading
        error={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Assistant model" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "openrouter/free" })).toBeInTheDocument();
  });
});