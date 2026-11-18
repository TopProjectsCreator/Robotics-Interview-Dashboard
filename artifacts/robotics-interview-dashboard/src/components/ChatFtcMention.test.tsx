import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatFtcMentionProvider, ChatFtcMentionToken } from "./ChatFtcMention";
import { useGetFtcEventProfile, useGetFtcTeamProfile } from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", () => ({
  getGetFtcEventProfileQueryKey: vi.fn(),
  getGetFtcTeamProfileQueryKey: vi.fn(),
  useGetFtcEventProfile: vi.fn(),
  useGetFtcTeamProfile: vi.fn(),
}));

const apiSpec = readFileSync(resolve(process.cwd(), "../../lib/api-spec/openapi.yaml"), "utf8");
const fieldTestIds: Record<string, Record<string, string>> = {
  FtcTeam: {
    teamNumber: "team-number",
    displayTeamNumber: "display-team-number",
    nameFull: "full-name",
    nameShort: "short-name",
    schoolName: "school",
    city: "city",
    stateProv: "state-or-province",
    country: "country",
    website: "website",
    rookieYear: "rookie-year",
    robotName: "robot-name",
    homeRegion: "home-region",
  },
  FtcEvent: {
    season: "season",
    code: "event-code",
    name: "name",
    typeName: "type",
    venue: "venue",
    city: "city",
    stateProv: "state-or-province",
    country: "country",
    website: "website",
    liveStreamUrl: "live-stream",
    dateStart: "start-date",
    dateEnd: "end-date",
  },
};

function contractProperties(schemaName: string): string[] {
  const schemaStart = apiSpec.indexOf(`    ${schemaName}:\n`);
  expect(schemaStart, `${schemaName} should exist in the OpenAPI contract`).toBeGreaterThanOrEqual(0);
  const nextSchema = apiSpec.slice(schemaStart + 1).search(/\n {4}[A-Z][A-Za-z0-9]+:\n/);
  const schemaBlock = apiSpec.slice(schemaStart, nextSchema < 0 ? undefined : schemaStart + 1 + nextSchema);
  const propertiesBlock = schemaBlock.split("      properties:\n")[1] ?? "";
  return [...propertiesBlock.matchAll(/^ {8}([A-Za-z][A-Za-z0-9]*):/gm)].map(match => match[1]);
}

function expectContractFieldsRendered(schemaName: "FtcTeam" | "FtcEvent", scope: HTMLElement = document.body) {
  const contractFields = contractProperties(schemaName);
  const fieldIds = fieldTestIds[schemaName];
  expect(Object.keys(fieldIds).sort()).toEqual(contractFields.slice().sort());
  for (const field of contractFields) {
    expect(within(scope).getAllByTestId(`ftc-field-${fieldIds[field]}`).length, `${schemaName}.${field} should be visible`).toBeGreaterThan(0);
  }
}

const teamProfile = {
  season: 2026,
  team: {
    teamNumber: 23442,
    displayTeamNumber: "23442",
    nameFull: "BioBuzz",
    nameShort: "Buzz",
    schoolName: "Sammamish High School",
    city: "Bellevue",
    stateProv: "Washington",
    country: "USA",
    website: "https://team.example.org",
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
    website: "https://event.example.org",
    liveStreamUrl: "https://video.example.org/live",
    dateStart: "2026-12-12T00:00:00Z",
    dateEnd: "2026-12-13T00:00:00Z",
  }],
};

const eventProfile = {
  season: 2026,
  event: teamProfile.events[0],
  teams: [teamProfile.team],
  matches: [],
};

const releasedMatch = {
  description: "Qualification 1",
  tournamentLevel: "qualification" as const,
  series: 0,
  matchNumber: 1,
  redTeamNumbers: [23332, 18439],
  blueTeamNumbers: [11506, 12993],
  redScore: 42,
  blueScore: 39,
  resultStatus: "final" as const,
  winningAlliance: "red" as const,
};

function openTeamWidget() {
  render(
    <ChatFtcMentionProvider>
      <p>Build with <ChatFtcMentionToken reference={{ kind: "team", season: 2026, teamNumber: 23442 }} /></p>
    </ChatFtcMentionProvider>,
  );
  fireEvent.click(screen.getByTestId("chat-ftc-mention-team-23442"));
}

