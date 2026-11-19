import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useGetFtcGlobeDataMock, globeRendererMock } = vi.hoisted(() => ({
  useGetFtcGlobeDataMock: vi.fn(),
  globeRendererMock: {
    failRenderer: true,
    failRender: false,
    rendererCount: 0,
    renderCount: 0,
    frameCallbacks: [] as FrameRequestCallback[],
    textureRequests: [] as Array<{ url: string; texture: any; succeed: () => void; fail: () => void }>,
  },
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();

  class MockWebGLRenderer {
    domElement = document.createElement("canvas");

    constructor() {
      if (globeRendererMock.failRenderer) throw new Error("WebGL unavailable in this test");
      globeRendererMock.rendererCount += 1;
      this.domElement.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 500,
        width: 500,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    }

    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render() {
      if (globeRendererMock.failRender) throw new Error("render failure");
      globeRendererMock.renderCount += 1;
    }
    dispose() {}
  }

  class MockTextureLoader {
    load(url: string, onLoad?: (texture: InstanceType<typeof actual.Texture>) => void, _progress?: unknown, onError?: () => void) {
      const texture = new actual.Texture();
      globeRendererMock.textureRequests.push({
        url,
        texture,
        succeed: () => onLoad?.(texture),
        fail: () => onError?.(),
      });
      return texture;
    }
  }

  return { ...actual, WebGLRenderer: MockWebGLRenderer, TextureLoader: MockTextureLoader };
});

vi.mock("@workspace/api-client-react", () => ({
  getGetFtcGlobeDataQueryKey: vi.fn(() => ["public", "ftc-globe"]),
  useGetFtcGlobeData: useGetFtcGlobeDataMock,
}));

import {
  clampGlobeZoom,
  createGlobePointerGestureHandlers,
  findGlobePointAtScreen,
  FtcSeasonGlobe,
  GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD,
  MAX_GLOBE_ZOOM,
  getGlobeMarkerZoomScale,
  getGlobeMapTiles,
  getGlobeRotationScale,
  globeMapTileUrl,
  globeMapTileZoom,
  pointPosition,
  rotateGlobeFromDrag,
  shouldUseGlobeCartography,
  shouldUseGlobeDetail,
  wrapGlobeRotation,
} from "./FtcSeasonGlobe";

const teamPoint = {
  id: "team-2026-23442",
  kind: "team" as const,
  season: 2026,
  latitude: 47.5962,
  longitude: -122.0982,
  precision: "city" as const,
  label: "BioBuzz",
  location: "Sammamish, WA, USA",
  teamNumber: 23442,
  eventCode: null,
  schoolName: "Pine Lake Middle School",
  nameShort: "BioBuzz",
  robotName: "Stinger",
  rookieYear: 2010,
  typeName: null,
  venue: null,
  website: "https://example.org/team",
  liveStreamUrl: null,
  dateStart: null,
  dateEnd: null,
};

const eventPoint = {
  id: "event-2026-MASH1",
  kind: "event" as const,
  season: 2026,
  latitude: 42.1237,
  longitude: -71.1787,
  precision: "city" as const,
  label: "Massachusetts FTC Meet",
  location: "Sharon, MA, USA",
  teamNumber: null,
  eventCode: "MASH1",
  schoolName: null,
  nameShort: null,
  robotName: null,
  rookieYear: null,
  typeName: "Qualifier",
  venue: "Sharon High School",
  website: null,
  liveStreamUrl: null,
  dateStart: "2026-11-20T00:00:00",
  dateEnd: "2026-11-20T00:00:00",
};

describe("FTC season globe", () => {
  beforeEach(() => {
    globeRendererMock.failRenderer = true;
    globeRendererMock.failRender = false;
    globeRendererMock.rendererCount = 0;
    globeRendererMock.renderCount = 0;
    globeRendererMock.frameCallbacks.length = 0;
    globeRendererMock.textureRequests.length = 0;
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      globeRendererMock.frameCallbacks.push(callback);
      return globeRendererMock.frameCallbacks.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    useGetFtcGlobeDataMock.mockReturnValue({
      data: {
        season: 2026,
        teamCount: 1,
        eventCount: 1,
        points: [teamPoint, eventPoint],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it("constrains the map stage and details panel within a single-column responsive grid", () => {
    render(<FtcSeasonGlobe />);

    expect(screen.getByTestId("layout-ftc-season-globe")).toHaveClass(
      "min-w-0",
      "grid-cols-1",
      "lg:grid-cols-[minmax(0,1fr)_300px]",
    );
    expect(screen.getByTestId("stage-ftc-season-globe")).toHaveClass("min-w-0", "overflow-hidden");
  });

  it("places east longitudes on the right side of the globe", () => {
    const east = pointPosition({ ...teamPoint, latitude: 0, longitude: 90 }, 1);
    const west = pointPosition({ ...teamPoint, latitude: 0, longitude: -90 }, 1);

    expect(east.x).toBeCloseTo(1);
    expect(east.z).toBeCloseTo(0);
    expect(west.x).toBeCloseTo(-1);
    expect(west.z).toBeCloseTo(0);
  });

  it("keeps the front-facing marker selectable at extreme zoom", () => {
    const root = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.zoom = 200;
    camera.updateProjectionMatrix();

    expect(findGlobePointAtScreen({
      points: [
        { ...teamPoint, latitude: 0, longitude: 0 },
        { ...eventPoint, latitude: 0, longitude: 180 },
      ],
      markerOffsets: new Map(),
      root,
      camera,
      clientX: 210,
      clientY: 220,
      rect: { left: 10, top: 20, width: 400, height: 400 },
    })?.id).toBe(teamPoint.id);
  });

  it("projects markers against the globe's initial explored region", () => {
    const root = new THREE.Group();
    root.rotation.y = THREE.MathUtils.degToRad(95);
    root.rotation.x = 0.52;
    root.updateMatrixWorld(true);
    const localCenter = new THREE.Vector3(0, 0, 1).applyMatrix4(root.matrixWorld.clone().invert());
    const centeredPoint = {
      ...teamPoint,
      latitude: THREE.MathUtils.radToDeg(Math.asin(localCenter.y)),
      longitude: THREE.MathUtils.radToDeg(Math.atan2(localCenter.x, localCenter.z)),
    };
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.zoom = 200;
    camera.updateProjectionMatrix();

    expect(findGlobePointAtScreen({
      points: [centeredPoint],
      markerOffsets: new Map(),
      root,
      camera,
      clientX: 210,
      clientY: 220,
      rect: { left: 10, top: 20, width: 400, height: 400 },
    })?.id).toBe(teamPoint.id);
  });

  it("keeps front-facing markers selectable after crossing either pole", () => {
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.updateProjectionMatrix();

    for (const rotationX of [wrapGlobeRotation(28), wrapGlobeRotation(-28)]) {
      const root = new THREE.Group();
      root.rotation.set(rotationX, 0.8, 0);
      root.updateMatrixWorld(true);
      const localCenter = new THREE.Vector3(0, 0, 1).applyMatrix4(root.matrixWorld.clone().invert());
      const centeredPoint = {
        ...teamPoint,
        latitude: THREE.MathUtils.radToDeg(Math.asin(localCenter.y)),
        longitude: THREE.MathUtils.radToDeg(Math.atan2(localCenter.x, localCenter.z)),
      };

      expect(findGlobePointAtScreen({
        points: [centeredPoint],
        markerOffsets: new Map(),
        root,
        camera,
        clientX: 250,
        clientY: 250,
        rect: { left: 0, top: 0, width: 500, height: 500 },
      })?.id).toBe(teamPoint.id);
    }
  });

  it("shows the selected team's identifiers and profile details", () => {
    render(<FtcSeasonGlobe />);

    fireEvent.click(screen.getByTestId("button-globe-point-team-team-2026-23442"));

    const details = screen.getByTestId("globe-selected-details");
    expect(details).toHaveTextContent("FTC team · 23442");
    expect(details).toHaveTextContent("BioBuzz");
    expect(details).toHaveTextContent("Sammamish, WA, USA");
    expect(details).toHaveTextContent("Stinger");
  });

  it("shows the selected event's code, venue, and dates", () => {
    render(<FtcSeasonGlobe />);

    fireEvent.click(screen.getByTestId("button-globe-point-event-event-2026-MASH1"));

    const details = screen.getByTestId("globe-selected-details");
    expect(details).toHaveTextContent("Competition event · MASH1");
    expect(details).toHaveTextContent("Massachusetts FTC Meet");
    expect(details).toHaveTextContent("Sharon High School");
    expect(details).toHaveTextContent("Nov 20, 2026");
  });

  it("credits the map and coordinate data sources", () => {
    render(<FtcSeasonGlobe />);

    expect(screen.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    expect(screen.getByRole("link", { name: "OpenStreetMap Deutschland" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.de/",
    );
    expect(screen.getByRole("link", { name: "GeoNames" })).toHaveAttribute(
      "href",
      "https://www.geonames.org/",
    );
    expect(screen.getByRole("link", { name: "Natural Earth" })).toHaveAttribute(
      "href",
      "https://www.naturalearthdata.com/",
    );
  });

  it("provides accessible zoom controls and reset behavior", () => {
    render(<FtcSeasonGlobe />);

    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("120 percent");
    const zoomIn = screen.getByRole("button", { name: "Zoom in on globe" });
    fireEvent.click(zoomIn);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("140 percent");

    const reset = screen.getByRole("button", { name: "Reset globe zoom" });
    while (!zoomIn.hasAttribute("disabled")) fireEvent.click(zoomIn);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("20000 percent");
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("Limits 75 to 20000 percent.");
    expect(zoomIn).toBeDisabled();
    expect(reset).toBeEnabled();

    fireEvent.click(reset);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("100 percent");

    const zoomOut = screen.getByRole("button", { name: "Zoom out of globe" });
    while (!zoomOut.hasAttribute("disabled")) fireEvent.click(zoomOut);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("75 percent");
    expect(zoomOut).toBeDisabled();
  });

  it("shows a usable map fallback when WebGL cannot start", () => {
    render(<FtcSeasonGlobe />);

    expect(screen.getByTestId("image-globe-fallback")).toBeVisible();
    expect(screen.getByTestId("status-globe-renderer")).toHaveTextContent(
      "Interactive rendering is unavailable",
    );
    expect(screen.getByTestId("button-globe-point-team-team-2026-23442")).toBeEnabled();
  });

  it("falls back after a base texture failure and recreates the renderer after context restoration", () => {
    globeRendererMock.failRenderer = false;
    const { getByTestId, queryByTestId } = render(<FtcSeasonGlobe />);
    expect(globeRendererMock.rendererCount).toBe(1);

    const baseTexture = globeRendererMock.textureRequests.find((request) => request.url.includes("ftc-globe-world.svg"));
    expect(baseTexture).toBeDefined();
    act(() => baseTexture!.fail());
    expect(getByTestId("image-globe-fallback")).toBeVisible();
    expect(getByTestId("status-globe-renderer")).toHaveTextContent("globe texture could not load");

    const canvas = getByTestId("stage-ftc-season-globe").querySelector("canvas");
    expect(canvas).not.toBeNull();
    act(() => canvas!.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
    expect(getByTestId("status-globe-renderer")).toHaveTextContent("renderer stopped unexpectedly");
    act(() => canvas!.dispatchEvent(new Event("webglcontextrestored")));

    expect(globeRendererMock.rendererCount).toBe(2);
    expect(queryByTestId("image-globe-fallback")).not.toBeInTheDocument();
  });

  it("shows the map fallback if a WebGL render call fails", () => {
    globeRendererMock.failRenderer = false;
    globeRendererMock.failRender = true;
    render(<FtcSeasonGlobe />);

    act(() => globeRendererMock.frameCallbacks.shift()?.(0));
    expect(screen.getByTestId("image-globe-fallback")).toBeVisible();
    expect(screen.getByTestId("status-globe-renderer")).toHaveTextContent("The globe could not render");
  });

  it("keeps one renderer and reuses delayed detail textures across zoom cycles", () => {
    globeRendererMock.failRenderer = false;
    const { unmount, getByTestId } = render(<FtcSeasonGlobe />);
    expect(getByTestId("stage-ftc-season-globe").querySelector("canvas")).toHaveStyle({
      touchAction: "pan-y",
    });

    const zoomIn = screen.getByRole("button", { name: "Zoom in on globe" });
    while (Number(screen.getByTestId("status-globe-zoom").textContent?.match(/\d+/)?.[0]) < 420) {
      fireEvent.click(zoomIn);
    }
    fireEvent.click(screen.getByTestId("button-globe-point-team-team-2026-23442"));
    expect(globeRendererMock.rendererCount).toBe(1);
    const boundaryRequests = globeRendererMock.textureRequests.filter((request) =>
      request.url.includes("ftc-globe-boundaries-10m.svg"),
    );
    const cityRequests = globeRendererMock.textureRequests.filter((request) =>
      request.url.includes("ftc-globe-hydrography-cities.svg"),
    );
    expect(boundaryRequests).toHaveLength(1);
    expect(cityRequests).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset globe zoom" }));
    const boundaryDispose = vi.spyOn(boundaryRequests[0].texture, "dispose");
    act(() => {
      boundaryRequests[0].succeed();
      cityRequests[0].succeed();
    });
    while (Number(screen.getByTestId("status-globe-zoom").textContent?.match(/\d+/)?.[0]) < 420) {
      fireEvent.click(zoomIn);
    }
    fireEvent.click(screen.getByRole("button", { name: "Reset globe zoom" }));
    while (Number(screen.getByTestId("status-globe-zoom").textContent?.match(/\d+/)?.[0]) < 420) {
      fireEvent.click(zoomIn);
    }

    expect(globeRendererMock.rendererCount).toBe(1);
    expect(globeRendererMock.textureRequests.filter((request) => request.url.includes("ftc-globe-boundaries-10m.svg"))).toHaveLength(1);
    expect(boundaryDispose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out of globe" }));
    expect(boundaryDispose).not.toHaveBeenCalled();
    unmount();
    expect(boundaryDispose).toHaveBeenCalledTimes(1);
  });

  it("reports detail texture failures and retries after leaving close-up mode", () => {
    globeRendererMock.failRenderer = false;
    render(<FtcSeasonGlobe />);
    const zoomIn = screen.getByRole("button", { name: "Zoom in on globe" });
    while (Number(screen.getByTestId("status-globe-zoom").textContent?.match(/\d+/)?.[0]) < 260) {
      fireEvent.click(zoomIn);
    }
    const firstRequest = globeRendererMock.textureRequests.find((request) =>
      request.url.includes("ftc-globe-boundaries-10m.svg"),
    );
    expect(firstRequest).toBeDefined();
    act(() => firstRequest!.fail());
    expect(screen.getByTestId("status-globe-renderer")).toHaveTextContent(
      "Close-up boundaries could not load",
    );
    expect(screen.queryByTestId("image-globe-fallback")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset globe zoom" }));
    while (Number(screen.getByTestId("status-globe-zoom").textContent?.match(/\d+/)?.[0]) < 260) {
      fireEvent.click(zoomIn);
    }
    expect(globeRendererMock.textureRequests.filter((request) =>
      request.url.includes("ftc-globe-boundaries-10m.svg"),
    )).toHaveLength(2);
  });

  it("loads high-zoom map tiles progressively and keeps the overview usable on tile failure", async () => {
    globeRendererMock.failRenderer = false;
    render(<FtcSeasonGlobe />);
    const zoomIn = screen.getByRole("button", { name: "Zoom in on globe" });
    expect(globeRendererMock.textureRequests.some((request) =>
      request.url.includes("tile.openstreetmap.de"),
    )).toBe(false);

    while (Number(screen.getByTestId("status-globe-zoom").textContent?.match(/\d+/)?.[0]) < 420) {
      fireEvent.click(zoomIn);
    }
    await waitFor(() => expect(globeRendererMock.textureRequests.some((request) =>
      request.url.includes("tile.openstreetmap.de"),
    )).toBe(true));
    const lightTile = globeRendererMock.textureRequests.find((request) =>
      request.url.includes("tile.openstreetmap.de"),
    );
    expect(lightTile).toBeDefined();
    const failedTileUrl = lightTile!.url;
    expect(screen.queryByTestId("image-globe-fallback")).not.toBeInTheDocument();

    act(() => lightTile!.fail());
    expect(screen.getByTestId("status-globe-renderer")).toHaveTextContent(
      "Some close-up map tiles could not load",
    );
    expect(screen.queryByTestId("image-globe-fallback")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-globe-point-team-team-2026-23442")).toBeEnabled();

    let requestIndex = 0;
    act(() => {
      while (requestIndex < globeRendererMock.textureRequests.length) {
        const request = globeRendererMock.textureRequests[requestIndex++];
        if (request.url.includes("tile.openstreetmap.de") && request !== lightTile) request.succeed();
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset globe zoom" }));
    await new Promise((resolve) => setTimeout(resolve, 450));
    while (Number(screen.getByTestId("status-globe-zoom").textContent?.match(/\d+/)?.[0]) < 420) {
      fireEvent.click(zoomIn);
    }
    await waitFor(() => expect(
      globeRendererMock.textureRequests.filter((request) => request.url === failedTileUrl),
    ).toHaveLength(2));
  });

  it("stops rendering every frame when rotation is paused", () => {
    globeRendererMock.failRenderer = false;
    render(<FtcSeasonGlobe />);
    expect(globeRendererMock.frameCallbacks).toHaveLength(1);

    act(() => globeRendererMock.frameCallbacks.shift()?.(0));
    expect(globeRendererMock.renderCount).toBe(1);
    expect(globeRendererMock.frameCallbacks).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Pause globe rotation" }));
    act(() => globeRendererMock.frameCallbacks.shift()?.(16));
    expect(globeRendererMock.frameCallbacks).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in on globe" }));
    expect(globeRendererMock.frameCallbacks).toHaveLength(1);
    act(() => globeRendererMock.frameCallbacks.shift()?.(32));
    expect(globeRendererMock.renderCount).toBe(3);
    expect(globeRendererMock.frameCallbacks).toHaveLength(0);
  });

  it("zooms in and out with two-finger pinches without rotating or selecting", () => {
    const onRotate = vi.fn();
    const onSelect = vi.fn();
    let zoom = 1.2;
    const gestures = createGlobePointerGestureHandlers({
      onRotate,
      onSelect,
      onZoom: (scale) => { zoom = clampGlobeZoom(zoom * scale); },
    });
    const touch = (pointerId: number, clientX: number) => ({
      pointerId,
      pointerType: "touch",
      clientX,
      clientY: 100,
    });

    gestures.pointerDown(touch(1, 100));
    gestures.pointerDown(touch(2, 200));
    gestures.pointerMove(touch(2, 300));
    expect(zoom).toBeCloseTo(2.4);
    gestures.pointerUp(touch(1, 100));
    gestures.pointerUp(touch(2, 300));

    gestures.pointerDown(touch(3, 100));
    gestures.pointerDown(touch(4, 200));
    gestures.pointerMove(touch(4, 150));
    expect(zoom).toBeCloseTo(1.2);
    gestures.pointerUp(touch(3, 100));
    gestures.pointerUp(touch(4, 150));

    expect(onRotate).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clamps zoom to the minimum and expanded maximum", () => {
    expect(MAX_GLOBE_ZOOM).toBe(200);
    expect(clampGlobeZoom(201.2)).toBe(200);
    expect(clampGlobeZoom(1.2 - 20)).toBe(0.75);
    expect(shouldUseGlobeDetail(1.2)).toBe(false);
    expect(shouldUseGlobeDetail(2.39)).toBe(false);
    expect(shouldUseGlobeDetail(2.4)).toBe(true);
    expect(shouldUseGlobeCartography(GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD - 0.01)).toBe(false);
    expect(shouldUseGlobeCartography(GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD)).toBe(true);
    expect(shouldUseGlobeCartography(200)).toBe(true);
  });

  it("selects progressively sharper globe tiles and wraps across the date line", () => {
    expect(globeMapTileZoom(1.2)).toBe(4);
    expect(globeMapTileZoom(4)).toBe(5);
    expect(globeMapTileZoom(200)).toBe(11);
    const tiles = getGlobeMapTiles(179.9, 0, 200, 1.4);
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.length).toBeLessThanOrEqual(81);
    expect(tiles.some((tile) => tile.x === 0)).toBe(true);
    expect(tiles.some((tile) => tile.x === 2 ** tile.z - 1)).toBe(true);
    expect(globeMapTileUrl(tiles[0])).toContain("tile.openstreetmap.de/11/");
  });

  it("wraps globe angles without changing their orientation", () => {
    expect(wrapGlobeRotation(20)).toBeCloseTo(20 - 3 * Math.PI * 2);
    expect(wrapGlobeRotation(-20)).toBeCloseTo(-20 + 3 * Math.PI * 2);
    expect(wrapGlobeRotation(0.4)).toBeCloseTo(0.4);
    expect(wrapGlobeRotation(20)).toBeGreaterThan(-Math.PI);
    expect(wrapGlobeRotation(20)).toBeLessThanOrEqual(Math.PI);
  });

  it("rotates continuously through multiple upward and downward turns", () => {
    const root = new THREE.Group();
    const onSelect = vi.fn();
    const gestures = createGlobePointerGestureHandlers({
      onRotate: (deltaX, deltaY) => rotateGlobeFromDrag(root, deltaX, deltaY),
      onZoom: vi.fn(),
      onSelect,
    });
    let pointerId = 0;
    const drag = (direction: -1 | 1) => {
      const id = ++pointerId;
      gestures.pointerDown({
        pointerId: id,
        pointerType: "mouse",
        clientX: 100,
        clientY: 100,
      });
      for (let step = 1; step <= 7; step += 1) {
        gestures.pointerMove({
          pointerId: id,
          pointerType: "mouse",
          clientX: 100,
          clientY: 100 + direction * step * 1000,
        });
      }
      gestures.pointerUp({
        pointerId: id,
        pointerType: "mouse",
        clientX: 100,
        clientY: 100 + direction * 7000,
      });
    };

    drag(1);
    expect(root.rotation.x).toBeCloseTo(wrapGlobeRotation(28));
    expect(root.rotation.x).toBeGreaterThan(1.2);
    drag(-1);
    expect(root.rotation.x).toBeCloseTo(0);
    drag(-1);
    expect(root.rotation.x).toBeCloseTo(wrapGlobeRotation(-28));
    expect(root.rotation.x).toBeLessThan(-1.2);

    for (let turn = 0; turn < 25; turn += 1) {
      drag(1);
      drag(-1);
    }
    expect(root.rotation.x).toBeCloseTo(wrapGlobeRotation(-28));
    expect(Number.isFinite(root.rotation.x)).toBe(true);
    expect(Math.abs(root.rotation.x)).toBeLessThanOrEqual(Math.PI);
    expect(onSelect).not.toHaveBeenCalled();

    rotateGlobeFromDrag(root, 700, 0);
    expect(root.rotation.y).toBeCloseTo(wrapGlobeRotation(4.2));
  });

  it("keeps FTC markers readable without growing over close-up map details", () => {
    expect(getGlobeMarkerZoomScale(1.2)).toBeCloseTo(1.5);
    expect(getGlobeMarkerZoomScale(200)).toBeCloseTo(0.009);
    expect(getGlobeMarkerZoomScale(0.1)).toBeCloseTo(2.4);
  });

  it("reduces rotation sensitivity during close-up exploration", () => {
    expect(getGlobeRotationScale(1.2)).toBeCloseTo(1);
    expect(getGlobeRotationScale(200)).toBeCloseTo(0.006);
  });

  it("keeps pinch zoom bounded across the expanded range", () => {
    let zoom = 9.9;
    const gestures = createGlobePointerGestureHandlers({
      onRotate: vi.fn(),
      onSelect: vi.fn(),
      onZoom: (scale) => { zoom = clampGlobeZoom(zoom * scale); },
    });
    const touch = (pointerId: number, clientX: number) => ({
      pointerId,
      pointerType: "touch",
      clientX,
      clientY: 100,
    });

    gestures.pointerDown(touch(1, 100));
    gestures.pointerDown(touch(2, 200));
    gestures.pointerMove(touch(2, 300));
    expect(zoom).toBeCloseTo(19.8);
    gestures.pointerMove(touch(2, 600));
    gestures.pointerMove(touch(2, 1000));
    gestures.pointerMove(touch(2, 1800));
    gestures.pointerMove(touch(2, 3500));
    expect(zoom).toBe(200);
    gestures.pointerUp(touch(1, 100));
    gestures.pointerUp(touch(2, 300));

    zoom = 1;
    gestures.pointerDown(touch(3, 100));
    gestures.pointerDown(touch(4, 200));
    gestures.pointerMove(touch(4, 100));
    expect(zoom).toBe(0.75);
  });

  it("ships sparse Natural Earth city and waterbody details for close views", () => {
    const cartography = readFileSync(
      resolve(process.cwd(), "public/ftc-globe-hydrography-cities.svg"),
      "utf8",
    );

    expect(cartography).toContain("Natural Earth major lakes, rivers, and city labels");
    expect(cartography).toContain('data-kind="city" data-name="Tokyo"');
    expect(cartography).toContain('data-kind="lake"');
    expect(cartography).toContain('data-kind="river"');
    expect(cartography.match(/data-kind="city"/g)).toHaveLength(50);
  });

  it("keeps one-finger touch drag and tap separate from pinching", () => {
    const onRotate = vi.fn();
    const onZoom = vi.fn();
    const onSelect = vi.fn();
    const gestures = createGlobePointerGestureHandlers({ onRotate, onZoom, onSelect });
    const touch = (pointerId: number, clientX: number) => ({
      pointerId,
      pointerType: "touch",
      clientX,
      clientY: 100,
    });

    gestures.pointerDown(touch(1, 100));
    gestures.pointerMove(touch(1, 120));
    gestures.pointerUp(touch(1, 120));
    expect(onRotate).toHaveBeenCalledWith(20, 0);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onZoom).not.toHaveBeenCalled();

    gestures.pointerDown(touch(2, 100));
    gestures.pointerUp(touch(2, 100));
    expect(onSelect).toHaveBeenCalledWith(100, 100);
  });

  it("promotes the platform with working signup and product links", () => {
    render(<FtcSeasonGlobe />);

    expect(screen.getByTestId("card-ftc-platform-promo")).toHaveTextContent("team chat");
    expect(screen.getByTestId("link-ftc-platform-signup")).toHaveAttribute("href", "/auth?createTeam=1");
    expect(screen.getByTestId("link-ftc-platform-capabilities")).toHaveAttribute("href", "#capabilities");
  });
});
