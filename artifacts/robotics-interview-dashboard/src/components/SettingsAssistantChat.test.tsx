import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@workspace/api-client-react";
import { SettingsAssistantChat } from "./SettingsAssistantChat";

vi.mock("../authSession", () => ({
  getStoredAuthToken: vi.fn(() => null),
}));

const coordinator: AuthSession = {
  authenticated: true,
  role: "coordinator",
  teamId: "team-fixture",
};

function sseResponse(frames: unknown[], options: { split?: boolean } = {}): Response {
  const encoded = new TextEncoder().encode(
    frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join(""),
  );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (options.split && encoded.length > 8) {
        const midpoint = Math.floor(encoded.length / 2);
        controller.enqueue(encoded.slice(0, midpoint));
        setTimeout(() => {
          controller.enqueue(encoded.slice(midpoint));
          controller.close();
        }, 15);
      } else {
        controller.enqueue(encoded);
        controller.close();
      }
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function renderPanel(session: AuthSession | undefined = coordinator) {
  const onApplyLocalUpdates = vi.fn();
  const onTeamSettingsSaved = vi.fn();
  render(
    <SettingsAssistantChat
      session={session}
      localSettings={{
        "profile.displayName": "Ava",
        "profile.initials": "A",
        "appearance.theme": "light",
        "appearance.density": "comfortable",
        "appearance.showPhotos": true,
        "appearance.reduceMotion": false,
        "applicants.defaultSort": "rank",
        "live.autoRefresh": true,
        "live.realtime": true,
        "live.refreshMs": 3000,
      }}
      onApplyLocalUpdates={onApplyLocalUpdates}
      onTeamSettingsSaved={onTeamSettingsSaved}
    />,
  );
  return { onApplyLocalUpdates, onTeamSettingsSaved };
}

function ask(question: string) {
  fireEvent.change(screen.getByTestId("input-settings-assistant-question"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByTestId("button-settings-assistant-send"));
}

describe("SettingsAssistantChat", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("denies a missing session or non-admin role without making an API call", () => {
    const fetchMock = vi.mocked(fetch);
    const { rerender } = render(
      <SettingsAssistantChat
        session={undefined}
        localSettings={{}}
        onApplyLocalUpdates={vi.fn()}
        onTeamSettingsSaved={vi.fn()}
      />,
    );
    expect(screen.getByTestId("settings-assistant-denied")).toHaveTextContent("coordinator or admin");
    rerender(
      <SettingsAssistantChat
        session={{ authenticated: true, role: "treasurer" }}
        localSettings={{}}
        onApplyLocalUpdates={vi.fn()}
        onTeamSettingsSaved={vi.fn()}
      />,
    );
    expect(screen.getByTestId("settings-assistant-denied")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders read-before-write progress while the SSE response is still streaming", async () => {
    let releaseStream: (() => void) | undefined;
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ activity: { action: "read_setting", settingId: "appearance.theme", status: "started" } })}\n\n`,
        ));
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ activity: { action: "read_setting", settingId: "appearance.theme", status: "complete" } })}\n\n`,
        ));
        releaseStream = () => {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ activity: { action: "propose_setting_change", settingId: "appearance.theme", status: "started" } })}\n\n`,
          ));
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ done: true, result: { answer: "Theme checked.", confirmations: [], changes: [], localUpdates: {}, model: "settings" } })}\n\n`,
          ));
          controller.close();
        };
      },
    });
    vi.mocked(fetch).mockResolvedValue(new Response(responseBody, { status: 200 }));
    renderPanel();
    ask("What theme am I using?");

    expect(await screen.findByText("Theme: read")).toBeInTheDocument();
    expect(screen.getByTestId("settings-assistant-working")).toBeInTheDocument();
    expect(screen.queryByText("Theme checked.")).not.toBeInTheDocument();
    expect(releaseStream).toBeDefined();
    releaseStream?.();
    expect(await screen.findByText("Theme checked.")).toBeInTheDocument();
  });

  it("waits for explicit approval before posting a confirmation token", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(sseResponse([
      { activity: { action: "propose_setting_change", settingId: "team.chat.slowmode", status: "confirmation" } },
      {
        done: true,
        result: {
          answer: "The team slow mode can be changed.",
          confirmations: [{
            token: "confirm-fixture",
            settingId: "team.chat.slowmode",
            summary: "Set the team's chat slow mode to 10 seconds.",
            expiresAt: "2030-01-01T00:00:00Z",
          }],
          changes: [],
          localUpdates: {},
          model: "settings",
        },
      },
    ], { split: true }));
    fetchMock.mockResolvedValueOnce(sseResponse([
      {
        done: true,
        result: {
          answer: "The team setting is now saved.",
          confirmations: [],
          changes: [{ settingId: "team.chat.slowmode", value: 10 }],
          localUpdates: {},
          model: "settings",
        },
      },
    ]));
    renderPanel();
    ask("Set chat slow mode to 10 seconds");

    expect(await screen.findByTestId("settings-assistant-confirmation")).toHaveTextContent(
      "Set the team's chat slow mode to 10 seconds.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({
      question: "Set chat slow mode to 10 seconds",
      localSettings: {
        "profile.displayName": "Ava",
        "profile.initials": "A",
        "appearance.theme": "light",
        "appearance.density": "comfortable",
        "appearance.showPhotos": true,
        "appearance.reduceMotion": false,
        "applicants.defaultSort": "rank",
        "live.autoRefresh": true,
        "live.realtime": true,
        "live.refreshMs": 3000,
      },
    });
    fireEvent.click(screen.getByTestId("button-settings-assistant-approve"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({
      question: "confirm",
      confirmationToken: "confirm-fixture",
      localSettings: {
        "profile.displayName": "Ava",
        "profile.initials": "A",
        "appearance.theme": "light",
        "appearance.density": "comfortable",
        "appearance.showPhotos": true,
        "appearance.reduceMotion": false,
        "applicants.defaultSort": "rank",
        "live.autoRefresh": true,
        "live.realtime": true,
        "live.refreshMs": 3000,
      },
    });
    expect(await screen.findByTestId("settings-assistant-saved-summary")).toHaveTextContent("10");
  });

  it("keeps follow-up context inside the Settings assistant stream", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(sseResponse([{
        done: true,
        result: { answer: "Your theme is light.", confirmations: [], changes: [], localUpdates: {}, model: "settings" },
      }]))
      .mockResolvedValueOnce(sseResponse([{
        done: true,
        result: { answer: "It is now dark.", confirmations: [], changes: [], localUpdates: {}, model: "settings" },
      }]));
    renderPanel();
    ask("What theme am I using?");
    expect(await screen.findByText("Your theme is light.")).toBeInTheDocument();
    ask("Change it to dark.");

    expect(await screen.findByText("It is now dark.")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/assistant/settings/stream");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).history).toEqual([
      { role: "user", content: "What theme am I using?" },
      { role: "assistant", content: "Your theme is light." },
    ]);
  });

  it("applies local updates and refreshes team state before showing saved changes", async () => {
    const { onApplyLocalUpdates, onTeamSettingsSaved } = renderPanel({
      ...coordinator,
      role: "admin",
    });
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      { activity: { action: "read_setting", settingId: "appearance.density", status: "complete" } },
      { activity: { action: "update_setting", settingId: "team.chat.slowmode", status: "saved" } },
      {
        done: true,
        result: {
          answer: "Your preferences are updated.",
          confirmations: [],
          changes: [
            { settingId: "appearance.density", value: "compact" },
            { settingId: "team.chat.slowmode", value: 10 },
          ],
          localUpdates: { "appearance.density": "compact" },
          model: "settings",
        },
      },
    ]));
    ask("Use compact view and set team slow mode to 10 seconds");

    const summary = await screen.findByTestId("settings-assistant-saved-summary");
    expect(summary).toHaveTextContent("Saved settings");
    expect(summary).toHaveTextContent("compact");
    expect(summary).toHaveTextContent("10");
    expect(onApplyLocalUpdates).toHaveBeenCalledWith({ "appearance.density": "compact" });
    expect(onTeamSettingsSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Team · Chat Slowmode: saved")).toBeInTheDocument();
  });

  it("announces server and network failures accessibly", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
    renderPanel();
    ask("Read my theme");
    expect(await screen.findByTestId("settings-assistant-error")).toHaveTextContent("503");

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network unavailable"));
    fireEvent.click(screen.getByTestId("button-settings-assistant-retry"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  });
});