function openEventWidget() {
  render(
    <ChatFtcMentionProvider>
      <ChatFtcMentionToken reference={{ kind: "event", season: 2026, eventCode: "CAFO" }} />
    </ChatFtcMentionProvider>,
  );
  fireEvent.click(screen.getByTestId("chat-ftc-mention-event-cafo"));
}

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
  it("opens a listed event as a full profile from its team", () => {
    openTeamWidget();

    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Team 23442");
    expect(screen.getByTestId("text-ftc-team-name")).toHaveTextContent("BioBuzz");
    const team = screen.getByTestId("dialog-ftc-mention");
    expectContractFieldsRendered("FtcTeam", team);

    const event = screen.getByTestId("ftc-team-event-cafo");
    expect(event).toHaveTextContent("Cascade Open");
    expect(event).toHaveAccessibleName("Open FTC event CAFO, 2026 season profile");
    expect(event).toHaveClass("focus-visible:outline");
    expect(screen.getByRole("link", { name: /team\.example\.org/ })).toHaveAttribute("href", "https://team.example.org/");
    fireEvent.click(event);

    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Event CAFO");
    expect(screen.getByTestId("text-ftc-event-name")).toHaveTextContent("Cascade Open");
    expectContractFieldsRendered("FtcEvent", screen.getByTestId("dialog-ftc-mention"));
    expect(screen.getByRole("link", { name: /event\.example\.org/ })).toHaveAttribute("href", "https://event.example.org/");
    expect(screen.getByRole("link", { name: /video\.example\.org/ })).toHaveAttribute("href", "https://video.example.org/live");
    expect(screen.getByRole("link", { name: /event\.example\.org/ })).toHaveClass("focus-visible:outline");
    expect(useGetFtcEventProfile).toHaveBeenLastCalledWith("CAFO", { season: 2026 }, expect.anything());
  });

  it("opens an attending team as a full profile from its event", () => {
    openEventWidget();

    expect(screen.getByTestId("text-ftc-event-name")).toHaveTextContent("Cascade Open");
    expectContractFieldsRendered("FtcEvent", screen.getByTestId("dialog-ftc-mention"));
    const team = screen.getByTestId("ftc-event-team-23442");
    expect(team).toHaveTextContent("BioBuzz");
    expect(team).toHaveAccessibleName("Open FTC Team 23442, 2026 season profile");
    expect(team).toHaveClass("focus-visible:outline");
    fireEvent.click(team);

    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Team 23442");
    expect(screen.getByTestId("text-ftc-team-name")).toHaveTextContent("BioBuzz");
    expectContractFieldsRendered("FtcTeam", screen.getByTestId("dialog-ftc-mention"));
    expect(useGetFtcTeamProfile).toHaveBeenLastCalledWith(23442, { season: 2026 }, expect.anything());
  });

  it("shows the complete attending list when there are more than 24 teams", () => {
    const teams = Array.from({ length: 30 }, (_, index) => ({
      ...teamProfile.team,
      teamNumber: 23442 + index,
      displayTeamNumber: String(23442 + index),
      nameFull: `Robotics Team ${index + 1}`,
    }));
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: { ...eventProfile, teams },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    openEventWidget();

    expect(screen.getByText("30 listed")).toBeInTheDocument();
    for (const team of teams) {
      expect(screen.getByTestId(`ftc-event-team-${team.teamNumber}`)).toBeInTheDocument();
    }
    vi.mocked(useGetFtcTeamProfile).mockReturnValue({
      data: {
        ...teamProfile,
        team: {
          ...teamProfile.team,
          teamNumber: 23471,
          displayTeamNumber: "23471",
          nameFull: "Robotics Team 30",
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    fireEvent.click(screen.getByTestId("ftc-event-team-23471"));
    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Team 23471");
    expect(screen.getByTestId("text-ftc-team-name")).toHaveTextContent("Robotics Team 30");
    expectContractFieldsRendered("FtcTeam", screen.getByTestId("dialog-ftc-mention"));
    expect(useGetFtcTeamProfile).toHaveBeenLastCalledWith(23471, { season: 2026 }, expect.anything());
    expect(screen.queryByText(/Showing the first/i)).not.toBeInTheDocument();
  });

  it("shows released match teams, official scores, and the winning alliance", () => {
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: { ...eventProfile, matches: [releasedMatch] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openEventWidget();

    const card = screen.getByTestId("ftc-match-qualification-0-1");
    expect(card).toHaveAccessibleName("Qualification 1, Red alliance won");
    expect(card).toHaveTextContent("23332 · 18439");
    expect(card).toHaveTextContent("11506 · 12993");
    expect(card).toHaveTextContent("42");
    expect(card).toHaveTextContent("39");
    expect(card).toHaveTextContent("Red alliance won");
  });

  it("labels scheduled and unavailable matches without inventing scores", () => {
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: {
        ...eventProfile,
        matches: [
          {
            ...releasedMatch,
            description: "Qualification 2",
            matchNumber: 2,
            redScore: null,
            blueScore: null,
            resultStatus: "scheduled",
            winningAlliance: null,
          },
          {
            ...releasedMatch,
            description: "Playoff 1",
            tournamentLevel: "playoff",
            series: 1,
            redScore: null,
            blueScore: 18,
            resultStatus: "unavailable",
            winningAlliance: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openEventWidget();

    const scheduled = screen.getByTestId("ftc-match-qualification-0-2");
    expect(scheduled).toHaveTextContent("Awaiting results");
    expect(screen.queryByLabelText("Red alliance score 0")).not.toBeInTheDocument();
    const unavailable = screen.getByTestId("ftc-match-playoff-1-1");
    expect(unavailable).toHaveTextContent("Official result posted; scores unavailable");
    expect(screen.queryByLabelText("Blue alliance score 18")).not.toBeInTheDocument();
  });

  it("shows a tie and an empty state when FIRST has no released matchups", () => {
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: {
        ...eventProfile,
        matches: [{
          ...releasedMatch,
          redScore: 0,
          blueScore: 0,
          resultStatus: "tie",
          winningAlliance: "tie",
        }],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openEventWidget();
    expect(screen.getByTestId("ftc-match-result-status")).toHaveTextContent("Tie");
    expect(screen.getByTestId("ftc-match-qualification-0-1")).toHaveTextContent("0");
    fireEvent.click(screen.getByTestId("button-close-ftc-details"));
    cleanup();

    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: eventProfile,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openEventWidget();
    expect(screen.getByTestId("ftc-event-matches-empty")).toHaveTextContent("No matchups have been released");
  });

  it("uses one missing-value treatment for null and blank fields without creating invalid links", () => {
    vi.mocked(useGetFtcTeamProfile).mockReturnValue({
      data: {
        ...teamProfile,
        team: {
          ...teamProfile.team,
          nameFull: "   ",
          nameShort: " ",
          schoolName: " ",
          displayTeamNumber: " ",
          website: "javascript:alert(1)",
          robotName: null,
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openTeamWidget();

    expect(screen.getByTestId("text-ftc-team-name")).toHaveTextContent("Team 23442");
    expect(screen.getByTestId("ftc-field-display-team-number")).toHaveTextContent("Not listed");
    expect(screen.getByTestId("ftc-field-robot-name")).toHaveTextContent("Not listed");
    expect(screen.getAllByTestId("ftc-field-website").some(field => field.textContent?.includes("javascript:alert(1)"))).toBe(true);
    expect(screen.queryByRole("link", { name: /javascript:/i })).not.toBeInTheDocument();
  });

  it("shows missing event details consistently and keeps absent official links unlinked", () => {
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: {
        ...eventProfile,
        teams: [],
        event: {
          season: 2026,
          code: "CAFO",
          name: " ",
          typeName: null,
          venue: null,
          city: " ",
          stateProv: null,
          country: null,
          website: " ",
          liveStreamUrl: null,
          dateStart: null,
          dateEnd: null,
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openEventWidget();

    expect(screen.getByTestId("text-ftc-event-name")).toHaveTextContent("CAFO");
    expect(screen.getByTestId("ftc-field-name")).toHaveTextContent("Not listed");
    expect(screen.getByTestId("ftc-field-city")).toHaveTextContent("Not listed");
    expect(screen.getByTestId("ftc-field-start-date")).toHaveTextContent("Not listed");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the existing close button behavior for the expanded profile dialog", () => {
    openTeamWidget();
    const closeButton = screen.getByTestId("button-close-ftc-details");
    expect(closeButton).toHaveClass("focus-visible:outline");
    fireEvent.click(closeButton);
    expect(screen.queryByTestId("dialog-ftc-mention")).not.toBeInTheDocument();
  });

  it("returns through visited profiles and can close from a related profile", () => {
    openTeamWidget();
    fireEvent.click(screen.getByTestId("ftc-team-event-cafo"));
    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Event CAFO");

    fireEvent.click(screen.getByTestId("ftc-event-team-23442"));
    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Team 23442");
    expect(screen.getByTestId("button-back-ftc-details")).toHaveAccessibleName("Back to FTC Event CAFO");

    fireEvent.click(screen.getByTestId("button-back-ftc-details"));
    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Event CAFO");
    expect(screen.getByTestId("button-back-ftc-details")).toHaveAccessibleName("Back to FTC Team 23442");

    fireEvent.click(screen.getByTestId("button-back-ftc-details"));
    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Team 23442");
    expect(screen.queryByTestId("button-back-ftc-details")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ftc-team-event-cafo"));
    fireEvent.click(screen.getByTestId("button-close-ftc-details"));
    expect(screen.queryByTestId("dialog-ftc-mention")).not.toBeInTheDocument();
  });

  it("keeps the retry action keyboard-visible and connected to refetch", () => {
    const refetch = vi.fn();
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    openEventWidget();

    expect(screen.getByTestId("status-ftc-error")).toHaveTextContent("FIRST event details and match results could not be loaded.");
    const retry = screen.getByTestId("button-retry-ftc-details");
    expect(retry).toHaveClass("focus-visible:outline");
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("keeps the missing-team notice when the selected profile has no record", () => {
    vi.mocked(useGetFtcTeamProfile).mockReturnValue({
      data: { season: 2026, team: null, events: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openTeamWidget();

    expect(screen.getByText("This team is not listed for the 2026 season.")).toBeInTheDocument();
  });

  it("keeps the missing-event notice when the selected profile has no record", () => {
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: { season: 2026, event: null, teams: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openEventWidget();

    expect(screen.getByText("This event is not listed for the 2026 season.")).toBeInTheDocument();
  });

  it("shows the loading state when navigating to a related profile", () => {
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);
    openTeamWidget();
    fireEvent.click(screen.getByTestId("ftc-team-event-cafo"));

    expect(screen.getByRole("status")).toHaveTextContent("Loading official event details and matches…");
  });
});
