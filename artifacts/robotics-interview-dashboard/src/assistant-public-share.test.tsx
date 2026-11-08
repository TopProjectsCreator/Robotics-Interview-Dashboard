import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { queryClient } from "./App";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("public assistant share page", () => {
  const token = "B".repeat(43);

  beforeEach(() => {
    queryClient.clear();
    window.history.replaceState({}, "", `/assistant/share/${token}`);
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it("loads only the anonymous transcript endpoint and reveals no unrelated data", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (url.pathname === `/api/assistant/public-shares/${token}`) {
        return jsonResponse({
          heading: "Shared assistant conversation",
          messages: [{ question: "How can we improve the robot?", answer: "Reduce drivetrain weight." }],
        });
      }
      return jsonResponse({ error: "Unexpected request" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    expect(await screen.findByTestId("public-assistant-share-transcript")).toBeInTheDocument();
    expect(screen.getByText("How can we improve the robot?")).toBeInTheDocument();
    expect(screen.getByText("Reduce drivetrain weight.")).toBeInTheDocument();
    expect(screen.queryByText(/team|owner|tool activity|applicant/i)).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const requestedUrl = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    expect(requestedUrl.pathname).toBe(`/api/assistant/public-shares/${token}`);
    expect(init.credentials).toBe("omit");
    expect(document.title).toBe("Shared assistant conversation");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow, noarchive");
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute("content")).toBe("no-referrer");
  });

  it("shows a generic unavailable state when a revoked link returns not found", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "This share link is unavailable." }, 404));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    expect(await screen.findByTestId("public-assistant-share-unavailable")).toHaveTextContent("This link is unavailable");
    expect(screen.queryByText("Other team user")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
