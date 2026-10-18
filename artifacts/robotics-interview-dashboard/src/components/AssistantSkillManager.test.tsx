import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantSkill } from "@workspace/api-client-react";
import { AssistantSkillManager } from "./AssistantSkillManager";

let records: AssistantSkill[] = [];
let nextId = 1;
let rejectCreate = false;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = new URL(String(input), window.location.origin).pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  if (path === "/api/assistant/skills" && method === "GET") {
    return jsonResponse({ items: records });
  }
  if (path === "/api/assistant/skills" && method === "POST") {
    if (rejectCreate) return jsonResponse({ error: "A skill with that name already exists." }, 409);
    const data = JSON.parse(String(init?.body ?? "{}")) as Omit<AssistantSkill, "id" | "createdAt" | "updatedAt">;
    const now = new Date().toISOString();
    const created: AssistantSkill = { ...data, id: `skill-${nextId++}`, createdAt: now, updatedAt: now };
    records = [...records, created];
    return jsonResponse(created, 201);
  }
  const id = path.split("/").at(-1) ?? "";
  const index = records.findIndex((skill) => skill.id === id);
  if (index < 0) return jsonResponse({ error: "Assistant skill not found." }, 404);
  if (method === "PATCH") {
    const patch = JSON.parse(String(init?.body ?? "{}")) as Partial<AssistantSkill>;
    records[index] = { ...records[index], ...patch, updatedAt: new Date().toISOString() };
    return jsonResponse(records[index]);
  }
  if (method === "DELETE") {
    records = records.filter((skill) => skill.id !== id);
    return new Response(null, { status: 204 });
  }
  return jsonResponse({ error: "Not found" }, 404);
});

function renderManager() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantSkillManager />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  records = [];
  nextId = 1;
  rejectCreate = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AssistantSkillManager", () => {
  it("creates, edits, and enables or disables a team skill", async () => {
    renderManager();
    await screen.findByText("No team skills yet");
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    fireEvent.change(screen.getByTestId("input-skill-name"), { target: { value: "Interview intake" } });
    fireEvent.change(screen.getByTestId("input-skill-description"), { target: { value: "Gather context before an interview" } });
    fireEvent.change(screen.getByTestId("input-skill-instructions"), { target: { value: "Review relevant experience, then summarize." } });
    fireEvent.click(screen.getByTestId("skill-action-search_applicants"));
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));

    expect(await screen.findByTestId("assistant-skill-feedback")).toHaveTextContent("Skill added to the team library.");
    expect(await screen.findByTestId("assistant-skill-skill-1")).toBeInTheDocument();
    expect(records[0]?.actions).toEqual(["search_applicants"]);

    fireEvent.click(screen.getByRole("button", { name: "Edit Interview intake" }));
    fireEvent.change(screen.getByTestId("input-skill-name"), { target: { value: "Interview preparation" } });
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(await screen.findByTestId("assistant-skill-skill-1")).toHaveTextContent("Interview preparation");

    fireEvent.click(screen.getByRole("button", { name: "Disable Interview preparation" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enable Interview preparation" })).toHaveAttribute("aria-pressed", "false"));
    expect(records[0]?.enabled).toBe(false);
  });

  it("shows skill details and requires confirmation before deleting", async () => {
    records = [{
      id: "existing-skill",
      name: "Debrief",
      description: "Summarize an interview",
      instructions: "Use only confirmed interview notes.",
      actions: ["get_applicant"],
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    }];
    renderManager();
    fireEvent.click(await screen.findByRole("button", { name: "Debrief" }));
    expect(screen.getByText("Use only confirmed interview notes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete Debrief" }));
    expect(screen.getByRole("group", { name: "Confirm deletion of Debrief" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-delete-skill-existing-skill"));
    expect(await screen.findByTestId("assistant-skill-feedback")).toHaveTextContent("Debrief removed from the team library.");
    expect(records).toHaveLength(0);
  });

  it("shows validation and server errors without losing the draft", async () => {
    renderManager();
    await screen.findByText("No team skills yet");
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a name, summary, and instructions");
    expect(fetchMock).toHaveBeenCalledTimes(1); // initial list only

    fireEvent.change(screen.getByTestId("input-skill-name"), { target: { value: "Repeat workflow" } });
    fireEvent.change(screen.getByTestId("input-skill-description"), { target: { value: "Use on recurring interviews" } });
    fireEvent.change(screen.getByTestId("input-skill-instructions"), { target: { value: "Summarize the confirmed evidence." } });
    rejectCreate = true;
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("input-skill-name")).toHaveValue("Repeat workflow");
  });
});
