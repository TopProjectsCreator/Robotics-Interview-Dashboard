import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const writeRequests = [];

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
      const response = await fetch(`${serverUrl}/dashboard`);
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

  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") console.error("BROWSER CONSOLE:", message.text()); });
  await page.route("**/api/**", async route => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname === "/api/presence/heartbeat") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (method !== "GET" && method !== "HEAD") writeRequests.push(`${method} ${pathname}`);

    if (pathname === "/api/events") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (pathname === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          interviewerId: "responsive-member",
          role: "interviewer",
          label: "Responsive Test",
          permissions: ["team.branding.manage", "broadcasts.send"],
        }),
      });
      return;
    }
    if (pathname === "/api/presence") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ onlineCount: 0, entries: [], offline: [] }),
      });
      return;
    }
    if (pathname.startsWith("/api/auth/team-branding")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          logoPath: null,
          primaryColor: null,
          backgroundPath: null,
          backgrounds: [],
          backgroundMode: null,
          backgroundOverlay: 0,
          backgroundRotationSeconds: 0,
          backgroundAudience: "everyone",
          backgroundMemberIds: [],
        }),
      });
      return;
    }
    if (pathname === "/api/assistant/tool-policy") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ teamDisabledTools: [], roleDisabledTools: {}, roles: [], updatedAt: null }),
      });
      return;
    }
    if (pathname === "/api/assistant/usage") {
      const metrics = {
        prompts: 0,
        completedPrompts: 0,
        failedPrompts: 0,
        cancelledPrompts: 0,
        runningPrompts: 0,
        providerRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cancelledRequests: 0,
        runningRequests: 0,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        usageReportedRequests: 0,
        usageUnavailableRequests: 0,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          startDate: "2026-01-01",
          endDate: "2026-01-30",
          totals: metrics,
          users: [],
          tools: [],
          productivityUsage: {
            requests: 0,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            usageReportedRequests: 0,
            usageUnavailableRequests: 0,
          },
        }),
      });
      return;
    }
    if (pathname === "/api/queue/chat/productivity/settings") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false, customMessage: "", updatedAt: "2026-01-01T00:00:00.000Z" }),
      });
      return;
    }
    if (pathname === "/api/team-assessments" || pathname === "/api/team-assessments/required") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto(`${serverUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  try {
    await page.getByTestId("button-account-menu").waitFor({ state: "visible", timeout: 15_000 });
  } catch (error) {
    console.error("VITE OUTPUT:", serverOutput.slice(-6000));
    console.error("PAGE TEXT:", (await page.locator("body").innerText()).slice(0, 1000));
    throw error;
  }
  await page.getByTestId("button-account-menu").click();
  await page.getByTestId("button-open-settings").click();
  await page.getByTestId("settings-modal").waitFor({ state: "visible" });
  await page.getByTestId("settings-tab-operations").click();
  await page.getByTestId("operations-tab-content").waitFor({ state: "visible" });

  for (const testId of [
    "operations-applicant-preferences",
    "operations-live-updates",
    "operations-notifications",
    "settings-broadcast",
    "operations-data-controls",
  ]) {
    await page.getByTestId(testId).waitFor({ state: "visible" });
  }

  const narrowLayout = await page.evaluate(() => {
    const settingsShell = document.querySelector(".settings-modal-shell");
    const workspaceLayout = document.querySelector('[data-testid="settings-workspace-layout"]');
    const operationsPanel = document.querySelector(".settings-operations-panel");
    const operationsGrid = document.querySelector(".operations-grid");
    const cards = Array.from(document.querySelectorAll(".operations-card"));
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      shellWidth: settingsShell?.clientWidth ?? 0,
      workspaceColumns: getComputedStyle(workspaceLayout).gridTemplateColumns,
      panelWidth: operationsPanel?.clientWidth ?? 0,
      gridColumns: getComputedStyle(operationsGrid).gridTemplateColumns,
      cards: cards.map(card => ({
        name: card.getAttribute("data-testid"),
        width: card.clientWidth,
        scrollWidth: card.scrollWidth,
        minimumButtonHeight: Math.min(
          ...Array.from(card.querySelectorAll("button")).map(button => button.getBoundingClientRect().height),
        ),
      })),
    };
  });

  assert.equal(narrowLayout.viewportWidth, 320);
  assert.ok(narrowLayout.documentWidth <= narrowLayout.viewportWidth, `page overflows horizontally: ${JSON.stringify(narrowLayout)}`);
  assert.equal(narrowLayout.workspaceColumns.split(" ").length, 1, "settings navigation should stack above content in a tiny viewport");
  assert.equal(narrowLayout.gridColumns.split(" ").length, 1, "Operations cards should use one readable column in a narrow panel");
  assert.ok(
    narrowLayout.cards.every(card => card.scrollWidth <= card.width + 1),
    `an Operations card overflows its available width: ${JSON.stringify(narrowLayout.cards)}`,
  );
  assert.ok(
    narrowLayout.cards.every(card => card.minimumButtonHeight >= 44),
    "Operations buttons should retain thumb-sized hit areas",
  );

  const lightCardSurface = await page.locator(".operations-card").first().evaluate(element => getComputedStyle(element).backgroundColor);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const darkCardSurface = await page.locator(".operations-card").first().evaluate(element => getComputedStyle(element).backgroundColor);
  assert.notEqual(darkCardSurface, lightCardSurface, "Operations surfaces should respond to the shared dark theme");
  if (process.env.SETTINGS_RESPONSIVE_SCREENSHOT) {
    await page.screenshot({ path: process.env.SETTINGS_RESPONSIVE_SCREENSHOT });
  }

  const defaultSort = page.getByTestId("select-settings-sort");
  await defaultSort.selectOption("name");
  assert.equal(await defaultSort.inputValue(), "name", "the applicant sort control should remain operable");
  await defaultSort.selectOption("rank");
  const autoRefresh = page.getByTestId("toggle-settings-refresh");
  const initialRefresh = await autoRefresh.getAttribute("aria-checked");
  await autoRefresh.click();
  assert.notEqual(await autoRefresh.getAttribute("aria-checked"), initialRefresh, "the refresh switch should toggle in a narrow layout");
  await autoRefresh.click();
  assert.equal(await autoRefresh.getAttribute("aria-checked"), initialRefresh, "the refresh switch should return to its original state");

  await page.setViewportSize({ width: 280, height: 900 });
  await page.waitForTimeout(100);
  const tinyLayout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    panelWidth: document.querySelector(".settings-operations-panel")?.clientWidth ?? 0,
    gridColumns: getComputedStyle(document.querySelector(".operations-grid")).gridTemplateColumns,
    cards: Array.from(document.querySelectorAll(".operations-card")).map(card => ({
      name: card.getAttribute("data-testid"),
      width: card.clientWidth,
      scrollWidth: card.scrollWidth,
    })),
  }));
  assert.ok(tinyLayout.documentWidth <= tinyLayout.viewportWidth, `page overflows at 280px: ${JSON.stringify(tinyLayout)}`);
  assert.equal(tinyLayout.gridColumns.split(" ").length, 1, "Operations should remain a single column at 280px");
  assert.ok(
    tinyLayout.cards.every(card => card.scrollWidth <= card.width + 1),
    `an Operations card overflows at 280px: ${JSON.stringify(tinyLayout.cards)}`,
  );

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(100);
  const wideLayout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    workspaceColumns: getComputedStyle(document.querySelector('[data-testid="settings-workspace-layout"]')).gridTemplateColumns,
    gridColumns: getComputedStyle(document.querySelector(".operations-grid")).gridTemplateColumns,
  }));
  assert.ok(wideLayout.documentWidth <= wideLayout.viewportWidth, `page overflows at desktop width: ${JSON.stringify(wideLayout)}`);
  assert.equal(wideLayout.workspaceColumns.split(" ").length, 2, "wide settings should restore the side navigation");

  assert.deepEqual(writeRequests, [], `responsive layout checks must not mutate team data: ${writeRequests.join(", ")}`);
  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join("; ")}`);
  console.log("Operations settings fit a 320px viewport without horizontal overflow and restore the desktop navigation at 1024px.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
