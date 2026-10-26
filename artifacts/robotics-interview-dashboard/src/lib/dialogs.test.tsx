import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { confirmAction, DialogHost } from "./dialogs";

it("centers the shared confirmation dialog within its full-screen overlay", async () => {
  render(<DialogHost />);
  const result = confirmAction({ title: "Delete this message?" });
  const dialog = await screen.findByRole("dialog", { name: "Delete this message?" });

  expect(dialog.querySelector("[data-testid='app-dialog-panel']")).toHaveClass("mx-auto");

  fireEvent.click(screen.getByTestId("app-dialog-cancel"));
  await expect(result).resolves.toBe(false);
});
