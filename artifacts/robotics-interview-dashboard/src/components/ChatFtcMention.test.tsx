import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  const nextSchema = apiSpec.slice(schemaStart + 1).search(/\n    [A-Z][A-Za-z0-9]+:\n/);
  const schemaBlock = apiSpec.slice(schemaStart, nextSchema < 0 ? undefined : schemaStart + 1 + nextSchema);
  const propertiesBlock = schemaBlock.split("      properties:\n")[1] ?? "";
  return [...propertiesBlock.matchAll(/^        ([A-Za-z][A-Za-z0-9]*):/gm)].map(match => match[1]);
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
  it("renders every team contract field and every field for its listed events", () => {
    openTeamWidget();

    expect(screen.getByTestId("text-ftc-profile-title")).toHaveTextContent("FTC Team 23442");
    expect(screen.getByTestId("text-ftc-team-name")).toHaveTextContent("BioBuzz");
    const team = screen.getByTestId("dialog-ftc-mention");
    expectContractFieldsRendered("FtcTeam", team);

    const event = screen.getByTestId("ftc-team-event-cafo");
    expect(event).toHaveTextContent("Cascade Open");
    fireEvent.click(within(event).getByText("View details"));
    expect(within(event).getByText("Hide details")).toBeInTheDocument();
    expectContractFieldsRendered("FtcEvent", event);
    expect(screen.getByRole("link", { name: /team\.example\.org/ })).toHaveAttribute("href", "https://team.example.org/");
    expect(screen.getByRole("link", { name: /event\.example\.org/ })).toHaveAttribute("href", "https://event.example.org/");
    expect(screen.getByRole("link", { name: /video\.example\.org/ })).toHaveAttribute("href", "https://video.example.org/live");
    expect(screen.getByRole("link", { name: /event\.example\.org/ })).toHaveClass("focus-visible:outline");
  });

  it("renders every event contract field and all fields for each attending team", () => {
    openEventWidget();

    expect(screen.getByTestId("text-ftc-event-name")).toHaveTextContent("Cascade Open");
    expectContractFieldsRendered("FtcEvent", screen.getByTestId("dialog-ftc-mention"));
    const team = screen.getByTestId("ftc-event-team-23442");
    expect(team).toHaveTextContent("BioBuzz");
    fireEvent.click(within(team).getByText("View details"));
    expectContractFieldsRendered("FtcTeam", team);
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
    const lastTeam = screen.getByTestId("ftc-event-team-23471");
    fireEvent.click(within(lastTeam).getByText("View details"));
    expectContractFieldsRendered("FtcTeam", lastTeam);
    expect(screen.queryByText(/Showing the first/i)).not.toBeInTheDocument();
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

  it("keeps the retry action keyboard-visible and connected to refetch", () => {
    const refetch = vi.fn();
    vi.mocked(useGetFtcEventProfile).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    openEventWidget();

    const retry = screen.getByTestId("button-retry-ftc-details");
    expect(retry).toHaveClass("focus-visible:outline");
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledOnce();
  });
});
