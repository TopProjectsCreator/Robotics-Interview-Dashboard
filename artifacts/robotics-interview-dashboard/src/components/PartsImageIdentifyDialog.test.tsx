import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identify: vi.fn(),
  save: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useIdentifyPartsImage: () => ({ mutateAsync: mocks.identify, isPending: false }),
}));

import { PartsImageIdentifyDialog } from "./PartsImageIdentifyDialog";

const vendors = [{
  key: "andymark",
  name: "AndyMark",
  group: "General Parts",
  website: "https://www.andymark.com",
  catalogMode: "products",
  catalogSourceUrl: "https://www.andymark.com",
  coverageState: "discovery_only",
  lastSync: null,
}] as const;

const identifiedPart = {
  identified: true,
  name: "Aluminum channel",
  category: "Structure",
  description: "Extruded aluminum profile.",
  sku: "CH-42",
  uncertainty: "medium",
  uncertaintyReason: "The exact profile series is not visible.",
};

const frameBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x42]);

function createStream(deviceId = "camera-one") {
  let endedListener: EventListener | undefined;
  const track = {
    stop: vi.fn(),
    getSettings: () => ({ deviceId }),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "ended") endedListener = listener;
    }),
    removeEventListener: vi.fn(() => {
      endedListener = undefined;
    }),
  } as unknown as MediaStreamTrack;
  return {
    stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream,
    track,
    endVideo: () => endedListener?.(new Event("ended")),
  };
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <PartsImageIdentifyDialog
        open
        onOpenChange={mocks.onOpenChange}
        vendors={[...vendors]}
        saving={false}
        onSave={mocks.save}
      />
    </QueryClientProvider>,
  );
  return result;
}

async function waitForCamera() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /capture and identify|scan next part|retry identification/i })).toBeEnabled();
  });
}

async function captureWithButton() {
  const button = screen.getByRole("button", { name: /capture and identify|scan next part|retry identification/i });
  fireEvent.click(button);
}

let getUserMedia: ReturnType<typeof vi.fn>;
let enumerateDevices: ReturnType<typeof vi.fn>;
let mediaDevicesDescriptor: PropertyDescriptor | undefined;
let trackFixture: ReturnType<typeof createStream>;

beforeEach(() => {
  mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  trackFixture = createStream();
  getUserMedia = vi.fn().mockResolvedValue(trackFixture.stream);
  enumerateDevices = vi.fn().mockResolvedValue([
    { kind: "videoinput", deviceId: "camera-one", label: "Front camera" },
    { kind: "videoinput", deviceId: "camera-two", label: "USB camera" },
    { kind: "audioinput", deviceId: "microphone-one", label: "Microphone" },
  ]);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, enumerateDevices },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D & GPUCanvasContext);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob([frameBytes], { type: "image/jpeg" }));
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, value: 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, value: 480 });
  mocks.identify.mockResolvedValue(identifiedPart);
  mocks.save.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

