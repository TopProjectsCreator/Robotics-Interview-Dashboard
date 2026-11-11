import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamRoleManagement } from "./TeamRoleManagement";

let savedRoles: { id: string; name: string; permissions: string[] }[] = [];
const accounts = [
  { id: "member-1", displayName: "Build lead", role: "interviewer", hasPassword: true, customRoleId: null },
  { id: "admin-1", displayName: "Team admin", role: "coordinator", hasPassword: true, customRoleId: null },
  { id: "treasurer-1", displayName: "Money", role: "treasurer", hasPassword: true, customRoleId: null },
];
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
  return json({ error: "Not found" }, 404);
});

const defaultProps = {
  teamId: "team-1",
  accounts,
  accountsLoading: false,
  busyAccountId: "",
  selfId: "someone-else",
  onRoleChange: vi.fn(),
};

function renderManagement(overrides: Partial<typeof defaultProps> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onRoleChange = vi.fn();
  return {
    onRoleChange,
    ...render(
      <QueryClientProvider client={client}>
        <TeamRoleManagement {...defaultProps} onRoleChange={onRoleChange} {...overrides} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  savedRoles = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
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
  });

  it("offers built-in roles for every account and routes selection through onRoleChange", async () => {
    const { onRoleChange } = renderManagement();
    const select = await screen.findByTestId("select-settings-role-member-1");
    await waitFor(() => expect(select).not.toBeDisabled());
    expect(select).toHaveValue("interviewer");
    expect(screen.getByTestId("select-settings-role-admin-1")).toHaveValue("coordinator");
    expect(screen.getByTestId("select-settings-role-treasurer-1")).toHaveValue("treasurer");
    fireEvent.change(select, { target: { value: "treasurer" } });
    expect(onRoleChange).toHaveBeenCalledWith(expect.objectContaining({ id: "member-1" }), "treasurer");
  });

  it("lists saved custom roles and disables them for Admin accounts and for yourself", async () => {
    savedRoles = [{ id: "role-build-lead", name: "Build lead", permissions: ["applicants.edit"] }];
    const { onRoleChange } = renderManagement({ selfId: "member-1" });
    const adminSelect = await screen.findByTestId("select-settings-role-admin-1");
    await waitFor(() => expect(adminSelect).not.toBeDisabled());
    // Custom roles must not be assignable to built-in Admin accounts.
    const customGroups = adminSelect.querySelectorAll("optgroup[label='Custom roles']");
    expect(customGroups[0]).toHaveAttribute("disabled");
    // You cannot change your own role.
    expect(screen.getByTestId("select-settings-role-member-1")).toBeDisabled();
    const treasurerSelect = screen.getByTestId("select-settings-role-treasurer-1");
    await waitFor(() => expect(treasurerSelect).not.toBeDisabled());
    fireEvent.change(treasurerSelect, { target: { value: "role-build-lead" } });
    expect(onRoleChange).toHaveBeenCalledWith(expect.objectContaining({ id: "treasurer-1" }), "role-build-lead");
  });

  it("fails closed for role creation when the roles list cannot load", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("unavailable", { status: 503 }));
    renderManagement();
    await screen.findByText(/Roles could not be loaded/);
    expect(screen.getByTestId("button-save-custom-role")).toBeDisabled();
  });
});
