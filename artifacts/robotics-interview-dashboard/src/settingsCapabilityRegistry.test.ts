import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@workspace/api-client-react";
import { DEFAULT_SETTINGS } from "./workspaceSettings";
import {
  listSettingsCapabilities,
  readSettingsCapability,
  updateSettingsCapability,
  type SettingsCapabilityContext,
} from "./settingsCapabilityRegistry";

afterEach(() => window.localStorage.removeItem("robotics_admin_session_token"));

function context(
  session: AuthSession,
  fetcher = vi.fn<typeof fetch>(),
): SettingsCapabilityContext {
  return {
    session,
    local: {
      settings: { ...DEFAULT_SETTINGS },
      theme: "light",
      updateSettings: vi.fn(),
      setTheme: vi.fn(),
    },
    fetcher,
  };
}

function response(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  } as Response;
}

describe("Settings capability registry", () => {
  const admin: AuthSession = { authenticated: true, interviewerId: "account-a", teamId: "team-a", role: "coordinator" };

  it("lists browser-local preferences for signed-in users and filters team settings by permission", () => {
    const member: AuthSession = {
      authenticated: true,
      interviewerId: "member-a",
      teamId: "team-a",
      role: "interviewer",
      permissions: ["team.mailbox.manage"],
    };
    const ids = listSettingsCapabilities(member).map((capability) => capability.id);
    expect(ids).toContain("profile.displayName");
    expect(ids).toContain("team.inbox");
    expect(ids).not.toContain("team.nameRules");
    expect(ids).not.toContain("team.chat.slowmode");
    expect(listSettingsCapabilities({ authenticated: false }).length).toBe(0);
    expect(listSettingsCapabilities(admin).map((capability) => capability.id)).toContain("team.nameRules");
  });

  it("updates only the named browser preference with its own validator", async () => {
    const ctx = context(admin);
    await expect(updateSettingsCapability("profile.displayName", "Ava", ctx)).resolves.toBe("Ava");
    expect(ctx.local.updateSettings).toHaveBeenCalledWith({ displayName: "Ava" });

    await expect(updateSettingsCapability("profile.displayName", { density: "compact" }, ctx))
      .rejects.toThrow(/Display name/);
    await expect(updateSettingsCapability("live.refreshMs", 5000, ctx))
      .rejects.toThrow(/refresh interval/);
    expect(ctx.local.updateSettings).toHaveBeenCalledTimes(1);
  });

  it("uses the signed-in team's existing endpoints and never accepts a caller-selected team", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ slowmodeSeconds: 10 }))
      .mockResolvedValueOnce(response({ slowmodeSeconds: 30 }));
    const ctx = context(admin, fetcher);
    window.localStorage.setItem("robotics_admin_session_token", "signed-session-token");

    await expect(readSettingsCapability("team.chat.slowmode", ctx)).resolves.toEqual({ slowmodeSeconds: 10 });
    await expect(updateSettingsCapability("team.chat.slowmode", { slowmodeSeconds: 30, teamId: "team-b" }, ctx))
      .resolves.toEqual({ slowmodeSeconds: 30 });

    expect(fetcher.mock.calls[0][0]).toBe("/api/chat/settings");
    expect(fetcher.mock.calls[1][0]).toBe("/api/chat/settings");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: "include" });
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer signed-session-token");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ slowmodeSeconds: 30 });
    expect(String(fetcher.mock.calls[1][1]?.body)).not.toContain("team-b");
  });

  it("redacts secret values and private storage paths from team settings reads", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({
        teamId: "team-a",
        mailbox: "inbox-123",
        forwardingAddress: "forward@example.test",
        enabled: true,
        configured: true,
        apiKeyConfigured: true,
        allowedSenders: ["approved@example.test"],
        legacy: false,
        apiKey: "must-not-return",
      }))
      .mockResolvedValueOnce(response({
        logoPath: "private/team-a/logo.png",
        primaryColor: "#123456",
        backgroundPath: "private/team-a/background.webp",
        backgroundMode: "cover",
        backgroundOverlay: 35,
      }));
    const ctx = context(admin, fetcher);

    const mailbox = await readSettingsCapability("team.inbox", ctx);
    const branding = await readSettingsCapability("team.branding.primaryColor", ctx);
    expect(mailbox).toEqual({
      enabled: true,
      apiKeyConfigured: true,
      allowedSenders: ["approved@example.test"],
      forwardingAddress: "forward@example.test",
    });
    expect(JSON.stringify(mailbox)).not.toContain("must-not-return");
    expect(JSON.stringify(mailbox)).not.toContain("teamId");
    expect(branding).toEqual({
      primaryColor: "#123456",
      hasLogo: true,
      hasBackground: true,
      backgroundOptions: { backgroundMode: "cover", backgroundOverlay: 35 },
    });
    expect(JSON.stringify(branding)).not.toContain("private/");
  });

  it("does not expose background controls before a background image exists", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      logoPath: null,
      primaryColor: null,
      backgroundPath: null,
      backgroundMode: "tile",
      backgroundOverlay: 65,
    }));
    const ctx = context(admin, fetcher);
    await expect(readSettingsCapability("team.branding.backgroundOptions", ctx)).resolves.toEqual({
      primaryColor: null,
      hasLogo: false,
      hasBackground: false,
      backgroundOptions: null,
    });
  });

  it("requires a replacement key for secret changes and uses existing server validation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      teamId: "team-a",
      mailbox: "inbox-123",
      forwardingAddress: null,
      enabled: false,
      configured: false,
      apiKeyConfigured: true,
      allowedSenders: [],
      legacy: false,
    }));
    const ctx = context(admin, fetcher);

    await expect(updateSettingsCapability("team.inbox", {
      enabled: false,
      allowedSenders: [],
      removeApiKey: true,
    }, ctx)).rejects.toThrow(/replaced with a new key/);
    expect(fetcher).not.toHaveBeenCalled();

    await updateSettingsCapability("team.inbox", {
      enabled: false,
      allowedSenders: [],
      apiKey: "replacement-key",
    }, ctx);
    expect(fetcher).toHaveBeenCalledWith("/api/system/mailbox", expect.objectContaining({
      method: "PUT",
      credentials: "include",
      body: JSON.stringify({ enabled: false, allowedSenders: [], apiKey: "replacement-key" }),
    }));
  });

  it("rejects hidden and unsupported identifiers without calling an endpoint", async () => {
    const member = context({ authenticated: true, role: "interviewer", permissions: [] });
    const message = "Unsupported setting identifier.";
    await expect(readSettingsCapability("team.inbox", member)).rejects.toThrow(message);
    await expect(updateSettingsCapability("team.inbox", {}, member)).rejects.toThrow(message);
    await expect(readSettingsCapability("team.hidden.adminPassword", member)).rejects.toThrow(message);
    await expect(updateSettingsCapability("team.hidden.adminPassword", "x", member)).rejects.toThrow(message);
    expect(member.fetcher).not.toHaveBeenCalled();
  });

  it("validates team update values before sending them", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const ctx = context(admin, fetcher);
    await expect(updateSettingsCapability("team.chat.slowmode", { slowmodeSeconds: 600 }, ctx))
      .rejects.toThrow(/interval shown/);
    await expect(updateSettingsCapability("team.branding.backgroundOptions", {
      backgroundMode: "cover",
      backgroundOverlay: 13,
    }, ctx)).rejects.toThrow(/steps of 5/);
    await expect(updateSettingsCapability("team.nameRules", {
      rules: [{ matchType: "exact", text: "  " }],
    }, ctx)).rejects.toThrow(/non-empty text/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