describe("Parts live-camera identification", () => {
  it("requests camera access when opened, shows a live preview, and stops the stream on close and unmount", async () => {
    const { unmount } = renderDialog();

    await waitForCamera();
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    expect(screen.getByLabelText("Live camera preview")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload photo/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(trackFixture.track.stop).toHaveBeenCalledTimes(1);
    unmount();
    expect(trackFixture.track.stop).toHaveBeenCalledTimes(1);
  });

  it("lists available cameras after permission and stops the current stream before switching", async () => {
    const replacement = createStream("camera-two");
    renderDialog();
    await waitForCamera();

    const cameraSelect = screen.getByRole("combobox", { name: "Camera" });
    expect(enumerateDevices).toHaveBeenCalled();
    expect(cameraSelect).toHaveValue("camera-one");
    expect(screen.getByRole("option", { name: "Front camera" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "USB camera" })).toBeInTheDocument();

    getUserMedia.mockImplementationOnce(() => {
      expect(trackFixture.track.stop).toHaveBeenCalledTimes(1);
      return Promise.resolve(replacement.stream);
    });
    fireEvent.change(cameraSelect, { target: { value: "camera-two" } });

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({
        video: { deviceId: { exact: "camera-two" } },
        audio: false,
      });
      expect(cameraSelect).toHaveValue("camera-two");
    });
    await waitForCamera();
    await captureWithButton();
    expect(await screen.findByDisplayValue("Aluminum channel")).toBeInTheDocument();
    expect(mocks.identify).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(replacement.track.stop).toHaveBeenCalledTimes(1);
  });

  it("captures a bounded JPEG and immediately submits it without saving inventory", async () => {
    renderDialog();
    await waitForCamera();

    await captureWithButton();
    await screen.findByDisplayValue("Aluminum channel");
    expect(mocks.identify).toHaveBeenCalledWith({
      data: { contentType: "image/jpeg", imageBase64: "/9j/Qg==" },
    });
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.82);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText(/Visual suggestion · medium uncertainty/)).toBeInTheDocument();
  });

  it("supports Space and Enter for repeated scans, ignores form fields, and resets review data", async () => {
    mocks.identify
      .mockResolvedValueOnce(identifiedPart)
      .mockResolvedValueOnce({ ...identifiedPart, name: "Gearbox housing", sku: null });
    renderDialog();
    await waitForCamera();

    fireEvent.keyDown(document, { key: " " });
    await screen.findByDisplayValue("Aluminum channel");
    const nameInput = screen.getByLabelText("Part name *");
    fireEvent.change(nameInput, { target: { value: "Edited old part" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });
    fireEvent.keyDown(nameInput, { key: " " });
    expect(mocks.identify).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Supplier *"), { target: { value: "andymark" } });
    fireEvent.keyDown(document, { key: "Enter" });
    await screen.findByDisplayValue("Gearbox housing");
    expect(mocks.identify).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Supplier *")).toHaveValue("");
    expect(screen.getByLabelText("Owned quantity *")).toHaveValue(0);
    expect(screen.queryByDisplayValue("Edited old part")).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("allows explicit save only after reviewing the latest suggestion", async () => {
    renderDialog();
    await waitForCamera();
    await captureWithButton();
    await screen.findByDisplayValue("Aluminum channel");
    expect(mocks.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Part name *"), { target: { value: "Edited channel" } });
    fireEvent.change(screen.getByLabelText("Supplier *"), { target: { value: "andymark" } });
    fireEvent.change(screen.getByLabelText("Owned quantity *"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed part" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      name: "Edited channel",
      vendorKey: "andymark",
      sku: "CH-42",
      category: "Structure",
      description: "Extruded aluminum profile.",
      quantityOwned: 6,
    }));
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps analysis failures retryable with a new frame and offers manual entry", async () => {
    mocks.identify
      .mockRejectedValueOnce(new Error("Vision service unavailable"))
      .mockResolvedValueOnce(identifiedPart);
    renderDialog();
    await waitForCamera();

    await captureWithButton();
    expect(await screen.findByRole("alert")).toHaveTextContent("Vision service unavailable");
    expect(screen.getByRole("button", { name: "Retry identification" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue in manual entry" })).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();

    await captureWithButton();
    expect(await screen.findByDisplayValue("Aluminum channel")).toBeInTheDocument();
    expect(screen.queryByText(/Vision service unavailable/)).not.toBeInTheDocument();
    expect(mocks.identify).toHaveBeenCalledTimes(2);
  });

  it("explains denied camera permission and allows manual entry without adding a part automatically", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" }));
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("Allow camera access in your browser’s site settings");
    expect(screen.getByRole("button", { name: "Try camera again" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue in manual entry" }));
    expect(await screen.findByText("Manual part details")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Part name *"), { target: { value: "Hand-entered bracket" } });
    fireEvent.change(screen.getByLabelText("Supplier *"), { target: { value: "andymark" } });
    fireEvent.change(screen.getByLabelText("Owned quantity *"), { target: { value: "2" } });
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed part" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      name: "Hand-entered bracket",
      vendorKey: "andymark",
      sku: "",
      category: "",
      description: "",
      quantityOwned: 2,
    }));
  });

  it("explains when no camera device is available and allows a camera retry", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("No device"), { name: "NotFoundError" }));
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("No camera was found");
    fireEvent.click(screen.getByRole("button", { name: "Try camera again" }));
    await waitForCamera();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("No camera was found")).not.toBeInTheDocument();
  });

  it("recovers when the active camera disconnects", async () => {
    const replacement = createStream();
    getUserMedia
      .mockResolvedValueOnce(trackFixture.stream)
      .mockResolvedValueOnce(replacement.stream);
    renderDialog();
    await waitForCamera();

    await act(async () => trackFixture.endVideo());
    expect(await screen.findByRole("alert")).toHaveTextContent("The camera stopped unexpectedly");
    expect(trackFixture.track.stop).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Try camera again" }));
    await waitForCamera();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/camera stopped unexpectedly/i)).not.toBeInTheDocument();
  });

  it("explains unsupported camera access and still exposes manual entry", async () => {
    Reflect.deleteProperty(navigator, "mediaDevices");
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("This browser cannot access a live camera");
    expect(screen.getByRole("button", { name: "Continue in manual entry" })).toBeInTheDocument();
    expect(mocks.identify).not.toHaveBeenCalled();
  });
});
