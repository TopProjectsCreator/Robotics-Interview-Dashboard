import { afterEach, describe, expect, it } from "vitest";
import type { ChatNotificationEvent } from "@workspace/api-client-react";
import {
  chatNotificationDestination,
  claimNotificationMessage,
  isAuthoredByMe,
  isCurrentChatConversation,
  notificationEventBody,
  notificationEventTitle,
} from "./chatNotificationLogic";

function event(overrides: Partial<ChatNotificationEvent> = {}): ChatNotificationEvent {
  return {
    id: "message-1",
    scope: "shared",
    createdAt: "2026-01-01T12:00:00.000Z",
    author: "Morgan",
    message: "A new message",
    peer: null,
    channelId: null,
    channelName: null,
    ...overrides,
  };
}

describe("chat notification event handling", () => {
  afterEach(() => window.localStorage.clear());

  it("routes direct, shared, and channel messages to their own chat destinations", () => {
    expect(chatNotificationDestination(event({ scope: "direct", peer: "Alex Smith" })))
      .toBe("/chat?peer=Alex+Smith");
    expect(chatNotificationDestination(event({ scope: "shared" }))).toBe("/chat");
    expect(chatNotificationDestination(event({ scope: "channel", channelId: "build-team" })))
      .toBe("/chat?channel=build-team");
  });

  it("suppresses only the currently viewed conversation", () => {
    const view = { path: "/chat", peer: "Alex", channelId: null };
    expect(isCurrentChatConversation(event({ scope: "direct", peer: "alex" }), view)).toBe(true);
    expect(isCurrentChatConversation(event({ scope: "direct", peer: "Morgan" }), view)).toBe(false);
    expect(isCurrentChatConversation(event({ scope: "shared" }), view)).toBe(false);
    expect(isCurrentChatConversation(event({ scope: "channel", channelId: "parts" }), view)).toBe(false);
    expect(isCurrentChatConversation(event({ scope: "direct", peer: "Alex" }), {
      path: "/dashboard", peer: null, channelId: null,
    })).toBe(false);
  });

  it("suppresses the open shared chat or matching channel", () => {
    expect(isCurrentChatConversation(event({ scope: "shared" }), {
      path: "/queue", peer: null, channelId: null,
    })).toBe(true);
    expect(isCurrentChatConversation(event({ scope: "channel", channelId: "build" }), {
      path: "/chat", peer: null, channelId: "build",
    })).toBe(true);
    expect(isCurrentChatConversation(event({ scope: "channel", channelId: "parts" }), {
      path: "/chat", peer: null, channelId: "build",
    })).toBe(false);
  });

  it("ignores messages authored by the signed-in interviewer", () => {
    expect(isAuthoredByMe(event({ author: "  MORGAN " }), "Morgan")).toBe(true);
    expect(isAuthoredByMe(event({ author: "Alex" }), "Morgan")).toBe(false);
  });

  it("claims each message identity once across repeated polls", () => {
    expect(claimNotificationMessage("seen", "same-message")).toBe(true);
    expect(claimNotificationMessage("seen", "same-message")).toBe(false);
    expect(claimNotificationMessage("seen", "another-message")).toBe(true);
  });

  it("uses distinct readable titles and message text for each conversation scope", () => {
    expect(notificationEventTitle(event({ scope: "direct" }))).toContain("direct message");
    expect(notificationEventTitle(event({ scope: "channel", channelName: "Build" }))).toContain("Build");
    expect(notificationEventTitle(event({ scope: "shared" }))).toBe("New team chat message");
    expect(notificationEventBody(event({ scope: "shared" }))).toBe("Morgan: A new message");
  });
});
