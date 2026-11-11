import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamAccessCodeSettings } from "./TeamAccessCodeSettings";

let responseStatus = 200;
let responseBody: unknown = { message: "Team access code updated." };

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = new URL(String(input), window.location.origin).pathname;
  if (path !== "/api/auth/teams/access-code") {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
  return new Response(JSON.stringify(responseBody), {
    status: responseStatus,
    headers: { "Content-Type": "application/json" },
  });
});

function renderSettings(canManage = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TeamAccessCodeSettings canManage={canManage} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  responseStatus = 200;
  responseBody = { message: "Team access code updated." };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("TeamAccessCodeSettings", () => {
  it("hides the code control from non-admins", () => {
    renderSettings(false);
    expect(screen.queryByTestId("settings-team-access-code")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates length, saves only the trimmed new code, and clears it after success", async () => {
    renderSettings();
    const field = screen.getByTestId("input-new-team-access-code");
    const save = screen.getByTestId("button-save-team-access-code");

    fireEvent.change(field, { target: { value: "abc" } });
    expect(save).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "  Fresh-Team-Code  " } });
    expect(field).toHaveClass("dark:bg-[#0f1e27]");
    fireEvent.click(save);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ code: "Fresh-Team-Code" });
    expect(await screen.findByTestId("team-access-code-success")).toHaveTextContent("Team access code updated.");
    expect(field).toHaveValue("");
    expect(screen.queryByText("Fresh-Team-Code")).not.toBeInTheDocument();
  });

  it("shows clear conflict feedback and keeps the draft available", async () => {
    responseStatus = 409;
    responseBody = { error: "That team access code is already in use. Choose a different code." };
    renderSettings();
    const field = screen.getByTestId("input-new-team-access-code");
    fireEvent.change(field, { target: { value: "Already-Used" } });
    fireEvent.click(screen.getByTestId("button-save-team-access-code"));

    expect(await screen.findByTestId("team-access-code-error")).toHaveTextContent("already in use");
    expect(field).toHaveValue("Already-Used");
  });

  it("does not show an existing code in the settings control", () => {
    renderSettings();
    expect(screen.getByText(/Your current code is never shown/)).toBeInTheDocument();
    expect(screen.queryByText(/Current code:/)).not.toBeInTheDocument();
  });
});
