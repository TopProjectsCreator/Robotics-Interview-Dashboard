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
    expect(await screen.findByRole("listbox")).toHaveAttribute("data-align", "start");
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

  it("offers thinking levels only for models whose provider metadata advertises reasoning", async () => {
    const onThinkingLevelChange = vi.fn();
    const { rerender } = render(
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
    render(
      <AssistantModelPicker
        model="openrouter/free"
        models={[{ id: "openrouter/free" }]}
        loading={false}
        error={false}
        onChange={vi.fn()}
      />,
    );

    const picker = screen.getByRole("combobox", { name: "Assistant model" });
    const gear = screen.getByRole("button", { name: "Assistant tools" });
    // Gear sits in the same inline row as the dropdown.
    expect(gear.closest(".assistant-model-picker-row")).toContainElement(picker);
    expect(screen.getByTestId("assistant-tools-gear")).toBe(gear);

    fireEvent.click(gear);
    expect(await screen.findByText("Assistant tools")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-tools-count")).toHaveTextContent("44 of 44 enabled");
    expect(screen.getByRole("checkbox", { name: "Web search tool" })).toBeChecked();
  });

  it("reports disabled tools when a tool is toggled off", async () => {
    const onDisabledToolsChange = vi.fn();
    render(
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

    fireEvent.click(screen.getByRole("button", { name: "Assistant tools" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Web search tool" }));
    expect(onDisabledToolsChange).toHaveBeenCalledWith(["web_search"]);
  });

  it("reflects controlled disabled tools with a count and read-only shortcut", async () => {
    const onDisabledToolsChange = vi.fn();
    render(
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
});