import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamRoleManagement } from "./TeamRoleManagement";

let savedRoles: { id: string; name: string; permissions: string[] }[] = [];
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = new URL(String(input), window.location.origin).pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  if (path === "/api/auth/roles" && method === "GET") return json({ roles: savedRoles });
  if (path === "/api/auth/roles" && method === "POST") {
    const role = { id: "role-build-lead", ...body as { name: string; permissions: string[] } };
    savedRoles = [role];
    return json(role, 201);
  }
  if (path === "/api/auth/roles/role-build-lead" && method === "DELETE") {
    savedRoles = savedRoles.filter((role) => role.id !== "role-build-lead");
    return new Response(null, { status: 204 });
  }
  return json({ error: "Not found" }, 404);
});

function renderManagement() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TeamRoleManagement teamId="team-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  savedRoles = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("TeamRoleManagement", () => {
  it("creates a role with selected permissions", async () => {
    renderManagement();
    const permission = await screen.findByTestId("checkbox-permission-applicants.edit");
    fireEvent.change(screen.getByTestId("input-custom-role-name"), { target: { value: "Build lead" } });
    fireEvent.click(permission);
    fireEvent.click(screen.getByTestId("button-save-custom-role"));

    await waitFor(() => expect(savedRoles).toEqual([{
      id: "role-build-lead",
      name: "Build lead",
      permissions: ["applicants.edit"],
    }]));
    // Assignment happens with the Role menu on each person in Team members.
    expect(screen.queryByTestId("select-settings-role-member-1")).not.toBeInTheDocument();
  });

  it("deletes a saved role after confirmation", async () => {
    savedRoles = [{ id: "role-build-lead", name: "Build lead", permissions: ["applicants.edit"] }];
    renderManagement();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(savedRoles).toEqual([]));
  });

  it("fails closed for role creation when the roles list cannot load", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("unavailable", { status: 503 }));
    renderManagement();
    await screen.findByText(/Roles could not be loaded/);
    expect(screen.getByTestId("button-save-custom-role")).toBeDisabled();
  });
});
