import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartsOrderLimitSetting } from "./PartsOrderLimitSetting";

const mocks = vi.hoisted(() => ({
  settings: new Map<string, number | null>(),
  save: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const { useQuery, useMutation } =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    getGetPartsOrderSettingsQueryKey: () => ["/parts/order-settings"],
    useGetPartsOrderSettings: (options?: {
      query?: Record<string, unknown> & { queryKey?: readonly unknown[] };
    }) => {
      const queryKey = options?.query?.queryKey ?? ["/parts/order-settings"];
      const teamId = String(queryKey.at(-1));
      return useQuery({
        queryKey,
        queryFn: async () => ({ maxOrderItems: mocks.settings.get(teamId) ?? null }),
        ...options?.query,
      });
    },
    useUpdatePartsOrderSettings: () => useMutation({
      mutationFn: async ({ data }: { data: { maxOrderItems: number | null } }) => {
        mocks.save(data);
        const teamId = "team-a";
        mocks.settings.set(teamId, data.maxOrderItems);
        return { maxOrderItems: data.maxOrderItems };
      },
    }),
  };
});

function renderSetting(teamId = "team-a") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PartsOrderLimitSetting teamId={teamId} />
    </QueryClientProvider>,
  );
}

describe("PartsOrderLimitSetting", () => {
  beforeEach(() => {
    mocks.settings.clear();
    mocks.save.mockReset();
  });

  it("loads a saved team limit, saves it, and supports the unlimited state", async () => {
    mocks.settings.set("team-a", 12);
    const view = renderSetting();
    const input = await screen.findByRole("spinbutton", { name: "Maximum order-tray items" });
    expect(input).toHaveValue(12);
    expect(view.container).toHaveTextContent("counts each line’s quantity");
    expect(input.className).toContain("dark:bg-[#0f1e27]");
    expect(input.className).toContain("bg-white");

    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save limit" }));
    await screen.findByText("Order-tray limit saved.");
    expect(mocks.save).toHaveBeenCalledWith({ maxOrderItems: 20 });
    expect(mocks.settings.get("team-a")).toBe(20);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save limit" }));
    await screen.findByText("Order-tray limit removed.");
    expect(mocks.save).toHaveBeenLastCalledWith({ maxOrderItems: null });
  });

  it("rejects fractional values and keeps settings isolated by team", async () => {
    mocks.settings.set("team-a", 5);
    const teamA = renderSetting("team-a");
    const inputA = await screen.findByRole("spinbutton", { name: "Maximum order-tray items" });
    fireEvent.change(inputA, { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save limit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("whole number");
    expect(mocks.save).not.toHaveBeenCalled();
    teamA.unmount();

    renderSetting("team-b");
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Maximum order-tray items" })).toHaveProperty("value", ""));
  });
});
