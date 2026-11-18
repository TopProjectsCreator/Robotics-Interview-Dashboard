import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewport = { width: 320, height: 740 };
const enabledIcons = [
  "boxes",
  "box",
  "bot",
  "cog",
  "wrench",
  "cpu",
  "rocket",
  "lightbulb",
  "component",
  "drill",
  "circle-dot",
  "folder-tree",
  "activity",
  "battery-charging",
  "cable",
  "circuit-board",
  "fan",
  "gauge",
  "joystick",
  "magnet",
  "radar",
  "radio",
  "satellite",
  "scan-line",
];
const bots = [
  {
    id: "bot-scout",
    name: "Scout",
    icon: "boxes",
    notes: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "bot-mechanic",
    name: "Mechanic",
    icon: "bot",
    notes: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
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
      const response = await fetch(`${serverUrl}/browser-tests/cad-bot-icon-picker.html`);
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

  const page = await browser.newPage({ viewport, hasTouch: true });
  const pageErrors = [];
  let savedIcon = null;
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body = {};

    if (url.pathname === "/api/cad/library") {
      body = { bots, folders: [], models: [] };
    } else if (url.pathname === "/api/cad/icon-policy") {
      body = { enabledIcons };
    } else if (url.pathname === "/api/storage/cad-status") {
      body = { usingBackupStorage: false, lastFailoverAt: null, lastRecoveryAt: null };
    } else if (url.pathname === "/api/cad/bots/bot-scout" && request.method() === "PATCH") {
      savedIcon = request.postDataJSON().icon;
      bots[0] = { ...bots[0], icon: savedIcon };
      body = bots[0];
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(`${serverUrl}/browser-tests/cad-bot-icon-picker.html`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("cad-bot-icon-trigger-bot-scout").waitFor({ state: "visible" });
  await page.getByTestId("cad-bot-icon-trigger-bot-mechanic").waitFor({ state: "visible" });
  await page.getByTestId("cad-bot-icon-trigger-bot-scout").click();

  const picker = page.getByTestId("cad-bot-icon-picker-bot-scout");
  await picker.waitFor({ state: "visible" });
  assert.equal(await picker.locator('[data-testid^="cad-bot-icon-option-bot-scout-"]').count(), 24,
    "all 24 enabled catalog icons should be rendered");

  const pickerLayout = await picker.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      pickerBottom: element.getBoundingClientRect().bottom,
      nextBotTop: document.querySelector('[data-testid="cad-bot-icon-trigger-bot-mechanic"]').getBoundingClientRect().top,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  assert.equal(pickerLayout.position, "relative", "the narrow-screen picker must stay in document flow");
  assert.ok(pickerLayout.scrollHeight > pickerLayout.clientHeight, "the catalog should scroll inside the picker");
  assert.ok(pickerLayout.pickerBottom <= pickerLayout.nextBotTop,
    `the open picker must not cover the next bot's controls: ${JSON.stringify(pickerLayout)}`);
  assert.ok(pickerLayout.documentWidth <= pickerLayout.viewportWidth,
    `the picker must not create horizontal page overflow: ${JSON.stringify(pickerLayout)}`);

  await page.getByTestId("cad-bot-bot-mechanic").click();
  assert.equal(await picker.isVisible(), true, "using a nearby control should not trap or dismiss the picker");

  const lastIcon = enabledIcons.at(-1);
  const lastOption = page.getByTestId(`cad-bot-icon-option-bot-scout-${lastIcon}`);
  await lastOption.scrollIntoViewIfNeeded();
  assert.ok(await picker.evaluate(element => element.scrollTop > 0),
    "reaching the final catalog item should scroll the picker itself");
  const lastOptionVisibleInPicker = await lastOption.evaluate((element, pickerSelector) => {
    const container = document.querySelector(pickerSelector);
    const optionRect = element.getBoundingClientRect();
    const pickerRect = container.getBoundingClientRect();
    return optionRect.top >= pickerRect.top && optionRect.bottom <= pickerRect.bottom;
  }, '[data-testid="cad-bot-icon-picker-bot-scout"]');
  assert.equal(lastOptionVisibleInPicker, true, "the final icon should scroll fully into the picker viewport");
  const [updateResponse] = await Promise.all([
    page.waitForResponse(response =>
      response.url().endsWith("/api/cad/bots/bot-scout") && response.request().method() === "PATCH",
    ),
    lastOption.click(),
  ]);
  assert.equal(updateResponse.ok(), true, "the server should accept the last icon selection");
  await page.waitForFunction(expected =>
    document.querySelector('[data-testid="cad-bot-icon-bot-scout"]')?.getAttribute("data-icon") === expected,
  lastIcon);

  assert.equal(savedIcon, lastIcon, "the final catalog icon should be submitted to the server");
  assert.equal(
    await page.getByTestId("cad-bot-icon-bot-scout").getAttribute("data-icon"),
    lastIcon,
    "the bot should show the newly assigned final icon",
  );
  assert.equal(await picker.count(), 0, "the picker should close after the icon is assigned");
  assert.deepEqual(pageErrors, [], `the picker page should not produce browser errors: ${pageErrors.join("; ")}`);
  console.log(`CAD bot icon picker is usable at ${viewport.width}px with all 24 icons enabled.`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
