import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// A 672 CSS-pixel viewport approximates a 1344px desktop at 200% zoom.
const viewport = { width: 672, height: 900 };

async function assertKeyboardFocusVisible(locator, description) {
  const focus = await locator.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      active: document.activeElement === element,
      matchesFocusVisible: element.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  assert.equal(focus.active, true, `${description} should receive keyboard focus`);
  assert.equal(focus.matchesFocusVisible, true, `${description} should match :focus-visible`);
  assert.notEqual(focus.outlineStyle, "none", `${description} should show a focus indicator`);
  assert.ok(focus.outlineWidth >= 3, `${description} should have a strong focus outline: ${JSON.stringify(focus)}`);
}

async function tabUntilFocused(page, locator, description, maxTabs = 32) {
  for (let tabCount = 0; tabCount < maxTabs; tabCount += 1) {
    if (await locator.evaluate(element => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }

  assert.equal(
    await locator.evaluate(element => document.activeElement === element),
    true,
    `${description} should be reachable by pressing Tab`,
  );
}

async function assertDoesNotOverlap(first, second, description) {
  const [firstRect, secondRect] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  assert.ok(firstRect && secondRect, `${description} should be rendered`);
  const overlaps = firstRect.left < secondRect.right
    && firstRect.right > secondRect.left
    && firstRect.top < secondRect.bottom
    && firstRect.bottom > secondRect.top;
  assert.equal(overlaps, false, `${description} should not overlap`);
}

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") return reject(new Error("Could not allocate a test port"));
    server.close(error => (error ? reject(error) : resolve(address.port)));
  });
});

