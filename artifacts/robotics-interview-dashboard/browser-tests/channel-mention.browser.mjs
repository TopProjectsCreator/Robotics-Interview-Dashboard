import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const channel = (id, name, memberCount) => ({
  id,
  name,
  emoji: null,
  createdBy: "Browser Tester",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  members: Array.from({ length: memberCount }, (_, index) => ({
    id: `member-${id}-${index}`,
    displayName: `Member ${index + 1}`,
    role: "interviewer",
  })),
  youAreMember: true,
  canManage: false,
  lastMessageAt: null,
  lastMessageAuthor: null,
  lastMessage: null,
});
const channels = [channel("chan-studio", "studio", 2), channel("chan-design", "design eng", 4)];

let browser;
try {
  const serverUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before starting:\n${serverOutput}`);
    try {
      const response = await fetch(`${serverUrl}/chat`);
      if (response.ok) break;
    } catch {
      // wait for vite
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

  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const persistedMessages = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const jsonResponse = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    let body = {
      items: [],
      interviewerLabels: ["Browser Tester", "Jordan"],
      currentApplicants: [],
      nextApplicants: [],
      remainingCount: 0,
      completedCount: 0,
    };
    if (url.pathname === "/api/auth/session") {
      body = { authenticated: true, interviewerId: "mention-test", label: "Browser Tester" };
    } else if (url.pathname === "/api/queue/chat/channels") {
      body = { items: channels };
    } else if (url.pathname === "/api/queue/chat" && route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      const saved = {
        id: `msg-${persistedMessages.length + 1}`,
        author: input.author,
        message: input.message,
        scope: input.scope ?? "shared",
        peer: input.scope === "channel" ? input.channelId : input.recipient ?? null,
        channelId: input.scope === "channel" ? input.channelId : null,
        parentMessageId: null,
        pinnedAt: null,
        editedAt: null,
        deletedAt: null,
        activities: [],
        reactions: [],
        poll: null,
        readBy: [],
        createdAt: new Date().toISOString(),
      };
      persistedMessages.push(saved);
      return jsonResponse(saved, 201);
    } else if (url.pathname === "/api/queue/chat") {
      const scope = url.searchParams.get("scope") ?? "shared";
      const channelId = url.searchParams.get("channelId");
      const items = persistedMessages.filter(item => item.scope === scope && (!channelId || item.channelId === channelId));
      return jsonResponse({ items, scope, peer: null });
    }
    await jsonResponse(body);
  });

  await page.goto(`${serverUrl}/chat`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Signed in as Browser Tester").waitFor({ state: "visible", timeout: 120_000 });

  const input = page.getByTestId("input-interviewer-chat");
  const channelMenu = page.getByTestId("channel-mention-menu");

  // 1. Typing "#" opens the channel picker with the channels the account can access.
  await input.click();
  await input.pressSequentially("#");
  await channelMenu.waitFor({ state: "visible", timeout: 5000 });
  await page.getByTestId("channel-mention-option-studio").waitFor({ state: "visible", timeout: 5000 });
  assert.equal(await page.getByTestId("channel-mention-option-design-eng").count(), 1);
  console.log("ok 1: channel picker opens on # and lists accessible channels");

  // 2. Typing filters channels by name, including multi-word names.
  await input.pressSequentially("des");
  assert.equal(await page.getByTestId("channel-mention-option-design-eng").count(), 1);
  assert.equal(await page.getByTestId("channel-mention-option-studio").count(), 0);
  console.log("ok 2: query filters channels by name");

  // 3. Enter replaces the in-progress query mid-message and keeps the rest.
  await input.fill("see #desi for context");
  await input.press("Home");
  for (let i = 0; i < 9; i += 1) await input.press("ArrowRight");
  await input.pressSequentially("gn");
  await channelMenu.waitFor({ state: "visible", timeout: 5000 });
  await input.press("Enter");
  assert.equal(await input.inputValue(), "see #design eng for context");
  await channelMenu.waitFor({ state: "hidden", timeout: 5000 });
  console.log("ok 3: Enter replaces the mid-message #query with the full channel token");

  // 4. Escape dismisses the channel picker.
  await input.fill("ref #stu please");
  await input.press("Home");
  for (let i = 0; i < 8; i += 1) await input.press("ArrowRight");
  await channelMenu.waitFor({ state: "visible", timeout: 5000 });
  await input.press("Escape");
  await channelMenu.waitFor({ state: "hidden", timeout: 5000 });
  console.log("ok 4: Escape closes the channel picker");

  // 5. Clicking a suggestion inserts the channel token with a trailing space.
  await input.fill("hop into #");
  await channelMenu.waitFor({ state: "visible", timeout: 5000 });
  await page.getByTestId("channel-mention-option-design-eng").click();
  assert.equal(await input.inputValue(), "hop into #design eng ");
  console.log("ok 5: clicking a suggestion inserts the full channel token");

  // 6. Enter sends the message; the #studio token renders in the feed and
  //    clicking it jumps the conversation to the studio channel.
  await input.fill("meet in #");
  await channelMenu.waitFor({ state: "visible", timeout: 5000 });
  await page.getByTestId("channel-mention-option-studio").click();
  await input.press("Enter");
  await page.getByTestId("chat-channel-mention-studio").waitFor({ state: "visible", timeout: 10000 });
  await page.getByTestId("chat-channel-mention-studio").click();
  assert.equal(await page.getByTestId("select-chat-conversation").inputValue(), "channel:chan-studio");
  console.log("ok 6: clicking a rendered #channel token jumps to that channel");

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
  console.log("ALL CHANNEL MENTION PICKER CHECKS PASSED");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
