import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useGetFtcGlobeDataMock } = vi.hoisted(() => ({
  useGetFtcGlobeDataMock: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetFtcGlobeDataQueryKey: vi.fn(() => ["public", "ftc-globe"]),
  useGetFtcGlobeData: useGetFtcGlobeDataMock,
}));

import { FtcSeasonGlobe } from "./FtcSeasonGlobe";

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
    fireEvent.click(screen.getByRole("button", { name: "Zoom in on globe" }));
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("140 percent");

    fireEvent.click(screen.getByRole("button", { name: "Reset globe zoom" }));
    expect(screen.getByTestId("status-globe-zoom")).toHaveTextContent("100 percent");
  });

  it("promotes the platform with working signup and product links", () => {
    render(<FtcSeasonGlobe />);

    expect(screen.getByTestId("card-ftc-platform-promo")).toHaveTextContent("team chat");
    expect(screen.getByTestId("link-ftc-platform-signup")).toHaveAttribute("href", "/auth?createTeam=1");
    expect(screen.getByTestId("link-ftc-platform-capabilities")).toHaveAttribute("href", "#capabilities");
  });
});
