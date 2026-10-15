import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browser: {
    startAuthentication: vi.fn(),
    startRegistration: vi.fn(),
    browserSupportsPasskeys: vi.fn(() => true),
  },
  api: {
    getPasskeyLoginOptions: vi.fn(),
    getPasskeyRegisterOptions: vi.fn(),
    loginWithPasskey: vi.fn(),
    registerPasskey: vi.fn(),
  },
}));

vi.mock("@simplewebauthn/browser", () => mocks.browser);
vi.mock("@workspace/api-client-react", () => mocks.api);

import { loginWithPasskeyFlow, registerPasskeyFlow } from "./passkeyClient";

describe("passkey client flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unwraps the registration options envelope before opening the authenticator", async () => {
    const publicKey = {
      challenge: "registration-challenge",
      user: { id: "account-id", name: "Interviewer", displayName: "Interviewer" },
      rp: { name: "Robotics Interview", id: "example.com" },
    };
    mocks.api.getPasskeyRegisterOptions.mockResolvedValue({ publicKey });
    mocks.browser.startRegistration.mockResolvedValue({ id: "attestation" });
    mocks.api.registerPasskey.mockResolvedValue({ label: "MacBook" });

    await expect(registerPasskeyFlow("MacBook")).resolves.toBe("MacBook");

    expect(mocks.browser.startRegistration).toHaveBeenCalledWith({ optionsJSON: publicKey });
    expect(mocks.api.registerPasskey).toHaveBeenCalledWith({
      response: { id: "attestation" },
      label: "MacBook",
    });
  });

  it("unwraps the sign-in options envelope before opening the authenticator", async () => {
    const publicKey = {
      challenge: "login-challenge",
      allowCredentials: [{ id: "credential-id", type: "public-key" }],
      rpId: "example.com",
    };
    const session = { token: "session-token" };
    mocks.api.getPasskeyLoginOptions.mockResolvedValue({ publicKey });
    mocks.browser.startAuthentication.mockResolvedValue({ id: "assertion" });
    mocks.api.loginWithPasskey.mockResolvedValue(session);

    await expect(loginWithPasskeyFlow("event-code", "interviewer-id")).resolves.toBe(session);

    expect(mocks.browser.startAuthentication).toHaveBeenCalledWith({ optionsJSON: publicKey });
    expect(mocks.api.loginWithPasskey).toHaveBeenCalledWith({
      eventPassword: "event-code",
      interviewerId: "interviewer-id",
      response: { id: "assertion" },
    });
  });

  it("reports incomplete options without exposing a browser TypeError", async () => {
    mocks.api.getPasskeyRegisterOptions.mockResolvedValue({ publicKey: { challenge: "missing-user" } });

    await expect(registerPasskeyFlow()).rejects.toThrow(
      "Could not start passkey registration: the server returned incomplete options. Try again.",
    );
    expect(mocks.browser.startRegistration).not.toHaveBeenCalled();
  });
});
