import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
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
];

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
  }),
} as Response;

function stubNetworkTransports(fetchImplementation: typeof fetch = async () => privateRecordsResponse) {
  const fetchSpy = vi.fn(fetchImplementation);
  const eventSourceConstructor = vi.fn().mockImplementation(() => ({ close: vi.fn() }));
  const webSocketConstructor = vi.fn().mockImplementation(() => ({
    readyState: 0,
    addEventListener: vi.fn(),
    close: vi.fn(),
    send: vi.fn(),
  }));

  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("EventSource", eventSourceConstructor);
  vi.stubGlobal("WebSocket", webSocketConstructor);

  return { fetchSpy, eventSourceConstructor, webSocketConstructor };
}

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return new URL(input, window.location.origin).pathname;
  if (input instanceof URL) return input.pathname;
  return new URL(input.url, window.location.origin).pathname;
}

const privateDataPath = /(?:^|\/)(?:chat|applicants?|presence|events?|whiteboards?|collab(?:oration)?|boards?|documents?|spreadsheets?)(?:\/|$)/i;

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
  window.history.replaceState({}, "", "/");
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

    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(navigation).not.toHaveClass("is-open");
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
    const darkCtaFocusColor = cssProperty(
      cssRule(chatLandingStyles, ".dark .chat-landing__cta a:focus-visible"),
      "outline-color",
    );
    expect(contrastRatio(darkCtaFocusColor, cssProperty(darkPage, "--chat-deep"))).toBeGreaterThanOrEqual(3);

    const mobileQueryStart = chatLandingStyles.indexOf("@media (max-width: 680px)");
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

  it("keeps /chat behind the signed-in workspace shell", async () => {
    window.history.replaceState({}, "", "/chat");
    const unauthorizedSession: Response = {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" } as unknown as Headers,
      text: async () => JSON.stringify({ authenticated: false }),
    } as Response;
    const network = stubNetworkTransports(async () => unauthorizedSession);

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/auth"));
    expect(screen.queryByRole("heading", { name: "Team chat" })).not.toBeInTheDocument();
    expect(screen.queryByText("Coordinator workspace")).not.toBeInTheDocument();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).not.toContainEqual(
      expect.stringMatching(privateDataPath),
    );
    expect(network.eventSourceConstructor).not.toHaveBeenCalled();
    expect(network.webSocketConstructor).not.toHaveBeenCalled();
  });
});