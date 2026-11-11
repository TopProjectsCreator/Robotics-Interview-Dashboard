import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductivityPromptSettings } from "./ProductivityPromptSettings";

const requests: { method: string; body?: Record<string, unknown> }[] = [];
let customMessage = "Prioritize verified build progress.";
const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
  requests.push({ method, body });
  const payload = method === "PUT" && typeof body?.customMessage === "string"
    ? (customMessage = body.customMessage, { enabled: false, customMessage, updatedAt: "2026-11-11T20:00:00.000Z" })
    : { enabled: false, customMessage, updatedAt: "2026-11-11T20:00:00.000Z" };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProductivityPromptSettings teamId="team-a" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  customMessage = "Prioritize verified build progress.";
  requests.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("ProductivityPromptSettings", () => {
  it("loads, saves, and clears the team's custom message without changing enablement", async () => {
    renderSettings();
    const input = await screen.findByTestId("input-productivity-custom-message");
    expect(input).toHaveValue("Prioritize verified build progress.");

    fireEvent.change(input, { target: { value: "Mention measurable test results." } });
    fireEvent.click(screen.getByTestId("button-save-productivity-custom-message"));

    expect(await screen.findByTestId("productivity-prompt-result")).toHaveTextContent("Custom message saved.");
    expect(requests.find((request) => request.method === "PUT")?.body).toEqual({
      customMessage: "Mention measurable test results.",
    });
    expect(input).toHaveValue("Mention measurable test results.");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByTestId("button-save-productivity-custom-message"));
    await waitFor(() => expect(customMessage).toBe(""));
    expect(requests.filter((request) => request.method === "PUT").at(-1)?.body).toEqual({ customMessage: "" });
  });
});
