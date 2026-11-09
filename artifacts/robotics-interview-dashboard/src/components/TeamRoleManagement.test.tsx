import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamRoleManagement } from "./TeamRoleManagement";

let savedRoles: { id: string; name: string; permissions: string[] }[] = [];
let assignedRoleId: string | null = null;
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
  if (path === "/api/auth/interviewers/member-1/custom-role" && method === "PUT") {
    assignedRoleId = (body.customRoleId as string | null) ?? null;
    return json({ id: "member-1", displayName: "Build lead", role: "interviewer", hasPassword: true, customRoleId: assignedRoleId });
  }
  return json({ error: "Not found" }, 404);
});

function renderManagement() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TeamRoleManagement
        teamId="team-1"
        accounts={[
          { id: "member-1", displayName: "Build lead", role: "interviewer", hasPassword: true },
          { id: "admin-1", displayName: "Team admin", role: "coordinator", hasPassword: true },
        ]}
        accountsLoading={false}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  savedRoles = [];
  assignedRoleId = null;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("TeamRoleManagement", () => {
  it("creates a role with selected permissions and assigns it without offering Admin accounts", async () => {
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
    expect(screen.queryByTestId("select-custom-role-admin-1")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("select-custom-role-member-1"), { target: { value: "role-build-lead" } });
    await waitFor(() => expect(assignedRoleId).toBe("role-build-lead"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/interviewers/member-1/custom-role",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("fails closed for role assignment when the roles list cannot load", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("unavailable", { status: 503 }));
    renderManagement();
    const select = await screen.findByTestId("select-custom-role-member-1");
    await screen.findByText(/Roles could not be loaded/);
    expect(select).toBeDisabled();
    expect(screen.getByTestId("button-save-custom-role")).toBeDisabled();
  });
});
