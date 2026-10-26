import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("route scroll reset", () => {
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: 0,
      });
    });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it.each([
    { testId: "link-footer-about", destination: "/about", heading: /the work behind a robot/i },
    { testId: "link-footer-privacy", destination: "/privacy", heading: "Privacy Policy" },
    { testId: "link-footer-terms", destination: "/terms", heading: "Terms of Use" },
  ])("starts $destination at the top after footer navigation", async ({ testId, destination, heading }) => {
    render(<App />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 900 });

    fireEvent.click(screen.getByTestId(testId));

    await waitFor(() => expect(window.location.pathname).toBe(destination));
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(window.scrollY).toBe(0);
  });

  it("resets scroll on an ordinary route change", async () => {
    render(<App />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 900 });

    fireEvent.click(screen.getByTestId("link-chat-entry"));

    await waitFor(() => expect(window.location.pathname).toBe("/chat-landing"));
    expect(screen.getByTestId("chat-landing")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(window.scrollY).toBe(0);
  });

  it("leaves same-page hash navigation to the browser", async () => {
    render(<App />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 900 });

    fireEvent.click(screen.getByTestId("link-hero-capabilities"));

    await waitFor(() => expect(window.location.hash).toBe("#capabilities"));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(900);
  });
});
