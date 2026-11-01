import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";

import App, { queryClient } from "@/App";
import {
  AUTH_SESSION_ACTIVE_STORAGE_KEY,
  AUTH_SESSION_CHANNEL_NAME,
  AUTH_SESSION_END_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  DEFAULT_AUTH_RETURN_PATH,
  clearChatDraft,
  getChatDraftStorageKey,
  getSafeAuthReturnPath,
  loadChatDraft,
  saveChatDraft,
} from "@/authSession";
import {
  getGetInterviewChatQueryKey,
  getGetSessionQueryKey,
  getListInterviewersQueryKey,
} from "@workspace/api-client-react";
import ChatLanding from "./chat-landing";
import PublicDashboard from "./public-dashboard";

const chatLandingStyles = readFileSync("src/pages/chat-landing.css", "utf8");

function renderWithRouter(ui: ReactNode) {
  return render(<Router>{ui}</Router>);
}

function extractCssBlock(stylesheet: string, startIndex: number) {
  const openingBrace = stylesheet.indexOf("{", startIndex);
  if (openingBrace < 0) throw new Error("CSS rule is missing an opening brace");

  let depth = 0;
  for (let index = openingBrace; index < stylesheet.length; index += 1) {
    if (stylesheet[index] === "{") depth += 1;
    if (stylesheet[index] === "}") depth -= 1;
    if (depth === 0) return stylesheet.slice(openingBrace + 1, index);
  }

  throw new Error("CSS rule is missing a closing brace");
}

function cssRule(stylesheet: string, selector: string) {
  const selectorIndex = stylesheet.indexOf(selector);
  if (selectorIndex < 0) throw new Error(`CSS selector was not found: ${selector}`);
  return extractCssBlock(stylesheet, selectorIndex);
}

function cssProperty(rule: string, property: string) {
  const value = rule.match(new RegExp(`(?:^|\\n)\\s*${property}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`CSS property was not found: ${property}`);
  return value;
}

function colorFromDeclaration(declaration: string) {
  const color = declaration.match(/#[0-9a-f]{6}/i)?.[0];
  if (!color) throw new Error(`Expected a hex color declaration, received: ${declaration}`);
  return color;
}

function relativeLuminance(color: string) {
  const channels = color.match(/[0-9a-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Expected a hex color, received: ${color}`);

  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const privateRecordCanaries = [
  "PRIVATE_CHAT_RECORD_CANARY",
  "PRIVATE_APPLICANT_RECORD_CANARY",
  "PRIVATE_PRESENCE_RECORD_CANARY",
  "PRIVATE_COLLABORATION_RECORD_CANARY",
  "PRIVATE_PARTS_INVENTORY_RECORD_CANARY",
  "PRIVATE_PARTS_CATALOG_RECORD_CANARY",
  "PRIVATE_ASSISTANT_CONVERSATION_RECORD_CANARY",
];

class MockBroadcastChannel {
  static channels = new Set<MockBroadcastChannel>();
  private listeners = new Set<(event: MessageEvent) => void>();

  constructor(readonly name: string) {
    MockBroadcastChannel.channels.add(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  postMessage(data: unknown) {
    for (const channel of MockBroadcastChannel.channels) {
      if (channel === this || channel.name !== this.name) continue;
      for (const listener of channel.listeners) listener({ data } as MessageEvent);
    }
  }

  close() {
    MockBroadcastChannel.channels.delete(this);
  }
}

const privateRecordsResponse = {
  ok: true,
  status: 200,
  headers: { get: () => "application/json" } as unknown as Headers,
  text: async () => JSON.stringify({
    authenticated: false,
    messages: [{ text: privateRecordCanaries[0] }],
    items: [{ name: privateRecordCanaries[1] }],
    entries: [{ name: privateRecordCanaries[2] }],
    collaborators: [{ name: privateRecordCanaries[3] }],
    inventory: [{ name: privateRecordCanaries[4] }],
    catalog: [{ name: privateRecordCanaries[5] }],
    assistantConversation: [{ text: privateRecordCanaries[6] }],
  }),
} as Response;

function stubNetworkTransports(fetchImplementation: typeof fetch = async () => privateRecordsResponse) {
  const fetchSpy = vi.fn(fetchImplementation);
  const eventSources: { close: ReturnType<typeof vi.fn>; onmessage: ((event: MessageEvent) => void) | null }[] = [];
  const eventSourceConstructor = vi.fn(function MockEventSource() {
    const source = { close: vi.fn(), onmessage: null };
    eventSources.push(source);
    return source;
  });
  const webSocketConstructor = vi.fn(function MockWebSocket() {
    return {
      readyState: 0,
      addEventListener: vi.fn(),
      close: vi.fn(),
      send: vi.fn(),
    };
  });

  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("EventSource", eventSourceConstructor);
  vi.stubGlobal("WebSocket", webSocketConstructor);

  return { fetchSpy, eventSourceConstructor, eventSources, webSocketConstructor };
}

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return new URL(input, window.location.origin).pathname;
  if (input instanceof URL) return input.pathname;
  return new URL(input.url, window.location.origin).pathname;
}

function blockLocalStorageAccess() {
  const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
  if (!descriptor?.configurable) throw new Error("localStorage cannot be stubbed in this test environment");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage is unavailable", "SecurityError");
    },
  });
  return () => Object.defineProperty(window, "localStorage", descriptor);
}

const privateDataPath = /(?:^|\/)(?:chat|applicants?|presence|events?|whiteboards?|collab(?:oration)?|boards?|documents?|spreadsheets?)(?:\/|$)/i;
const signedInSession = { authenticated: true, interviewerId: "test-interviewer", label: "Test Interviewer" };
const applicantCanary = "PrivateApplicantAfterSignoutCanary";
const chatCanary = "PrivateChatAfterSignoutCanary";

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" } as unknown as Headers,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function errorResponse(status: number, statusText: string, payload: unknown): Response {
  return {
    ok: false,
    status,
    statusText,
    headers: { get: () => "application/json" } as unknown as Headers,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function unauthorizedResponse(): Response {
  return errorResponse(401, "Unauthorized", { error: "Session revoked" });
}

afterEach(() => {
  queryClient.clear();
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_SESSION_END_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_SESSION_ACTIVE_STORAGE_KEY);
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith("robotics_admin_chat_draft:")) window.sessionStorage.removeItem(key);
  }
  window.localStorage.removeItem("robotics-workspace-settings");
  MockBroadcastChannel.channels.clear();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
  window.history.replaceState({}, "", "/");
});

