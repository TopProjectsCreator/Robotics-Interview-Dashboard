import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatFtcMentionProvider, ChatFtcMentionToken } from "./ChatFtcMention";
import { useGetFtcEventProfile, useGetFtcTeamProfile } from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", () => ({
  getGetFtcEventProfileQueryKey: vi.fn(),
  getGetFtcTeamProfileQueryKey: vi.fn(),
  useGetFtcEventProfile: vi.fn(),
  useGetFtcTeamProfile: vi.fn(),
}));

const teamProfile = {
  season: 2026,
  team: {
    teamNumber: 23442,
    displayTeamNumber: "23442",
    nameFull: "BioBuzz",
    nameShort: "BioBuzz",
    schoolName: "Sammamish High School",
    city: "Bellevue",
    stateProv: "Washington",
    country: "USA",
    website: "https://example.org",
    rookieYear: 2019,
    robotName: "Pollinator",
    homeRegion: "Pacific Northwest",
  },
  events: [{
    season: 2026,
    code: "CAFO",
    name: "Cascade Open",
    typeName: "Qualifier",
    venue: "Sammamish High School",
    city: "Bellevue",
    stateProv: "Washington",
    country: "USA",
    website: null,
    liveStreamUrl: null,
    dateStart: "2026-12-12T00:00:00Z",
    dateEnd: "2026-12-13T00:00:00Z",
  }],
};

const eventProfile = {
  season: 2026,
  event: teamProfile.events[0],
  teams: [teamProfile.team],
};

beforeEach(() => {
  vi.mocked(useGetFtcTeamProfile).mockReturnValue({
    data: teamProfile,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useGetFtcEventProfile).mockReturnValue({
    data: eventProfile,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
});

describe("FTC chat mention previews", () => {
  it("opens an official team widget with profile and season events", () => {
    render(
      <ChatFtcMentionProvider>
        <p>Build with <ChatFtcMentionToken reference={{ kind: "team", season: 2026, teamNumber: 23442 }} /></p>
      </ChatFtcMentionProvider>,
    );

    fireEvent.click(screen.getByTestId("chat-ftc-mention-team-23442"));
    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Team 23442");
    expect(screen.getByTestId("text-ftc-team-name")).toHaveTextContent("BioBuzz");
    expect(screen.getByText("Robot: Pollinator")).toBeInTheDocument();
    expect(screen.getByTestId("ftc-team-event-cafo")).toHaveTextContent("Cascade Open");
    expect(screen.getByRole("link", { name: "Team website" })).toHaveAttribute("href", "https://example.org/");
  });

  it("opens an event widget with location and attending teams", () => {
    render(
      <ChatFtcMentionProvider>
        <ChatFtcMentionToken reference={{ kind: "event", season: 2026, eventCode: "CAFO" }} />
      </ChatFtcMentionProvider>,
    );

    fireEvent.click(screen.getByTestId("chat-ftc-mention-event-cafo"));
    expect(screen.getByTestId("text-ftc-event-name")).toHaveTextContent("Cascade Open");
    expect(screen.getByTestId("ftc-event-team-23442")).toHaveTextContent("BioBuzz");
    expect(screen.getByText(/Sammamish High School, Bellevue/)).toBeInTheDocument();
  });
});