const server = spawn("pnpm", ["exec", "vite", "--config", "vite.config.ts", "--host", "127.0.0.1"], {
  cwd: appDir,
  env: { ...process.env, BASE_PATH: "/", PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.setEncoding("utf8").on("data", chunk => { serverOutput += chunk; });
server.stderr.setEncoding("utf8").on("data", chunk => { serverOutput += chunk; });

let browser;
try {
  const serverUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before starting:\n${serverOutput}`);
    try {
      const response = await fetch(`${serverUrl}/chat-landing`);
      if (response.ok) break;
    } catch {
      // Wait for Vite to bind the selected port.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const chromiumPath = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    "/repl/tools/bin/chromium",
  ].find(candidate => candidate && existsSync(candidate));
  browser = await chromium.launch({
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(`${serverUrl}/chat-landing`);
  await page.getByTestId("chat-landing").waitFor({ state: "visible" });

  const pageWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.equal(pageWidth.viewport, viewport.width);
  assert.ok(
    pageWidth.document <= pageWidth.viewport && pageWidth.body <= pageWidth.viewport,
    `The page should not overflow horizontally: ${JSON.stringify(pageWidth)}`,
  );

  const menuButton = page.getByTestId("button-chat-menu");
  const brand = page.getByTestId("link-chat-brand");
  assert.equal(await menuButton.isVisible(), true, "The zoom-width navigation menu should be available");
  assert.equal(await page.getByTestId("link-chat-nav-sign-in").isVisible(), false);
  assert.equal(await brand.evaluate(element => element.getBoundingClientRect().right <= window.innerWidth), true);
  assert.equal(
    await menuButton.evaluate(element => element.getBoundingClientRect().left >= 0),
    true,
    "The menu control should remain inside the viewport",
  );
  await assertDoesNotOverlap(brand, menuButton, "The brand and menu control");
  await assertDoesNotOverlap(
    page.locator(".chat-landing__hero-copy"),
    page.locator(".chat-landing__preview-wrap"),
    "The hero copy and workspace preview",
  );
  await assertDoesNotOverlap(
    page.getByTestId("link-chat-hero-sign-in"),
    page.getByTestId("link-chat-explore"),
    "The hero sign-in and explore actions",
  );
  await assertDoesNotOverlap(
    page.locator(".chat-landing__cta-content > div"),
    page.getByTestId("link-chat-cta-sign-in"),
    "The closing callout and sign-in action",
  );
  await assertDoesNotOverlap(
    page.locator(".chat-landing__conversation-head strong"),
    page.locator(".chat-landing__conversation-head span"),
    "The workspace channel name and label",
  );
  await assertDoesNotOverlap(
    page.locator(".chat-landing__context-top strong"),
    page.locator(".chat-landing__context-top span"),
    "The file-context title and status",
  );
  await assertDoesNotOverlap(
    page.getByTestId("card-team-conversations"),
    page.getByTestId("card-direct-conversations"),
    "The conversation feature cards",
  );
  await assertDoesNotOverlap(
    page.locator(".chat-landing__story-copy"),
    page.getByTestId("card-file-context"),
    "The context description and file preview",
  );
  await assertDoesNotOverlap(
    page.locator(".chat-landing__tools-copy"),
    page.locator(".chat-landing__tool-stack"),
    "The tools description and tool cards",
  );

  await page.keyboard.press("Tab");
  await assertKeyboardFocusVisible(brand, "The brand link");
  await page.keyboard.press("Tab");
  await assertKeyboardFocusVisible(menuButton, "The navigation menu button");

  await page.keyboard.press("Enter");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "true");
  for (const testId of ["link-chat-conversations", "link-chat-context", "link-chat-tools", "link-chat-nav-sign-in"]) {
    const link = page.getByTestId(testId);
    assert.equal(await link.isVisible(), true, `${testId} should be reachable in the open menu`);
    const rect = await link.evaluate(element => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    });
    assert.ok(rect.left >= 0 && rect.right <= viewport.width, `${testId} should fit within the viewport: ${JSON.stringify(rect)}`);
    await page.keyboard.press("Tab");
    await assertKeyboardFocusVisible(link, testId);
  }

  await page.keyboard.press("Escape");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "false", "Escape should close the menu");
  await assertKeyboardFocusVisible(menuButton, "The menu button after Escape");

  await page.keyboard.press("Enter");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Tab");
  const conversationsLink = page.getByTestId("link-chat-conversations");
  await assertKeyboardFocusVisible(conversationsLink, "The Conversations menu link");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.location.hash === "#conversations");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "false", "Section navigation should close the menu");
  assert.equal(await page.locator("#conversations").isVisible(), true, "The Conversations section should remain reachable");

  const sections = await page.locator(
    '[data-testid="section-chat-conversations"], [data-testid="section-chat-context"], [data-testid="section-chat-tools"], [data-testid="section-chat-cta"]',
  ).evaluateAll(elements => elements.map(element => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    return { left, right, top, bottom };
  }));
  assert.equal(sections.length, 4, "All main landing sections should be rendered");
  for (const section of sections) {
    assert.ok(section.left >= 0 && section.right <= viewport.width, `A landing section should fit the viewport: ${JSON.stringify(section)}`);
  }
  for (let index = 1; index < sections.length; index += 1) {
    assert.ok(sections[index].top >= sections[index - 1].bottom, "Landing sections should not overlap");
  }

  const meaningfulContent = await page.locator(
    ".chat-landing h1, .chat-landing h2, .chat-landing h3, .chat-landing p, .chat-landing a, .chat-landing button, .chat-landing [aria-label], .chat-landing__channel, .chat-landing__workspace-sidebar-label, .chat-landing__workspace-foot, .chat-landing__message-meta, .chat-landing__context-top, .chat-landing__file-context, .chat-landing__model-file",
  ).evaluateAll(elements => elements.map(element => {
    const { left, right } = element.getBoundingClientRect();
    return {
      label: element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 50),
      left,
      right,
    };
  }));
  for (const element of meaningfulContent) {
    assert.ok(
      element.left >= 0 && element.right <= viewport.width,
      `Meaningful content should not be clipped horizontally: ${JSON.stringify(element)}`,
    );
  }

  await page.goto(`${serverUrl}/chat-landing`);
  const heroSignIn = page.getByTestId("link-chat-hero-sign-in");
  await tabUntilFocused(page, heroSignIn, "The hero sign-in link");
  await assertKeyboardFocusVisible(heroSignIn, "The hero sign-in link");

  const ctaSignIn = page.getByTestId("link-chat-cta-sign-in");
  await tabUntilFocused(page, ctaSignIn, "The closing callout sign-in link");
  await assertKeyboardFocusVisible(ctaSignIn, "The closing callout sign-in link");

  for (const testId of ["link-chat-hero-sign-in", "link-chat-cta-sign-in"]) {
    const link = page.getByTestId(testId);
    await link.scrollIntoViewIfNeeded();
    assert.equal(await link.isVisible(), true, `${testId} should remain visible when reached`);
    assert.equal(await link.getAttribute("href"), "/auth");
    const rect = await link.evaluate(element => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    });
    assert.ok(rect.left >= 0 && rect.right <= viewport.width, `${testId} should fit within the viewport: ${JSON.stringify(rect)}`);
  }

  assert.deepEqual(pageErrors, [], "The landing should not raise browser errors at the zoom-equivalent width");
  console.log("Chromium verified the Chat landing at 672 CSS pixels: keyboard navigation, visible focus, sign-in links, sections, card layout, and horizontal fit.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}