describe("chat draft storage", () => {
  it("keeps drafts in the current tab under separate interviewer and conversation keys", () => {
    const interviewerAKey = getChatDraftStorageKey("interviewer-a", "shared:Interviewer A:");
    const interviewerBKey = getChatDraftStorageKey("interviewer-b", "shared:Interviewer B:");
    const directChatKey = getChatDraftStorageKey("interviewer-a", "direct:Interviewer A:Jordan");

    expect(interviewerAKey).not.toBeNull();
    expect(interviewerBKey).not.toBe(interviewerAKey);
    expect(directChatKey).not.toBe(interviewerAKey);
    saveChatDraft(interviewerAKey, "A private unsent note");

    expect(loadChatDraft(interviewerAKey)).toBe("A private unsent note");
    expect(loadChatDraft(interviewerBKey)).toBe("");
    expect(loadChatDraft(directChatKey)).toBe("");

    saveChatDraft(interviewerAKey, "");
    expect(loadChatDraft(interviewerAKey)).toBe("");
    saveChatDraft(interviewerAKey, "Another unsent note");
    clearChatDraft(interviewerAKey);
    expect(loadChatDraft(interviewerAKey)).toBe("");
  });
});

describe("public chat discovery", () => {
  it("links from the public platform while preserving the interview landing", () => {
    renderWithRouter(<PublicDashboard />);

    expect(screen.getByTestId("link-chat-entry")).toHaveAttribute("href", "/chat-landing");
    expect(screen.getByTestId("link-interview-entry")).toHaveAttribute("href", "/interview-landing");
  });

  it("renders static collaboration content and keeps workspace data private", () => {
    renderWithRouter(<ChatLanding />);

    expect(screen.getByRole("heading", { level: 1, name: /talk through the work/i })).toBeInTheDocument();
    expect(screen.getByTestId("card-chat-workspace-preview")).toHaveTextContent("STATIC VIEW");
    expect(screen.getByTestId("card-team-conversations")).toHaveTextContent("Focused channels");
    expect(screen.getByTestId("card-direct-conversations")).toHaveTextContent("DIRECT CONVERSATIONS");
    expect(screen.getByTestId("card-file-context")).toHaveTextContent("CONTEXT ATTACHED");
    expect(screen.getByTestId("section-chat-tools")).toHaveTextContent("Work boards");
    expect(screen.queryByTestId("section-chat-boundary")).not.toBeInTheDocument();
  });

  it("sends every sign-in action to the existing auth route", () => {
    renderWithRouter(<ChatLanding />);

    for (const testId of ["link-chat-nav-sign-in", "link-chat-hero-sign-in", "link-chat-cta-sign-in"]) {
      expect(screen.getByTestId(testId)).toHaveAttribute("href", "/auth");
    }
    expect(screen.getByTestId("link-chat-back-platform")).toHaveAttribute("href", "/");
  });

  it("keeps the mobile navigation keyboard reachable and exposes its expanded state", () => {
    renderWithRouter(<ChatLanding />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    const navigation = screen.getByRole("navigation", { name: "Chat landing navigation" });
    expect(menuButton).toHaveAttribute("type", "button");
    expect(menuButton).toHaveAttribute("aria-controls", navigation.id);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect((menuButton as HTMLButtonElement).tabIndex).toBe(0);

    (menuButton as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(menuButton);
    fireEvent.click(menuButton);

    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
    expect(navigation).toHaveClass("is-open");
    expect(screen.getByTestId("link-chat-conversations")).toBeInTheDocument();
    expect(screen.getByTestId("link-chat-context")).toBeInTheDocument();
    expect(screen.getByTestId("link-chat-tools")).toBeInTheDocument();

    const navigationLink = screen.getByTestId("link-chat-conversations");
    navigationLink.focus();
    expect(document.activeElement).toBe(navigationLink);
    fireEvent.keyDown(document, { key: "Escape" });

    const closedMenuButton = screen.getByRole("button", { name: "Open navigation" });
    expect(closedMenuButton).toHaveAttribute("aria-expanded", "false");
    expect(navigation).not.toHaveClass("is-open");
    expect(document.activeElement).toBe(closedMenuButton);
  });

  it("keeps landing text and the expanded menu legible with html.dark enabled", () => {
    document.documentElement.classList.add("dark");
    renderWithRouter(<ChatLanding />);

    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByTestId("chat-landing")).toBeInTheDocument();

    const darkPage = cssRule(chatLandingStyles, ".dark .chat-landing");
    const pageInk = cssProperty(darkPage, "--chat-ink");
    const mutedInk = cssProperty(darkPage, "--chat-muted");
    const paper = cssProperty(darkPage, "--chat-paper");
    expect(contrastRatio(pageInk, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(mutedInk, paper)).toBeGreaterThanOrEqual(4.5);

    const darkNavigation = cssRule(chatLandingStyles, ".dark .chat-landing__nav-links {");
    const darkNavigationLinks = cssRule(
      chatLandingStyles,
      ".dark .chat-landing__nav-links a:not(.chat-landing__nav-cta)",
    );
    expect(contrastRatio(cssProperty(darkNavigationLinks, "color"), cssProperty(darkNavigation, "background")))
      .toBeGreaterThanOrEqual(4.5);
    expect(cssRule(chatLandingStyles, ".dark .chat-landing__menu-button")).toContain("#e4f0eb");
  });

  it("preserves high-contrast focus, mobile menu states, and reduced-motion styles", () => {
    const focusStyles = cssRule(chatLandingStyles, ".chat-landing a:focus-visible");
    expect(focusStyles).toMatch(/outline:\s*3px solid/);
    expect(focusStyles).toMatch(/outline-offset:\s*4px/);
    const buttonFocusStyles = cssRule(chatLandingStyles, ".chat-landing button:focus-visible");
    expect(buttonFocusStyles).toMatch(/outline:\s*3px solid/);
    expect(buttonFocusStyles).toMatch(/outline-offset:\s*4px/);
    const lightPaper = cssProperty(cssRule(chatLandingStyles, ".chat-landing"), "--chat-paper");
    const lightFocusColor = colorFromDeclaration(cssProperty(focusStyles, "outline"));
    expect(contrastRatio(lightFocusColor, lightPaper)).toBeGreaterThanOrEqual(3);

    const lightCtaFocusColor = colorFromDeclaration(
      cssProperty(cssRule(chatLandingStyles, ".chat-landing__cta a:focus-visible"), "outline-color"),
    );
    const lightCtaSurface = cssProperty(cssRule(chatLandingStyles, ".chat-landing"), "--chat-deep");
    expect(contrastRatio(lightCtaFocusColor, lightCtaSurface)).toBeGreaterThanOrEqual(3);

    const darkPage = cssRule(chatLandingStyles, ".dark .chat-landing");
    const darkPaper = cssProperty(darkPage, "--chat-paper");
    const darkFocusColor = cssProperty(
      cssRule(chatLandingStyles, ".dark .chat-landing a:focus-visible"),
      "outline-color",
    );
    expect(contrastRatio(darkFocusColor, darkPaper)).toBeGreaterThanOrEqual(3);
    const darkButtonFocusColor = cssProperty(
      cssRule(chatLandingStyles, ".dark .chat-landing button:focus-visible"),
      "outline-color",
    );
    expect(contrastRatio(darkButtonFocusColor, darkPaper)).toBeGreaterThanOrEqual(3);
    const darkCtaFocusColor = cssProperty(
      cssRule(chatLandingStyles, ".dark .chat-landing__cta a:focus-visible"),
      "outline-color",
    );
    expect(contrastRatio(darkCtaFocusColor, cssProperty(darkPage, "--chat-deep"))).toBeGreaterThanOrEqual(3);

    const mobileQueryStart = chatLandingStyles.indexOf("@media (max-width: 760px)");
    expect(mobileQueryStart).toBeGreaterThanOrEqual(0);
    const mobileStyles = extractCssBlock(chatLandingStyles, mobileQueryStart);
    expect(cssProperty(cssRule(mobileStyles, ".chat-landing__nav-links"), "display")).toBe("none");
    expect(cssProperty(cssRule(mobileStyles, ".chat-landing__nav-links.is-open"), "display")).toBe("flex");

    const reducedMotionStart = chatLandingStyles.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(reducedMotionStart).toBeGreaterThanOrEqual(0);
    const reducedMotionStyles = extractCssBlock(chatLandingStyles, reducedMotionStart);
    const reducedMotionRule = cssRule(reducedMotionStyles, ".chat-landing *");
    expect(cssProperty(reducedMotionRule, "transition-duration")).toBe(".01ms !important");
    expect(cssProperty(reducedMotionRule, "animation-duration")).toBe(".01ms !important");
    expect(cssProperty(reducedMotionRule, "animation-iteration-count")).toBe("1 !important");
  });

  it("uses a system focus color for controls in forced-colors mode", () => {
    const forcedColorsStart = chatLandingStyles.indexOf("@media (forced-colors: active)");
    expect(forcedColorsStart).toBeGreaterThanOrEqual(0);
    const forcedColorsStyles = extractCssBlock(chatLandingStyles, forcedColorsStart);
    const focusStyles = cssRule(forcedColorsStyles, ".chat-landing a:focus-visible");

    expect(forcedColorsStyles).toMatch(
      /\.chat-landing a:focus-visible,\s*\.chat-landing button:focus-visible,\s*\.chat-landing h2:focus-visible\s*\{/,
    );
    expect(cssProperty(focusStyles, "outline-color")).toBe("Highlight !important");
  });

  it.each(["/", "/chat-landing"])(
    "keeps visitor route %s free of private requests and records",
    async (path) => {
      window.history.replaceState({}, "", path);
      const network = stubNetworkTransports();

      render(<App />);

      if (path === "/") {
        expect(screen.getByRole("heading", { level: 1, name: /one home for the whole robotics team/i })).toBeInTheDocument();
      } else {
        expect(screen.getByRole("heading", { level: 1, name: /talk through the work/i })).toBeInTheDocument();
        expect(screen.getByTestId("card-chat-workspace-preview")).toHaveTextContent("STATIC VIEW");
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(network.fetchSpy).not.toHaveBeenCalled();
      expect(network.eventSourceConstructor).not.toHaveBeenCalled();
      expect(network.webSocketConstructor).not.toHaveBeenCalled();
      for (const canary of privateRecordCanaries) {
        expect(document.body.textContent).not.toContain(canary);
      }
    },
  );

  it("redirects direct Parts assistant visits to sign-in before private requests start", async () => {
    window.history.replaceState({}, "", "/parts/assistant");
    const network = stubNetworkTransports(async (input) => {
      if (requestPath(input) === "/api/auth/session") return jsonResponse({ authenticated: false });
      return privateRecordsResponse;
    });

    render(<App />);

    expect(await screen.findByTestId("input-event-passcode")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
    expect(new URLSearchParams(window.location.search).get("returnTo")).toBe("/parts/assistant");

    const requestedPaths = network.fetchSpy.mock.calls.map(([input]) => requestPath(input));
    expect(requestedPaths.length).toBeGreaterThan(0);
    expect(requestedPaths.every((path) => path === "/api/auth/session")).toBe(true);
    expect(network.eventSourceConstructor).not.toHaveBeenCalled();
    expect(network.webSocketConstructor).not.toHaveBeenCalled();
    for (const canary of privateRecordCanaries) {
      expect(document.body.textContent).not.toContain(canary);
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .not.toContain(canary);
    }
  });

  it.each(["/", "/chat-landing"])(
    "clears signed-in chat and applicant records before navigating to %s",
    async (publicPath) => {
      window.history.replaceState({}, "", "/chat");
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "test-session-token");
      window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ realtime: true, autoRefresh: false }));
      let authenticated = true;
      const network = stubNetworkTransports(async (input) => {
        const path = requestPath(input);
        if (path === "/api/auth/session") return jsonResponse(authenticated ? signedInSession : { authenticated: false });
        if (path === "/api/auth/logout") {
          authenticated = false;
          return jsonResponse({ message: "Logged out" });
        }
        if (path === "/api/applicants") {
          return jsonResponse({
            items: [{
              id: "private-applicant",
              name: applicantCanary,
              grade: "10",
              age: null,
              gender: null,
              aiScore: 0,
              aiRecommendation: "",
              aiSummary: "",
              aiStrengths: "",
              aiConcerns: "",
              roboticsExperience: "",
              commit10Hours: "",
              parentVolunteer: "",
              interviewStatus: "queued",
              category: "unranked",
              rank: 1,
              notes: "",
              queuePosition: 1,
            }],
            total: 1,
          });
        }
        if (path === "/api/queue/chat") {
          return jsonResponse({
            scope: "shared",
            peer: null,
            items: [{
              id: "private-chat-message",
              author: "Test Interviewer",
              message: chatCanary,
              scope: "shared",
              peer: null,
              createdAt: new Date(0).toISOString(),
            }],
          });
        }
        if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
        if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
        if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
        if (path === "/api/custom-workspaces") return Response.json({ workspaces: [] });
        return jsonResponse({});
      });

      render(<App />);

      await waitFor(() => {
        expect(queryClient.isFetching()).toBe(0);
        expect(document.getElementById("chat-message-private-chat-message")?.textContent).toContain(chatCanary);
      });
      expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).toContain("/api/applicants");
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .toContain(applicantCanary);
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .toContain(chatCanary);
      expect(network.eventSourceConstructor).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId("button-logout"));

      await waitFor(() => {
        expect(window.location.pathname).toBe("/");
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      });
      if (publicPath === "/chat-landing") {
        fireEvent.click(screen.getByTestId("link-chat-entry"));
        await waitFor(() => expect(window.location.pathname).toBe("/chat-landing"));
      }
      if (publicPath === "/") {
        expect(screen.getByRole("heading", { level: 1, name: /one home for the whole robotics team/i })).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("link-public-sign-in"));
      } else {
        expect(screen.getByRole("heading", { level: 1, name: /talk through the work/i })).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("link-chat-nav-sign-in"));
      }
      await waitFor(() => expect(window.location.pathname).toBe("/auth"));
      expect(screen.queryByTestId("session-expired")).not.toBeInTheDocument();
      expect(network.eventSources[0].close).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
      expect(window.localStorage.getItem(AUTH_SESSION_END_STORAGE_KEY)).toContain('"session-ended"');
      expect(document.body.textContent).not.toContain(applicantCanary);
      expect(document.body.textContent).not.toContain(chatCanary);

      const privateFetchCountAfterLogout = network.fetchSpy.mock.calls
        .map(([input]) => requestPath(input))
        .filter((path) => privateDataPath.test(path)).length;
      network.eventSources[0].onmessage?.({ data: JSON.stringify({ table: "applicants" }) } as MessageEvent);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(network.eventSourceConstructor).toHaveBeenCalledTimes(1);
      expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))
        .filter((path) => privateDataPath.test(path))).toHaveLength(privateFetchCountAfterLogout);
      expect(queryClient.getQueryCache().getAll().every((query) =>
        JSON.stringify(query.queryKey) === JSON.stringify(getGetSessionQueryKey()) ||
        JSON.stringify(query.queryKey) === JSON.stringify(getListInterviewersQueryKey()),
      )).toBe(true);
      expect(document.body.textContent).not.toContain(applicantCanary);
      expect(document.body.textContent).not.toContain(chatCanary);
    },
  );

  it.each([
    { sessionType: "cookie", token: null, transport: "BroadcastChannel", channelBehavior: "available", storageBlocked: false },
    { sessionType: "bearer-token fallback", token: "cross-tab-session-token", transport: "BroadcastChannel", channelBehavior: "available", storageBlocked: false },
    { sessionType: "cookie", token: null, transport: "storage event", channelBehavior: "unavailable", storageBlocked: false },
    { sessionType: "bearer-token fallback", token: "cross-tab-session-token", transport: "storage event", channelBehavior: "unavailable", storageBlocked: false },
    { sessionType: "cookie", token: null, transport: "storage event", channelBehavior: "constructor throws", storageBlocked: false },
    { sessionType: "cookie", token: null, transport: "BroadcastChannel", channelBehavior: "available", storageBlocked: true },
  ])(
    "clears private data and closes realtime in another tab for a $sessionType session via $transport when BroadcastChannel is $channelBehavior (storage blocked: $storageBlocked)",
    async ({ token, transport, channelBehavior, storageBlocked }) => {
      window.history.replaceState({}, "", "/chat");
      if (token) window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ realtime: true, autoRefresh: false }));
      if (channelBehavior === "constructor throws") {
        vi.stubGlobal("BroadcastChannel", class {
          constructor() {
            throw new Error("BroadcastChannel construction failed");
          }
        });
      } else if (channelBehavior === "available") {
        vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
      } else {
        vi.stubGlobal("BroadcastChannel", undefined);
      }

      const network = stubNetworkTransports(async (input) => {
        const path = requestPath(input);
        // Simulate a delayed session lookup that still reports the old session after the broadcast.
        if (path === "/api/auth/session") return jsonResponse(signedInSession);
        if (path === "/api/applicants") {
          return jsonResponse({
            items: [{
              id: "cross-tab-private-applicant",
              name: "CrossTabPrivateApplicantCanary",
              grade: "10",
              age: null,
              gender: null,
              aiScore: 0,
              aiRecommendation: "",
              aiSummary: "",
              aiStrengths: "",
              aiConcerns: "",
              roboticsExperience: "",
              commit10Hours: "",
              parentVolunteer: "",
              interviewStatus: "queued",
              category: "unranked",
              rank: 1,
              notes: "",
              queuePosition: 1,
            }],
            total: 1,
          });
        }
        if (path === "/api/queue/chat") {
          return jsonResponse({
            scope: "shared",
            peer: null,
            items: [{
              id: "cross-tab-private-message",
              author: "Test Interviewer",
              message: "CrossTabPrivateRecordCanary",
              scope: "shared",
              peer: null,
              createdAt: new Date(0).toISOString(),
            }],
          });
        }
        if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
        if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
        if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
        return jsonResponse({});
      });

      render(<App />);

      await waitFor(() => {
        expect(document.getElementById("chat-message-cross-tab-private-message")?.textContent)
          .toContain("CrossTabPrivateRecordCanary");
        expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
          .toContain("CrossTabPrivateApplicantCanary");
      });
      await waitFor(() => expect(network.eventSourceConstructor).toHaveBeenCalledTimes(1));

      const message = { type: "session-ended", id: `remote-${transport}-${token ?? "cookie"}`, source: "another-tab" };
      const restoreLocalStorage = storageBlocked ? blockLocalStorageAccess() : () => undefined;
      try {
        await act(async () => {
          if (transport === "BroadcastChannel") {
            const sender = new MockBroadcastChannel(AUTH_SESSION_CHANNEL_NAME);
            sender.postMessage(message);
            sender.close();
          } else {
            window.dispatchEvent(new StorageEvent("storage", {
              key: AUTH_SESSION_END_STORAGE_KEY,
              newValue: JSON.stringify(message),
            }));
          }
        });

        await waitFor(() => {
          expect(window.location.pathname).toBe("/auth");
          expect(new URLSearchParams(window.location.search).get("returnTo")).toBe("/chat");
          expect(network.eventSources[0].close).toHaveBeenCalledTimes(1);
          const cachedPrivateData = JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data));
          expect(cachedPrivateData).not.toContain("CrossTabPrivateRecordCanary");
          expect(cachedPrivateData).not.toContain("CrossTabPrivateApplicantCanary");
        });
        expect(await screen.findByTestId("session-ended-in-another-tab"))
          .toHaveTextContent("Your session ended in another tab. Sign in again to continue.");
        expect(document.body.textContent).not.toContain("CrossTabPrivateRecordCanary");
        expect(document.body.textContent).not.toContain("CrossTabPrivateApplicantCanary");
      } finally {
        restoreLocalStorage();
      }

      expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    },
  );

  it("returns to /chat after signing in from its protected route", async () => {
    window.history.replaceState({}, "", "/chat");
    let authenticated = false;
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") {
        return jsonResponse(authenticated ? signedInSession : { authenticated: false });
      }
      if (path === "/api/auth/verify-event-passcode") {
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "return-interviewer", displayName: "Return Interviewer", hasPassword: true }] });
      }
      if (path === "/api/auth/login") {
        authenticated = true;
        return jsonResponse({
          authenticated: true,
          interviewerId: "return-interviewer",
          label: "Return Interviewer",
          token: "return-interviewer-token",
        });
      }
      if (path === "/api/queue/chat") return jsonResponse({ scope: "shared", peer: null, items: [] });
      if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
      if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
      if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
      if (path === "/api/applicants") return jsonResponse({ items: [], total: 0 });
      return jsonResponse({});
    });

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/auth"));
    expect(new URLSearchParams(window.location.search).get("returnTo")).toBe("/chat");
    expect(screen.queryByRole("heading", { name: "Team chat" })).not.toBeInTheDocument();
    expect(screen.queryByText("Coordinator workspace")).not.toBeInTheDocument();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).not.toContainEqual(
      expect.stringMatching(privateDataPath),
    );
    expect(network.eventSourceConstructor).not.toHaveBeenCalled();
    expect(network.webSocketConstructor).not.toHaveBeenCalled();

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    fireEvent.click(await screen.findByTestId("button-choose-interviewer-return-interviewer"));
    fireEvent.change(screen.getByTestId("input-personal-password"), { target: { value: "account-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    await waitFor(() => expect(window.location.pathname).toBe("/chat"));
    expect(await screen.findByRole("heading", { name: "Team chat" })).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("return-interviewer-token");
  });

  it("shows credential guidance for rejected sign-in without a cross-tab notice", async () => {
    window.history.replaceState({}, "", "/auth");
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse({ authenticated: false });
      if (path === "/api/auth/verify-event-passcode") {
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "interviewer-a", displayName: "Interviewer A", hasPassword: true }] });
      }
      if (path === "/api/auth/login") {
        return errorResponse(401, "Unauthorized", { error: "Incorrect interviewer or password" });
      }
      return jsonResponse({});
    });

    render(<App />);

    expect(screen.queryByTestId("session-ended-in-another-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-expired")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    fireEvent.click(await screen.findByTestId("button-choose-interviewer-interviewer-a"));
    fireEvent.change(screen.getByTestId("input-personal-password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    expect(await screen.findByTestId("login-error")).toHaveTextContent(
      "The team access code or personal password is incorrect.",
    );
    expect(screen.queryByTestId("session-ended-in-another-tab")).not.toBeInTheDocument();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).toContain("/api/auth/login");
  });

  it("shows the expiry notice when a cookie-only session expires between page loads", async () => {
    window.history.replaceState({}, "", "/auth");
    window.sessionStorage.setItem(AUTH_SESSION_ACTIVE_STORAGE_KEY, "1");
    const network = stubNetworkTransports(async (input) => {
      if (requestPath(input) === "/api/auth/session") return jsonResponse({ authenticated: false });
      return jsonResponse({});
    });

    render(<App />);

    expect(await screen.findByTestId("session-expired"))
      .toHaveTextContent("Your session expired. Sign in again to continue.");
    expect(screen.getByTestId("input-event-passcode")).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_SESSION_ACTIVE_STORAGE_KEY)).toBeNull();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input)))
      .not.toContain("/api/auth/login");
  });

  it("keeps the user on the team access-code step when the code is incorrect", async () => {
    window.history.replaceState({}, "", "/auth");
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse({ authenticated: false });
      if (path === "/api/auth/verify-event-passcode") {
        return errorResponse(401, "Unauthorized", { error: "The team access code is incorrect." });
      }
      return jsonResponse({});
    });

    render(<App />);

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "wrong-team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));

    expect(await screen.findByTestId("login-error"))
      .toHaveTextContent("That team access code is incorrect. Check it and try again.");
    expect(screen.getByRole("heading", { name: "Enter your team access code." })).toBeInTheDocument();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input)))
      .toContain("/api/auth/verify-event-passcode");
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input)))
      .not.toContain("/api/auth/interviewers");
  });

  it("retries a temporary passcode-check outage before advancing", async () => {
    window.history.replaceState({}, "", "/auth");
    let verificationAttempts = 0;
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse({ authenticated: false });
      if (path === "/api/auth/verify-event-passcode") {
        verificationAttempts += 1;
        if (verificationAttempts === 1) {
          return errorResponse(502, "Bad Gateway", { error: "Service starting" });
        }
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "interviewer-a", displayName: "Interviewer A", hasPassword: true }] });
      }
      return jsonResponse({});
    });

    render(<App />);

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));

    expect(await screen.findByTestId("button-choose-interviewer-interviewer-a")).toBeInTheDocument();
    expect(verificationAttempts).toBe(2);
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input)))
      .toContain("/api/auth/verify-event-passcode");
  });

  it("retries a temporary team-account outage before showing the account list", async () => {
    window.history.replaceState({}, "", "/auth");
    let interviewerAttempts = 0;
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse({ authenticated: false });
      if (path === "/api/auth/verify-event-passcode") {
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers") {
        interviewerAttempts += 1;
        if (interviewerAttempts === 1) {
          return errorResponse(503, "Service Unavailable", { error: "Service starting" });
        }
        return jsonResponse({ items: [{ id: "interviewer-a", displayName: "Interviewer A", hasPassword: true }] });
      }
      return jsonResponse({});
    });

    render(<App />);

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));

    expect(await screen.findByTestId("button-choose-interviewer-interviewer-a", {}, { timeout: 6000 })).toBeInTheDocument();
    expect(interviewerAttempts).toBe(2);
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input)))
      .toContain("/api/auth/interviewers");
  });

  it.each([
    [
      "network",
      async () => { throw new TypeError("Failed to fetch"); },
      "Sign-in is temporarily unavailable. Check your connection and try again.",
    ],
    [
      "server",
      async () => errorResponse(503, "Service Unavailable", { error: "Service unavailable" }),
      "Sign-in is temporarily unavailable. Check your connection and try again.",
    ],
    [
      "rate-limit",
      async () => errorResponse(429, "Too Many Requests", { error: "Too many attempts" }),
      "Too many sign-in attempts. Wait a minute and try again.",
    ],
  ])("shows retry guidance for a %s sign-in failure", async (_failureKind, failLogin, expectedMessage) => {
    window.history.replaceState({}, "", "/auth");
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse({ authenticated: false });
      if (path === "/api/auth/verify-event-passcode") {
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "interviewer-a", displayName: "Interviewer A", hasPassword: true }] });
      }
      if (path === "/api/auth/login") return failLogin();
      return jsonResponse({});
    });

    render(<App />);

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    fireEvent.click(await screen.findByTestId("button-choose-interviewer-interviewer-a"));
    fireEvent.change(screen.getByTestId("input-personal-password"), { target: { value: "account-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    expect(await screen.findByTestId("login-error", {}, { timeout: 6000 })).toHaveTextContent(expectedMessage);
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).toContain("/api/auth/login");
  });

  it.each([
    {
      operation: "password setup",
      failureKind: "incorrect team access code",
      requestPath: "/api/auth/interviewers/setup",
      method: "POST",
      failRequest: async () => errorResponse(401, "Unauthorized", { error: "The team access code is incorrect." }),
      expectedMessage: "The team access code is incorrect. Check it and try again.",
    },
    {
      operation: "password setup",
      failureKind: "network outage",
      requestPath: "/api/auth/interviewers/setup",
      method: "POST",
      failRequest: async () => { throw new TypeError("Failed to fetch"); },
      expectedMessage: "Account setup is temporarily unavailable. Check your connection and try again.",
    },
    {
      operation: "password setup",
      failureKind: "server outage",
      requestPath: "/api/auth/interviewers/setup",
      method: "POST",
      failRequest: async () => errorResponse(503, "Service Unavailable", { error: "Service unavailable" }),
      expectedMessage: "Account setup is temporarily unavailable. Check your connection and try again.",
    },
    {
      operation: "account creation",
      failureKind: "incorrect team access code",
      requestPath: "/api/auth/interviewers",
      method: "POST",
      failRequest: async () => errorResponse(401, "Unauthorized", { error: "The team access code is incorrect." }),
      expectedMessage: "The team access code is incorrect. Check it and try again.",
    },
    {
      operation: "account creation",
      failureKind: "network outage",
      requestPath: "/api/auth/interviewers",
      method: "POST",
      failRequest: async () => { throw new TypeError("Failed to fetch"); },
      expectedMessage: "Account setup is temporarily unavailable. Check your connection and try again.",
    },
    {
      operation: "account creation",
      failureKind: "server outage",
      requestPath: "/api/auth/interviewers",
      method: "POST",
      failRequest: async () => errorResponse(503, "Service Unavailable", { error: "Service unavailable" }),
      expectedMessage: "Account setup is temporarily unavailable. Check your connection and try again.",
    },
  ])("shows the right retry guidance for $failureKind during $operation", async ({
    operation,
    requestPath: failedPath,
    method: failedMethod,
    failRequest,
    expectedMessage,
  }) => {
    window.history.replaceState({}, "", "/auth");
    const network = stubNetworkTransports(async (input, init) => {
      const path = requestPath(input);
      const requestMethod = init?.method?.toUpperCase() ?? (input instanceof Request ? input.method.toUpperCase() : "GET");
      if (path === "/api/auth/session") return jsonResponse({ authenticated: false });
      if (path === "/api/auth/verify-event-passcode") {
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers" && requestMethod === "GET") {
        return jsonResponse({ items: [{ id: "interviewer-a", displayName: "Interviewer A", hasPassword: false }] });
      }
      if (path === failedPath && requestMethod === failedMethod) return failRequest();
      return jsonResponse({});
    });

    render(<App />);

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    if (operation === "password setup") {
      fireEvent.click(await screen.findByTestId("button-choose-interviewer-interviewer-a"));
    } else {
      fireEvent.click(await screen.findByTestId("button-add-interviewer"));
      fireEvent.change(await screen.findByTestId("input-new-interviewer-name"), { target: { value: "New Interviewer" } });
      fireEvent.click(screen.getByTestId("button-continue-add-interviewer"));
    }
    fireEvent.change(screen.getByTestId("input-personal-password"), { target: { value: "account-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    expect(await screen.findByTestId("login-error")).toHaveTextContent(expectedMessage);
    expect(network.fetchSpy.mock.calls.some(([input, init]) => (
      requestPath(input) === failedPath &&
      (init?.method?.toUpperCase() ?? (input instanceof Request ? input.method.toUpperCase() : "GET")) === failedMethod
    ))).toBe(true);
  });

  it("does not show a cross-tab notice on ordinary sign-in or invalid-password errors", async () => {
    window.history.replaceState({}, "", "/auth");
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse({ authenticated: false });
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "interviewer-a", displayName: "Interviewer A", hasPassword: true }] });
      }
      if (path === "/api/auth/login") return unauthorizedResponse();
      return jsonResponse({});
    });

    render(<App />);

    expect(screen.queryByTestId("session-ended-in-another-tab")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    fireEvent.click(await screen.findByTestId("button-choose-interviewer-interviewer-a"));
    fireEvent.change(screen.getByTestId("input-personal-password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    expect(await screen.findByTestId("login-error")).toHaveTextContent(
      "The team access code or personal password is incorrect.",
    );
    expect(screen.queryByTestId("session-ended-in-another-tab")).not.toBeInTheDocument();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).toContain("/api/auth/login");
  });

  it("clears private records and closes realtime when the server expires a session", async () => {
    window.history.replaceState({}, "", "/chat");
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "expired-session-token");
    window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ realtime: true, autoRefresh: false }));
    let expired = false;
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse(expired ? { authenticated: false } : signedInSession);
      if (path === "/api/applicants") {
        return jsonResponse({
          items: [{
            id: "session-expiry-applicant",
            name: applicantCanary,
            grade: "10",
            age: null,
            gender: null,
            aiScore: 0,
            aiRecommendation: "",
            aiSummary: "",
            aiStrengths: "",
            aiConcerns: "",
            roboticsExperience: "",
            commit10Hours: "",
            parentVolunteer: "",
            interviewStatus: "queued",
            category: "unranked",
            rank: 1,
            notes: "",
            queuePosition: 1,
          }],
          total: 1,
        });
      }
      if (path === "/api/queue/chat") {
        return jsonResponse({
          scope: "shared",
          peer: null,
          items: [{
            id: "session-expiry-chat",
            author: "Test Interviewer",
            message: chatCanary,
            scope: "shared",
            peer: null,
            createdAt: new Date(0).toISOString(),
          }],
        });
      }
      if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
      if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
      if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
      return jsonResponse({});
    });

    render(<App />);

    await waitFor(() => {
      expect(document.getElementById("chat-message-session-expiry-chat")?.textContent).toContain(chatCanary);
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .toContain(applicantCanary);
    });
    await waitFor(() => expect(network.eventSourceConstructor).toHaveBeenCalledTimes(1));

    const publicInterviewerList = {
      items: [{ id: "interviewer-b", displayName: "Interviewer B", hasPassword: true }],
    };
    queryClient.setQueryData(getListInterviewersQueryKey(), publicInterviewerList);
    expired = true;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth");
      expect(network.eventSources[0].close).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .not.toContain(applicantCanary);
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .not.toContain(chatCanary);
    });
    expect(await screen.findByTestId("session-expired"))
      .toHaveTextContent("Your session expired. Sign in again to continue.");
    expect(screen.getByTestId("input-event-passcode")).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(document.body.textContent).not.toContain(applicantCanary);
    expect(document.body.textContent).not.toContain(chatCanary);
    expect(queryClient.getQueryCache().getAll().every((query) =>
      JSON.stringify(query.queryKey) === JSON.stringify(getGetSessionQueryKey()) ||
      JSON.stringify(query.queryKey) === JSON.stringify(getListInterviewersQueryKey()),
    )).toBe(true);
    expect(queryClient.getQueryData(getListInterviewersQueryKey())).toEqual(publicInterviewerList);
  });

  it("restores an unsent chat draft after a private request requires sign-in", async () => {
    window.history.replaceState({}, "", "/chat");
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "revoked-session-token");
    window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ realtime: true, autoRefresh: false }));
    let authenticated = true;
    let rejectPrivateRequest = false;
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse(authenticated ? signedInSession : { authenticated: false });
      if (path === "/api/auth/verify-event-passcode") {
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "test-interviewer", displayName: "Test Interviewer", hasPassword: true }] });
      }
      if (path === "/api/auth/login") {
        authenticated = true;
        rejectPrivateRequest = false;
        return jsonResponse({ ...signedInSession, token: "restored-session-token" });
      }
      if (path === "/api/queue/chat" && rejectPrivateRequest) {
        authenticated = false;
        return unauthorizedResponse();
      }
      if (path === "/api/queue/chat") {
        return jsonResponse({
          scope: "shared",
          peer: null,
          items: [{
            id: "rejected-request-chat",
            author: "Test Interviewer",
            message: chatCanary,
            scope: "shared",
            peer: null,
            createdAt: new Date(0).toISOString(),
          }],
        });
      }
      if (path === "/api/applicants") return jsonResponse({ items: [], total: 0 });
      if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
      if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
      if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
      return jsonResponse({});
    });

    render(<App />);

    const draftKey = getChatDraftStorageKey("test-interviewer", "shared:Test Interviewer:");
    const initialComposer = await screen.findByTestId("input-interviewer-chat");
    fireEvent.change(initialComposer, { target: { value: "Please compare the two robot designs." } });
    await waitFor(() => expect(loadChatDraft(draftKey)).toBe("Please compare the two robot designs."));

    await waitFor(() => expect(document.getElementById("chat-message-rejected-request-chat")?.textContent).toContain(chatCanary));
    await waitFor(() => expect(network.eventSourceConstructor).toHaveBeenCalledTimes(1));

    rejectPrivateRequest = true;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: getGetInterviewChatQueryKey() });
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth");
      expect(network.eventSources[0].close).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .not.toContain(chatCanary);
    });
    expect(await screen.findByTestId("session-expired"))
      .toHaveTextContent("Your session expired. Sign in again to continue.");
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(document.body.textContent).not.toContain(chatCanary);

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    fireEvent.click(await screen.findByTestId("button-choose-interviewer-test-interviewer"));
    fireEvent.change(screen.getByTestId("input-personal-password"), { target: { value: "account-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    await waitFor(() => expect(window.location.pathname).toBe("/chat"));
    const restoredComposer = await screen.findByTestId("input-interviewer-chat");
    expect(restoredComposer).toHaveValue("Please compare the two robot designs.");

    fireEvent.change(restoredComposer, { target: { value: "" } });
    await waitFor(() => expect(loadChatDraft(draftKey)).toBe(""));

    fireEvent.change(restoredComposer, { target: { value: "Send this note after signing in." } });
    await waitFor(() => expect(loadChatDraft(draftKey)).toBe("Send this note after signing in."));
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));
    await waitFor(() => {
      expect(network.fetchSpy.mock.calls.some(([input, init]) => (
        requestPath(input) === "/api/queue/chat" &&
        (init?.method?.toUpperCase() ?? (input instanceof Request ? input.method.toUpperCase() : "GET")) === "POST"
      ))).toBe(true);
      expect(loadChatDraft(draftKey)).toBe("");
    });
    expect(screen.getByTestId("input-interviewer-chat")).toHaveValue("");
  });

  it("does not carry cached records into a different interviewer's sign-in", async () => {
    // /dashboard is every signed-in user's home now, so request /chat explicitly.
    window.history.replaceState({}, "", "/auth?returnTo=%2Fchat");
    const oldAccountCanary = "PreviousInterviewerPrivateCanary";
    queryClient.setQueryData(getGetSessionQueryKey(), { authenticated: false }, { updatedAt: Date.now() + 60_000 });
    queryClient.setQueryData(getGetInterviewChatQueryKey(), {
      scope: "shared",
      peer: null,
      items: [{ id: "old-account-message", message: oldAccountCanary }],
    });

    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/verify-event-passcode") {
        return jsonResponse({ message: "Team access code verified." });
      }
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "interviewer-b", displayName: "Interviewer B", hasPassword: true }] });
      }
      if (path === "/api/auth/login") {
        return jsonResponse({
          authenticated: true,
          interviewerId: "interviewer-b",
          label: "Interviewer B",
          token: "interviewer-b-token",
        });
      }
      if (path === "/api/auth/session") {
        return jsonResponse({
          authenticated: true,
          interviewerId: "interviewer-b",
          label: "Interviewer B",
        });
      }
      if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
      if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
      if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
      if (path === "/api/applicants") return jsonResponse({ items: [], total: 0 });
      return jsonResponse({});
    });

    render(<App />);

    expect(queryClient.getQueryData(getGetInterviewChatQueryKey())).toBeDefined();
    fireEvent.change(screen.getByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    fireEvent.click(await screen.findByTestId("button-choose-interviewer-interviewer-b"));
    fireEvent.change(screen.getByTestId("input-personal-password"), { target: { value: "account-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/chat");
      expect(queryClient.getQueryData(getGetSessionQueryKey())).toMatchObject({
        authenticated: true,
        interviewerId: "interviewer-b",
        label: "Interviewer B",
      });
      expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data)))
        .not.toContain(oldAccountCanary);
    });
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("interviewer-b-token");
    expect(document.body.textContent).not.toContain(oldAccountCanary);
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).toContain("/api/auth/login");
  });

  it("reopens the selected applicant after the session expires and sign-in succeeds", async () => {
    window.history.replaceState({}, "", "/applicants");
    const applicantId = "applicant-to-restore";
    const applicant = {
      id: applicantId,
      name: "Maya Restorable",
      grade: "8th",
      age: 14,
      gender: "F",
      email: "maya@example.com",
      photoUrl: null,
      transcript: null,
      aiScore: 88,
      aiRecommendation: "Advance",
      aiSummary: "Strong candidate",
      aiStrengths: "Build experience",
      aiConcerns: "",
      roboticsExperience: "Built a robot",
      commit10Hours: "Yes",
      parentVolunteer: "No",
      interviewStatus: "queued",
      interviewer: "",
      interviewDecision: "",
      callbackRequested: false,
      flagged: false,
      attendance: "unmarked",
      lateArrivalTime: null,
      makeupDate: null,
      attendanceExcused: null,
      seatRow: null,
      seatCol: null,
      category: "advance",
      rank: 1,
      notes: "Applicant notes",
      queuePosition: 1,
    };
    const coordinatorSession = { ...signedInSession, role: "coordinator" };
    let authenticated = true;
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse(authenticated ? coordinatorSession : { authenticated: false });
      if (path === `/api/applicants/${applicantId}`) return jsonResponse(applicant);
      if (path === "/api/applicants") return jsonResponse({ items: [applicant], total: 1 });
      if (path === "/api/auth/verify-event-passcode") return jsonResponse({ message: "Team access code verified." });
      if (path === "/api/auth/interviewers") {
        return jsonResponse({ items: [{ id: "restoration-coordinator", displayName: "Restoration Coordinator", hasPassword: true, role: "coordinator" }] });
      }
      if (path === "/api/auth/login") {
        authenticated = true;
        return jsonResponse({
          authenticated: true,
          interviewerId: "restoration-coordinator",
          label: "Restoration Coordinator",
          role: "coordinator",
          token: "restoration-session-token",
        });
      }
      if (path === "/api/queue/chat") return jsonResponse({ scope: "shared", peer: null, items: [] });
      if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
      if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
      if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
      return jsonResponse({});
    });

    render(<App />);

    fireEvent.click(await screen.findByTestId(`button-open-applicant-${applicantId}`));
    await screen.findByTestId("button-close-detail");
    expect(new URL(window.location.href).searchParams.get("applicantId")).toBe(applicantId);
    expect(screen.getByRole("heading", { level: 2, name: applicant.name })).toBeInTheDocument();

    authenticated = false;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
    });
    await waitFor(() => expect(window.location.pathname).toBe("/auth"));
    expect(new URLSearchParams(window.location.search).get("returnTo"))
      .toBe(`/applicants?applicantId=${applicantId}`);

    fireEvent.change(await screen.findByTestId("input-event-passcode"), { target: { value: "team-code" } });
    fireEvent.click(screen.getByTestId("button-event-passcode"));
    fireEvent.click(await screen.findByTestId("button-choose-interviewer-restoration-coordinator"));
    fireEvent.change(await screen.findByTestId("input-personal-password"), { target: { value: "account-password" } });
    fireEvent.click(screen.getByTestId("button-personal-password"));

    await screen.findByTestId("button-close-detail");
    expect(window.location.pathname).toBe("/applicants");
    expect(new URL(window.location.href).searchParams.get("applicantId")).toBe(applicantId);
    expect(screen.getByRole("heading", { level: 2, name: applicant.name })).toBeInTheDocument();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input)))
      .toContain(`/api/applicants/${applicantId}`);
  });

  it.each([
    ["malformed", 400],
    ["deleted", 404],
  ])("returns to the applicant list when the requested applicant is %s", async (idKind, status) => {
    window.history.replaceState({}, "", `/applicants?applicantId=${idKind}-applicant`);
    const coordinatorSession = { ...signedInSession, role: "coordinator" };
    const network = stubNetworkTransports(async (input) => {
      const path = requestPath(input);
      if (path === "/api/auth/session") return jsonResponse(coordinatorSession);
      if (path === "/api/applicants") return jsonResponse({ items: [], total: 0 });
      if (path === `/api/applicants/${idKind}-applicant`) {
        return errorResponse(status, status === 404 ? "Not Found" : "Bad Request", { error: "Applicant not found" });
      }
      if (path === "/api/queue") return jsonResponse({ items: [], interviewerLabels: [] });
      if (path === "/api/queue/custom-emojis" || path === "/api/whiteboards") return jsonResponse({ items: [] });
      if (path === "/api/broadcasts/mine") return jsonResponse({ items: [] });
      return jsonResponse({});
    });

    render(<App />);

    await waitFor(() => {
      expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input)))
        .toContain(`/api/applicants/${idKind}-applicant`);
    });
    await waitFor(() => {
      expect(window.location.pathname).toBe("/applicants");
      expect(new URL(window.location.href).searchParams.has("applicantId")).toBe(false);
    });
    expect(screen.getByText("Review queue")).toBeInTheDocument();
  });
});

describe("sign-in return destinations", () => {
  it("keeps valid workspace routes and their query and hash", () => {
    expect(getSafeAuthReturnPath("/spreadsheets/board-7?tab=parts#cell-A1"))
      .toBe("/spreadsheets/board-7?tab=parts#cell-A1");
  });

  it.each([
    null,
    "",
    "https://outside.example/phishing",
    "//outside.example/phishing",
    "/auth",
    "/not-a-workspace-route",
  ])("uses the dashboard for an invalid return destination (%s)", (returnTo) => {
    expect(getSafeAuthReturnPath(returnTo)).toBe(DEFAULT_AUTH_RETURN_PATH);
  });
});