import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CAD_ICON_IDS } from "@/lib/cadIcons";
import { CadIconPolicySetting } from "./CadIconPolicySetting";

const mocks = vi.hoisted(() => ({
  enabledIcons: [] as string[],
  loadError: false,
  save: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const { useQuery, useMutation } =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    getGetCadIconPolicyQueryKey: () => ["/api/cad/icon-policy"],
    useGetCadIconPolicy: (options?: {
      query?: Record<string, unknown> & { queryKey?: readonly unknown[] };
    }) => {
      const queryKey = options?.query?.queryKey ?? ["/api/cad/icon-policy"];
      return useQuery({
        queryKey,
        queryFn: async () => {
          if (mocks.loadError) throw new Error("load failed");
          return { enabledIcons: [...mocks.enabledIcons] };
        },
        ...options?.query,
      });
    },
    useUpdateCadIconPolicy: () => useMutation({
      mutationFn: async ({ data }: { data: { enabledIcons: string[] } }) => {
        mocks.save(data);
        mocks.enabledIcons = [...data.enabledIcons];
        return { enabledIcons: [...data.enabledIcons] };
      },
    }),
  };
});

function renderSetting() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CadIconPolicySetting />
    </QueryClientProvider>,
  );
}

describe("CadIconPolicySetting", () => {
  beforeEach(() => {
    mocks.enabledIcons = [...DEFAULT_CAD_ICON_IDS];
    mocks.loadError = false;
    mocks.save.mockReset();
  });

  it("loads the saved choices, keeps them in option order, and saves the result", async () => {
    mocks.enabledIcons = DEFAULT_CAD_ICON_IDS.filter((icon) => icon !== "component");
    renderSetting();

    const componentIcon = await screen.findByTestId("cad-icon-policy-component");
    await waitFor(() => expect(componentIcon).not.toBeChecked());
    // Nothing changed yet, so saving is not offered.
    expect(screen.getByTestId("button-save-cad-icon-policy")).toBeDisabled();

    fireEvent.click(componentIcon);
    expect(screen.getByTestId("button-save-cad-icon-policy")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-save-cad-icon-policy"));

    // The saved list follows CAD_ICON_OPTIONS order, not click order.
    expect(await screen.findByTestId("cad-icon-policy-feedback")).toHaveTextContent("CAD icon choices saved.");
    expect(mocks.save).toHaveBeenCalledWith({ enabledIcons: [...DEFAULT_CAD_ICON_IDS] });
  });

  it("saves a reduced team selection", async () => {
    renderSetting();

    fireEvent.click(await screen.findByTestId("cad-icon-policy-component"));
    fireEvent.click(screen.getByTestId("cad-icon-policy-cpu"));
    fireEvent.click(screen.getByTestId("button-save-cad-icon-policy"));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      enabledIcons: DEFAULT_CAD_ICON_IDS.filter((icon) => icon !== "component" && icon !== "cpu"),
    }));
  });

  it("never allows the team to reach zero icons", async () => {
    mocks.enabledIcons = ["boxes"];
    renderSetting();

    const boxes = await screen.findByTestId("cad-icon-policy-boxes");
    await waitFor(() => expect(boxes).toBeDisabled());
    expect(boxes).toBeChecked();
    expect(screen.getByTestId("button-save-cad-icon-policy")).toBeDisabled();
  });

  it("shows an error instead of the grid when the choices cannot be loaded", async () => {
    mocks.loadError = true;
    renderSetting();

    expect(await screen.findByTestId("cad-icon-policy-error")).toHaveTextContent(
      "Could not load this team's icon choices.",
    );
    expect(screen.queryByTestId("button-save-cad-icon-policy")).toBeDisabled();
  });
});
