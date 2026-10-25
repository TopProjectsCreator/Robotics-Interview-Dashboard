import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamNameRule } from "@workspace/api-client-react";
import { TeamNameRulesSettings } from "./TeamNameRulesSettings";

let savedRules: TeamNameRule[] = [];
let rejectSave = false;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = new URL(String(input), window.location.origin).pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  if (!path.endsWith("/api/auth/name-rules")) return jsonResponse({ error: "Not found" }, 404);
  if (method === "GET") return jsonResponse({ rules: savedRules });
  if (method === "PUT") {
    if (rejectSave) return jsonResponse({ error: "Name rules could not be saved." }, 400);
    savedRules = (JSON.parse(String(init?.body ?? "{}")) as { rules: TeamNameRule[] }).rules;
    return jsonResponse({ rules: savedRules });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
});

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TeamNameRulesSettings teamId="team-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  savedRules = [];
  rejectSave = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("TeamNameRulesSettings", () => {
  it("adds, edits, explains, saves, and removes plain-language rules", async () => {
    renderSettings();
    expect(await screen.findByText(/No name rules yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-add-team-name-rule"));
    fireEvent.change(screen.getByTestId("select-team-name-rule-type-0"), { target: { value: "startsWith" } });
    fireEvent.change(screen.getByTestId("input-team-name-rule-text-0"), { target: { value: "Robot" } });
    expect(screen.getByText("Rejects names that begin with this text.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-save-team-name-rules"));

    await waitFor(() => expect(savedRules).toEqual([{ matchType: "startsWith", text: "Robot" }]));
    expect(await screen.findByText("Name rules saved for the whole team.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-remove-team-name-rule-0"));
    fireEvent.click(screen.getByTestId("button-save-team-name-rules"));
    await waitFor(() => expect(savedRules).toEqual([]));
    expect(await screen.findByText(/No name rules yet/)).toBeInTheDocument();
  });

  it("shows useful save errors without discarding the draft", async () => {
    rejectSave = true;
    renderSettings();
    await screen.findByText(/No name rules yet/);
    fireEvent.click(screen.getByTestId("button-add-team-name-rule"));
    fireEvent.change(screen.getByTestId("input-team-name-rule-text-0"), { target: { value: "blocked" } });
    fireEvent.click(screen.getByTestId("button-save-team-name-rules"));

    expect(await screen.findByTestId("team-name-rules-error")).toHaveTextContent("Name rules could not be saved.");
    expect(screen.getByTestId("input-team-name-rule-text-0")).toHaveValue("blocked");
  });
});
