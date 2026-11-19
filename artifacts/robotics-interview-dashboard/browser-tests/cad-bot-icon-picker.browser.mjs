import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewports = [
  { name: "compact", width: 320, height: 740, scrollOwner: "document" },
  { name: "desktop", width: 1280, height: 900, scrollOwner: "sidebar" },
];
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
const folders = bots.flatMap((bot, botIndex) =>
  Array.from({ length: botIndex === 0 ? 14 : 3 }, (_, index) => {
    const root = {
      id: `folder-${bot.id}-${index}-root`,
      botId: bot.id,
      parentId: null,
      name: `Subsystem ${String(index + 1).padStart(2, "0")}`,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const branch = {
      ...root,
      id: `folder-${bot.id}-${index}-branch`,
      parentId: root.id,
      name: `Assembly ${String(index + 1).padStart(2, "0")}`,
    };
    const leaf = {
      ...root,
      id: `folder-${bot.id}-${index}-leaf`,
      parentId: branch.id,
      name: `Part files ${String(index + 1).padStart(2, "0")}`,
    };
    return [root, branch, leaf];
  }).flat(),
);

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

  const page = await browser.newPage({ viewport: viewports[0], hasTouch: true });
  const pageErrors = [];
  let savedIcon = null;
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body = {};

    if (url.pathname === "/api/cad/library") {
      body = { bots, folders, models: [] };
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
  async function verifyViewport(viewport) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.classList.remove("dark");
    });
    const sidebar = page.locator(".cad-library-sidebar");
    const picker = page.getByTestId("cad-bot-icon-picker-bot-scout");
    await page.getByTestId("cad-bot-icon-trigger-bot-scout").click();
    await picker.waitFor({ state: "visible" });
    assert.equal(await picker.locator('[data-testid^="cad-bot-icon-option-bot-scout-"]').count(), 24,
      "all 24 enabled catalog icons should be rendered");

    const layout = await picker.evaluate(element => {
      const pickerStyle = getComputedStyle(element);
      const sidebarElement = element.closest(".cad-library-sidebar");
      const sidebarStyle = getComputedStyle(sidebarElement);
      const rect = element.getBoundingClientRect();
      const controls = Array.from(element.parentElement.querySelectorAll(
        'button[data-testid^="cad-folder-"], button.cad-row-action, button[data-testid^="cad-bot-icon-trigger"]',
      ));
      const overlappingControls = controls
        .filter(control => {
          const controlRect = control.getBoundingClientRect();
          return rect.left < controlRect.right && rect.right > controlRect.left &&
            rect.top < controlRect.bottom && rect.bottom > controlRect.top;
        })
        .map(control => control.getAttribute("aria-label") ?? control.textContent?.trim());
      return {
        pickerPosition: pickerStyle.position,
        pickerOverflowY: pickerStyle.overflowY,
        pickerClientHeight: element.clientHeight,
        pickerScrollHeight: element.scrollHeight,
        sidebarOverflowY: sidebarStyle.overflowY,
        sidebarScrollHeight: sidebarElement.scrollHeight,
        sidebarClientHeight: sidebarElement.clientHeight,
        overlappingControls,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        gridColumns: getComputedStyle(document.querySelector('[data-testid="cad-library-layout"]')).gridTemplateColumns,
      };
    });
    assert.equal(layout.pickerPosition, "static", `picker should remain in normal flow: ${JSON.stringify(layout)}`);
    assert.equal(layout.pickerOverflowY, "visible", "the picker must not create a nested scroll area");
    assert.ok(layout.pickerScrollHeight <= layout.pickerClientHeight + 1,
      `the picker should expand to its full catalog height: ${JSON.stringify(layout)}`);
    assert.deepEqual(layout.overlappingControls, [],
      `the picker must not cover folder rows or controls: ${JSON.stringify(layout.overlappingControls)}`);
    assert.ok(layout.documentWidth <= layout.viewportWidth,
      `the picker must not create horizontal page overflow: ${JSON.stringify(layout)}`);

    if (viewport.scrollOwner === "sidebar") {
      assert.equal(layout.sidebarOverflowY, "auto", "the sidebar should own desktop tree scrolling");
      assert.ok(layout.sidebarScrollHeight > layout.sidebarClientHeight,
        "the populated tree should make the sidebar scrollable");
      assert.match(layout.gridColumns, /^290px\s/,
        `the wide desktop sidebar should retain its 290px column: ${layout.gridColumns}`);
    } else {
      assert.equal(layout.sidebarOverflowY, "visible", "compact layouts should use page scrolling");
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
        "the populated compact layout should remain reachable through page scrolling");
    }

    const lightSurface = await picker.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    }));
    assert.notEqual(lightSurface.background, "rgba(0, 0, 0, 0)", "the light picker needs an opaque surface");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const darkSurface = await picker.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    }));
    assert.notEqual(darkSurface.background, lightSurface.background, "dark mode should remap the picker surface");
    assert.notEqual(darkSurface.color, lightSurface.color, "dark mode should remap picker text for contrast");
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    const lastIcon = enabledIcons.at(-1);
    const lastFolder = page.getByTestId("cad-folder-folder-bot-scout-13-leaf");
    await lastFolder.scrollIntoViewIfNeeded();
    const lastFolderVisible = await lastFolder.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    assert.equal(lastFolderVisible, true, "the last nested folder should remain reachable while scrolling");
    const folderScrollState = await sidebar.evaluate(element => ({
      sidebarTop: element.scrollTop,
      pageTop: window.scrollY,
    }));
    assert.ok(
      viewport.scrollOwner === "sidebar" ? folderScrollState.sidebarTop > 0 : folderScrollState.pageTop > 0,
      `${viewport.name} should scroll its intended owner to reach the folder tree`,
    );
    const overlapsAtTreeEnd = await picker.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Array.from(element.parentElement.querySelectorAll(
        'button[data-testid^="cad-folder-"], button.cad-row-action, button[data-testid^="cad-bot-icon-trigger"]',
      ))
        .filter(control => {
          const controlRect = control.getBoundingClientRect();
          return rect.left < controlRect.right && rect.right > controlRect.left &&
            rect.top < controlRect.bottom && rect.bottom > controlRect.top;
        })
        .map(control => control.getAttribute("aria-label") ?? control.textContent?.trim());
    });
    assert.deepEqual(overlapsAtTreeEnd, [],
      "scrolling to the end of the folder tree must not make it overlap the picker");

    const lastOption = page.getByTestId(`cad-bot-icon-option-bot-scout-${lastIcon}`);
    await lastOption.scrollIntoViewIfNeeded();
    const scrollState = await sidebar.evaluate(element => ({
      sidebarTop: element.scrollTop,
      pageTop: window.scrollY,
    }));
    assert.ok(
      viewport.scrollOwner === "sidebar" ? scrollState.sidebarTop > 0 : scrollState.pageTop > 0,
      `${viewport.name} should scroll its single intended owner to reach the picker`,
    );
    const optionInViewport = await lastOption.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    assert.equal(optionInViewport, true, "the final icon should be reachable without scrolling inside the picker");
    const overlapsAtPicker = await picker.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Array.from(element.parentElement.querySelectorAll(
        'button[data-testid^="cad-folder-"], button.cad-row-action, button[data-testid^="cad-bot-icon-trigger"]',
      ))
        .filter(control => {
          const controlRect = control.getBoundingClientRect();
          return rect.left < controlRect.right && rect.right > controlRect.left &&
            rect.top < controlRect.bottom && rect.bottom > controlRect.top;
        })
        .map(control => control.getAttribute("aria-label") ?? control.textContent?.trim());
    });
    assert.deepEqual(overlapsAtPicker, [],
      "the picker must stay separate from folder rows and controls after scrolling");
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
    assert.equal(await picker.count(), 0, "the picker should close after the icon is assigned");
    console.log(`CAD icon picker layout passed at ${viewport.width}px (${viewport.name}).`);
  }

  for (const viewport of viewports) {
    await verifyViewport(viewport);
  }
  assert.deepEqual(pageErrors, [], `the picker page should not produce browser errors: ${pageErrors.join("; ")}`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
