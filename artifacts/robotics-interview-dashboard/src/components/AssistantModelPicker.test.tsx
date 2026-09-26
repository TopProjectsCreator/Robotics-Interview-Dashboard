import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssistantModelPicker } from "./AssistantModelPicker";

describe("AssistantModelPicker", () => {
  it("shows provider models and reports the selected id", async () => {
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
    expect(picker).toHaveTextContent("openrouter/free");

    fireEvent.keyDown(picker, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "New provider model" }));
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

    const picker = screen.getByRole("combobox", { name: "Assistant model" });
    expect(picker).toBeDisabled();
    expect(picker).toHaveTextContent("openrouter/free");
  });
});