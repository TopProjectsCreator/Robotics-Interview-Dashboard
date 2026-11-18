import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CAD_ICON_IDS } from "@/lib/cadIcons";
import { CadIconSettings } from "./CadIconSettings";

const mocks = vi.hoisted(() => ({
  getIconPolicy: vi.fn(),
  updateIconPolicy: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetCadIconPolicyQueryKey: () => ["/api/cad/icon-policy"],
  useGetCadIconPolicy: mocks.getIconPolicy,
  updateCadIconPolicy: mocks.updateIconPolicy,
}));

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CadIconSettings />
    </QueryClientProvider>,
  );
}

describe("CadIconSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIconPolicy.mockReturnValue({
      data: { enabledIcons: [...DEFAULT_CAD_ICON_IDS] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.updateIconPolicy.mockResolvedValue({ enabledIcons: [...DEFAULT_CAD_ICON_IDS] });
  });

  it("saves the selected icon set from Settings", async () => {
    renderSettings();

    const componentIcon = screen.getByTestId("cad-icon-policy-component");
    expect(componentIcon).toBeChecked();
    fireEvent.click(componentIcon);
    fireEvent.click(screen.getByTestId("button-save-cad-icon-policy"));

    await waitFor(() => expect(mocks.updateIconPolicy).toHaveBeenCalledWith({
      enabledIcons: DEFAULT_CAD_ICON_IDS.filter((icon) => icon !== "component"),
    }));
    expect(await screen.findByTestId("cad-icon-policy-saved")).toHaveTextContent("CAD icon choices saved.");
  });

  it("lets coordinators enable and save a newly added icon", async () => {
    const originalIcons = DEFAULT_CAD_ICON_IDS.slice(0, 12);
    mocks.getIconPolicy.mockReturnValue({
      data: { enabledIcons: [...originalIcons] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderSettings();

    const joystick = screen.getByTestId("cad-icon-policy-joystick");
    expect(joystick).not.toBeChecked();
    fireEvent.click(joystick);
    fireEvent.click(screen.getByTestId("button-save-cad-icon-policy"));

    await waitFor(() => expect(mocks.updateIconPolicy).toHaveBeenCalledWith({
      enabledIcons: [...originalIcons, "joystick"],
    }));
  });

  it("does not allow the last icon to be removed", () => {
    mocks.getIconPolicy.mockReturnValue({
      data: { enabledIcons: ["boxes"] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderSettings();

    expect(screen.getByTestId("cad-icon-policy-boxes")).toBeDisabled();
  });
});
