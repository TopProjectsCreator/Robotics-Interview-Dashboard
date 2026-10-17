import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  useGetSession: vi.fn(),
  useLogout: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-client-react")>();
  return {
    ...actual,
    useGetSession: apiMocks.useGetSession,
    useLogout: apiMocks.useLogout,
  };
});

import { AccountMenu } from "../App";

const originalViewport = { width: window.innerWidth, height: window.innerHeight };

describe("AccountMenu notepad overlay", () => {
  afterEach(() => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalViewport.height });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalViewport.width });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.useGetSession.mockReturnValue({
      data: { interviewerId: "interviewer-1", label: "Interviewer", role: "interviewer" },
    });
    apiMocks.useLogout.mockReturnValue({ mutate: vi.fn() });
  });

  it("opens outside the sticky blurred header and keeps the editor scrollable in a short viewport", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 240 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <Router>
          <header className="sticky top-0 backdrop-blur-md" data-testid="sticky-blurred-header">
            <AccountMenu onOpenSettings={vi.fn()} />
          </header>
        </Router>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Notepad" }));

    const overlay = screen.getByTestId("personal-notepad-overlay");
    const header = screen.getByTestId("sticky-blurred-header");
    const dialog = screen.getByRole("dialog", { name: "Personal notepad" });
    const editorScroll = screen.getByTestId("personal-notepad-editor-scroll");

    expect(overlay.parentElement).toBe(document.body);
    expect(header.contains(overlay)).toBe(false);
    expect(dialog.style.maxHeight).toContain("100dvh");
    expect(dialog.style.maxHeight).toContain("1.5rem");
    expect(editorScroll).toHaveClass("min-h-0", "overflow-y-auto");
    expect(screen.getByRole("button", { name: "Close notepad" })).toBeVisible();
  });
});
