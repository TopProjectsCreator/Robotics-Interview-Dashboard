import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const points = Array.from({ length: 16839 }, (_, index) => {
  const kind = index < 15177 ? "team" : "event";
  return {
    id: `${kind}-2026-${index}`,
    kind,
    season: 2026,
    latitude: -78 + ((index * 37) % 156),
    longitude: -179 + ((index * 71) % 358),
    precision: "city",
    label: kind === "team" ? `FTC Team ${1000 + index}` : `FTC Event ${index}`,
    location: "Sample City, USA",
    teamNumber: kind === "team" ? 1000 + index : null,
    eventCode: kind === "event" ? `EVT${index}` : null,
    schoolName: kind === "team" ? `School ${index}` : null,
    nameShort: kind === "team" ? `Team ${index}` : null,
    robotName: kind === "team" ? `Robot ${index}` : null,
    rookieYear: kind === "team" ? 2020 : null,
    typeName: kind === "event" ? "Qualifier" : null,
    venue: kind === "event" ? `Venue ${index}` : null,
    website: null,
    liveStreamUrl: null,
    dateStart: kind === "event" ? "2026-11-20T00:00:00" : null,
    dateEnd: kind === "event" ? "2026-11-20T00:00:00" : null,
  };
});
const globeResponse = {
  season: 2026,
  teamCount: 15177,
  eventCount: 1662,
  points,
};

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
      const response = await fetch(serverUrl);
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
    args: ["--no-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/public/ftc-globe**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(globeResponse),
  }));

  await page.goto(serverUrl);
  await page.getByTestId("section-ftc-globe").waitFor({ state: "visible" });
  await page.getByText("16,839 records · live FIRST season feed").waitFor({ state: "visible" });
  const zoomStatus = page.getByTestId("status-globe-zoom");
  await zoomStatus.waitFor({ state: "attached" });
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="image-globe-fallback"]')
    || document.querySelector('[data-testid="stage-ftc-season-globe"] canvas'),
  );

  const zoomIn = page.getByRole("button", { name: "Zoom in on globe" });
  const reset = page.getByRole("button", { name: "Reset globe zoom" });
  const rotation = page.getByTestId("button-globe-rotation");
  await rotation.click();
  assert.equal(await rotation.getAttribute("aria-pressed"), "true", "rotation should pause on request");
  while (await zoomIn.isEnabled()) await zoomIn.click();
  assert.match(await zoomStatus.textContent(), /20000 percent/);
  assert.match(await zoomStatus.textContent(), /Limits 75 to 20000 percent/);
  assert.equal(await zoomIn.isDisabled(), true, "the zoom-in limit should disable the button");
  await page.getByTestId("button-globe-point-team-team-2026-1").click();
  await page.getByTestId("globe-selected-details").getByText("FTC Team 1001").waitFor({ state: "visible" });

  await reset.click();
  assert.match(await zoomStatus.textContent(), /100 percent/);
  const zoomOut = page.getByRole("button", { name: "Zoom out of globe" });
  while (await zoomOut.isEnabled()) await zoomOut.click();
  assert.match(await zoomStatus.textContent(), /75 percent/);
  assert.equal(await zoomOut.isDisabled(), true, "the zoom-out limit should disable the button");
  await page.getByTestId("globe-selected-details").getByText("FTC Team 1001").waitFor({ state: "visible" });
  await page.getByTestId("globe-selected-details").waitFor({ state: "visible" });
  assert.equal(await page.getByTestId("button-globe-more-points").isVisible(), true, "the large location list should remain usable");
  assert.deepEqual(pageErrors, [], "the globe page should not raise browser exceptions");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
