import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewports = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
];
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
      const response = await fetch(`${serverUrl}/chat`);
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

  const page = await browser.newPage({ viewport: viewports[0], isMobile: true, hasTouch: true });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let body = {
      items: [],
      interviewerLabels: ["Browser Tester", "Jordan"],
      currentApplicants: [],
      nextApplicants: [],
      remainingCount: 0,
      completedCount: 0,
    };
    if (url.pathname === "/api/auth/session") {
      body = { authenticated: true, interviewerId: "mobile-chat-test", label: "Browser Tester" };
    } else if (url.pathname === "/api/queue/chat") {
      body = {
        items: [],
        scope: url.searchParams.get("scope") ?? "shared",
        peer: url.searchParams.get("peer"),
      };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(`${serverUrl}/chat`);
  await page.getByText("Signed in as Browser Tester").waitFor({ state: "visible" });

  const composer = page.locator(".chat-composer-shell");
  const input = page.getByTestId("input-interviewer-chat");
  const send = page.getByTestId("button-send-interviewer-chat");
  const actions = page.getByTestId("chat-composer-actions");
  const requiredControls = [
    ["button-chat-more", "More message options"],
    ["button-chat-formatting", "Formatting options"],
    ["button-chat-emoji", "Insert emoji"],
    ["button-chat-poll", "Create poll"],
    ["button-chat-schedule", "Schedule message send"],
    ["button-attach-chat", "Attach files"],
    ["button-chat-mic", "Choose voice input mode"],
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await input.focus();
    assert.equal(await input.evaluate(element => document.activeElement === element), true, `${viewport.width}px input should retain focus`);

    const geometry = await page.evaluate(() => {
      const inputEl = document.querySelector('[data-testid="input-interviewer-chat"]');
      const sendEl = document.querySelector('[data-testid="button-send-interviewer-chat"]');
      const composerEl = document.querySelector(".chat-composer-shell");
      const actionsEl = document.querySelector('[data-testid="chat-composer-actions"]');
      const feedEl = document.querySelector(".chat-message-feed");
      const rect = element => {
        const { left, right, width, top, bottom, height } = element.getBoundingClientRect();
        return { left, right, width, top, bottom, height };
      };
      return {
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        input: rect(inputEl),
        send: rect(sendEl),
        composer: rect(composerEl),
        actions: rect(actionsEl),
        feed: rect(feedEl),
        feedClientWidth: feedEl.clientWidth,
        feedScrollWidth: feedEl.scrollWidth,
      };
    });
    assert.equal(geometry.viewport, viewport.width);
    assert.ok(geometry.document <= viewport.width && geometry.body <= viewport.width,
      `${viewport.width}px chat page should not overflow horizontally: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.input.width >= 130,
      `${viewport.width}px message field should remain readable: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.input.right <= geometry.send.left,
      `${viewport.width}px send button should not overlap the message field: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.actions.left >= 0 && geometry.actions.right <= viewport.width,
      `${viewport.width}px toolbar should fit the viewport: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.feedScrollWidth <= geometry.feedClientWidth,
      `${viewport.width}px message history should not scroll horizontally: ${JSON.stringify(geometry)}`);

    for (const [testId, label] of requiredControls) {
      const control = page.getByTestId(testId);
      assert.equal(await control.isVisible(), true, `${viewport.width}px should show ${label}`);
      const controlSize = await control.boundingBox();
      assert.ok(controlSize && controlSize.width >= 40 && controlSize.height >= 40,
        `${viewport.width}px ${label} should have a comfortable touch target: ${JSON.stringify(controlSize)}`);
    }
  }

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const darkColors = await page.evaluate(() => ({
    surface: getComputedStyle(document.querySelector(".chat-composer-shell")).backgroundColor,
    text: getComputedStyle(document.querySelector('[data-testid="input-interviewer-chat"]')).color,
  }));
  assert.notEqual(darkColors.surface, "rgba(0, 0, 0, 0)", "dark composer should have a visible surface");
  assert.notEqual(darkColors.text, "rgba(0, 0, 0, 0)", "dark composer text should remain visible");
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  await page.getByTestId("button-chat-formatting").click();
  await page.getByRole("button", { name: "Bold" }).waitFor({ state: "visible" });
  await input.fill("mobile draft");
  await input.press("Home");
  await input.press("Shift+End");
  await page.getByRole("button", { name: "Bold" }).click();
  assert.equal(await input.inputValue(), "**mobile draft**", "formatting should still update the focused draft");

  await page.getByTestId("button-chat-emoji").click();
  await page.getByTestId("emoji-picker").waitFor({ state: "visible" });
  await page.getByTestId("button-chat-emoji").click();
  await page.getByTestId("button-chat-poll").click();
  await page.getByTestId("chat-poll-form").waitFor({ state: "visible" });
  await page.getByTestId("button-poll-cancel").click();
  await page.getByTestId("button-chat-schedule").click();
  await page.getByTestId("chat-schedule-menu").waitFor({ state: "visible" });
  await page.getByTestId("button-close-schedule-menu").click();
  await page.getByTestId("button-chat-mic").click();
  await page.getByTestId("voice-mode-menu").waitFor({ state: "visible" });
  await page.getByTestId("button-chat-mic").click();
  await page.getByTestId("button-chat-more").click();
  await page.getByTestId("composer-menu").waitFor({ state: "visible" });
  await page.getByTestId("button-upload-files").waitFor({ state: "visible" });
  const uploadChooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("button-upload-files").click();
  const uploadChooser = await uploadChooserPromise;
  await uploadChooser.setFiles({
    name: "mobile-chat-note.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nMobile chat attachment"),
  });
  await page.locator('[data-testid^="chat-file-"]').first().waitFor({ state: "visible" });
  const attachChooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("button-attach-chat").click();
  const attachChooser = await attachChooserPromise;
  await attachChooser.setFiles({
    name: "mobile-chat-voice.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("ID3 mobile chat audio"),
  });
  await page.locator('[data-testid^="chat-file-"]').nth(1).waitFor({ state: "visible" });
  assert.equal(await send.isEnabled(), true, "a composed message should keep the send action available");
  assert.deepEqual(pageErrors, [], "mobile chat should not raise browser errors");

  console.log("Mobile chat composer fit 320px, 375px, and 430px viewports with the input focused; all tools remained reachable and formatting, emoji, upload, poll, scheduling, voice, and send actions worked.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
