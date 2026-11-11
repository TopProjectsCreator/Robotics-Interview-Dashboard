import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFaviconUnreadDot } from "./use-favicon-unread-dot";

const BASE_SVG =
  '<svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="180" height="180" rx="36" fill="#f8c84a"/></svg>';

function iconLink(): HTMLLinkElement {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) throw new Error("icon link missing");
  return link;
}

describe("useFaviconUnreadDot", () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => BASE_SVG,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
  });

  it("keeps the base favicon while there is nothing unread", () => {
    renderHook(() => useFaviconUnreadDot(false));
    expect(iconLink().getAttribute("href")).toBe("/favicon.svg");
    expect(iconLink().getAttribute("type")).toBe("image/svg+xml");
  });

  it("stamps a red bottom-right dot onto the favicon while unread", async () => {
    renderHook(() => useFaviconUnreadDot(true));
    await waitFor(() => {
      expect(iconLink().getAttribute("href")).toMatch(/^data:image\/svg\+xml/);
    });
    const href = iconLink().getAttribute("href") ?? "";
    const decoded = decodeURIComponent(href.split(",")[1] ?? "");
    // Red badge on the bottom-right, base artwork preserved.
    expect(decoded).toContain('<circle cx="143" cy="143" r="29" fill="#ef4444"');
    expect(decoded).toContain('fill="#f8c84a"');
    expect(iconLink().getAttribute("type")).toBe("image/svg+xml");
  });

  it("restores the original favicon when the last unread clears", async () => {
    const { rerender } = renderHook(({ hasUnread }) => useFaviconUnreadDot(hasUnread), {
      initialProps: { hasUnread: true },
    });
    await waitFor(() => {
      expect(iconLink().getAttribute("href")).toMatch(/^data:image\/svg\+xml/);
    });
    rerender({ hasUnread: false });
    expect(iconLink().getAttribute("href")).toBe("/favicon.svg");
    expect(iconLink().getAttribute("type")).toBe("image/svg+xml");
  });
});
