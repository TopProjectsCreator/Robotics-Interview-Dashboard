import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useGetFtcGlobeDataMock } = vi.hoisted(() => ({
  useGetFtcGlobeDataMock: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetFtcGlobeDataQueryKey: vi.fn(() => ["public", "ftc-globe"]),
  useGetFtcGlobeData: useGetFtcGlobeDataMock,
}));

import {
  clampGlobeTilt,
  clampGlobeZoom,
  createGlobePointerGestureHandlers,
  FtcSeasonGlobe,
  GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD,
  MAX_GLOBE_ZOOM,
  getGlobeMarkerZoomScale,
  pointPosition,
  shouldUseGlobeCartography,
  shouldUseGlobeDetail,
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

  it("places east longitudes on the right side of the globe", () => {
    const east = pointPosition({ ...teamPoint, latitude: 0, longitude: 90 }, 1);
    const west = pointPosition({ ...teamPoint, latitude: 0, longitude: -90 }, 1);

    expect(east.x).toBeCloseTo(1);
    expect(east.z).toBeCloseTo(0);
    expect(west.x).toBeCloseTo(-1);
    expect(west.z).toBeCloseTo(0);
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

  it("provides accessible zoom controls and reset behavior", () => {
    render(<FtcSeasonGlobe />);

    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("120 percent");
    const zoomIn = screen.getByRole("button", { name: "Zoom in on globe" });
    fireEvent.click(zoomIn);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("140 percent");

    const reset = screen.getByRole("button", { name: "Reset globe zoom" });
    while (!zoomIn.hasAttribute("disabled")) fireEvent.click(zoomIn);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("1000 percent");
    expect(zoomIn).toBeDisabled();
    expect(reset).toBeEnabled();

    fireEvent.click(reset);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("100 percent");

    const zoomOut = screen.getByRole("button", { name: "Zoom out of globe" });
    while (!zoomOut.hasAttribute("disabled")) fireEvent.click(zoomOut);
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("75 percent");
    expect(zoomOut).toBeDisabled();
  });

  it("zooms in and out with two-finger pinches without rotating or selecting", () => {
    const onRotate = vi.fn();
    const onSelect = vi.fn();
    let zoom = 1.2;
    const gestures = createGlobePointerGestureHandlers({
      onRotate,
      onSelect,
      onZoom: (delta) => { zoom = clampGlobeZoom(zoom + delta); },
    });
    const touch = (pointerId: number, clientX: number) => ({
      pointerId,
      pointerType: "touch",
      clientX,
      clientY: 100,
    });

    gestures.pointerDown(touch(1, 100));
    gestures.pointerDown(touch(2, 200));
    gestures.pointerMove(touch(2, 240));
    expect(zoom).toBeCloseTo(1.4);
    gestures.pointerUp(touch(1, 100));
    gestures.pointerUp(touch(2, 240));

    gestures.pointerDown(touch(3, 100));
    gestures.pointerDown(touch(4, 200));
    gestures.pointerMove(touch(4, 160));
    expect(zoom).toBeCloseTo(1.2);
    gestures.pointerUp(touch(3, 100));
    gestures.pointerUp(touch(4, 160));

    expect(onRotate).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clamps zoom to the minimum and expanded maximum", () => {
    expect(MAX_GLOBE_ZOOM).toBe(10);
    expect(clampGlobeZoom(1.2 + 20)).toBe(10);
    expect(clampGlobeZoom(1.2 - 20)).toBe(0.75);
    expect(shouldUseGlobeDetail(1.2)).toBe(false);
    expect(shouldUseGlobeDetail(2.39)).toBe(false);
    expect(shouldUseGlobeDetail(2.4)).toBe(true);
    expect(shouldUseGlobeCartography(GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD - 0.01)).toBe(false);
    expect(shouldUseGlobeCartography(GLOBE_CARTOGRAPHY_ZOOM_THRESHOLD)).toBe(true);
    expect(shouldUseGlobeCartography(10)).toBe(true);
  });

  it("keeps globe tilt bounded while allowing higher-latitude exploration", () => {
    expect(clampGlobeTilt(20)).toBeCloseTo(1.2);
    expect(clampGlobeTilt(-20)).toBeCloseTo(-1.2);
    expect(clampGlobeTilt(0.4)).toBeCloseTo(0.4);
  });

  it("keeps FTC markers readable without growing over close-up map details", () => {
    expect(getGlobeMarkerZoomScale(1.2)).toBeCloseTo(1.5);
    expect(getGlobeMarkerZoomScale(10)).toBeCloseTo(0.18);
    expect(getGlobeMarkerZoomScale(0.1)).toBeCloseTo(2.4);
  });

  it("keeps pinch zoom bounded across the expanded range", () => {
    let zoom = 9.9;
    const gestures = createGlobePointerGestureHandlers({
      onRotate: vi.fn(),
      onSelect: vi.fn(),
      onZoom: (delta) => { zoom = clampGlobeZoom(zoom + delta); },
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
    expect(zoom).toBe(10);
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
