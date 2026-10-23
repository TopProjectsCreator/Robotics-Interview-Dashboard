import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium, devices } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureUrl = "/browser-tests/parts-camera.html";
const embeddedOrigin = "https://coordinator.example";
const apiServer = path.join(appDir, "browser-tests/parts-camera-test-server.ts");
const identifiedPart = {
  identified: true,
  name: "Aluminum channel",
  category: "Structure",
  description: "Extruded aluminum profile.",
  sku: "CH-42",
  uncertainty: "medium",
  uncertaintyReason: "The exact profile series is not visible.",
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

let serverOutput = "";
const server = spawn(
  path.resolve(appDir, "node_modules/.bin/tsx"),
  [apiServer],
  {
    cwd: appDir,
    env: {
      ...process.env,
      BASE_PATH: "/",
      PORT: String(port),
      NODE_ENV: "test",
      FRONTEND_DIST_DIR: appDir,
      ALLOWED_ORIGINS: embeddedOrigin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.setEncoding("utf8").on("data", chunk => { serverOutput += chunk; });
server.stderr.setEncoding("utf8").on("data", chunk => { serverOutput += chunk; });
let browser;

async function startApi(serverUrl) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`API test server exited before starting:\n${serverOutput}`);
    try {
      const dashboardResponse = await fetch(serverUrl);
      const fixtureResponse = await fetch(`${serverUrl}${fixtureUrl}`);
      if (dashboardResponse.ok && fixtureResponse.ok) return;
    } catch {
      // Wait for the API test server to bind the selected port.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`API test server did not start:\n${serverOutput}`);
}

async function verifyServedDashboardPolicy(serverUrl) {
  const response = await fetch(serverUrl);
  assert.equal(response.ok, true, "the API app should serve the dashboard document");
  assert.match(await response.text(), /<title>Robotics Dashboard<\/title>/i, "the API app should serve the dashboard HTML");
  assert.equal(
    response.headers.get("permissions-policy"),
    `camera=(self "${embeddedOrigin}"), microphone=(), geolocation=()`,
    "the dashboard response should allow camera only for itself and the configured embed origin",
  );

  const fixtureResponse = await fetch(`${serverUrl}${fixtureUrl}`);
  assert.equal(fixtureResponse.ok, true, "the API app should serve the camera test page");
  assert.equal(
    fixtureResponse.headers.get("permissions-policy"),
    response.headers.get("permissions-policy"),
    "the camera test page should receive the same restrictive policy as the dashboard",
  );
}

async function installCameraAudit(page, failFirstCameraRequest = false) {
  await page.addInitScript((failFirst) => {
    const mediaDevices = navigator.mediaDevices;
    const nativeGetUserMedia = mediaDevices?.getUserMedia?.bind(mediaDevices);
    const audit = { requests: [], stopCount: 0 };
    Object.defineProperty(window, "__partsCameraAudit", { value: audit, configurable: true });
    if (!mediaDevices || !nativeGetUserMedia) return;

    let shouldFail = failFirst;
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (constraints) => {
        audit.requests.push(constraints);
        if (shouldFail) {
          shouldFail = false;
          throw new DOMException("No camera device is available", "NotFoundError");
        }
        const stream = await nativeGetUserMedia(constraints);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            audit.stopCount += 1;
            stop();
          };
        }
        return stream;
      },
    });
  }, failFirstCameraRequest);
}

async function expectVideoReady(page, description) {
  const video = page.getByLabel("Live camera preview");
  await video.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const videoElement = document.querySelector("video[aria-label='Live camera preview']");
      return videoElement instanceof HTMLVideoElement
        && videoElement.videoWidth > 0
        && videoElement.videoHeight > 0
        && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    },
    undefined,
    { timeout: 10_000 },
  ).catch(error => {
    throw new Error(`${description}: camera video never became ready (${error.message})`);
  });
  return video;
}

async function inspectRecognitionRequest(requests, requestIndex, description) {
  assert.ok(requests[requestIndex], `${description} should reach the existing image-recognition endpoint`);
  const body = requests[requestIndex];
  assert.deepEqual(Object.keys(body).sort(), ["contentType", "imageBase64"], `${description} should use the existing request body`);
  assert.equal(body.contentType, "image/jpeg", `${description} should submit a JPEG frame`);
  const bytes = Buffer.from(body.imageBase64, "base64");
  assert.ok(bytes.length > 0, `${description} should submit a non-empty frame`);
  assert.equal(bytes[0], 0xff, `${description} should encode a JPEG start marker`);
  assert.equal(bytes[1], 0xd8, `${description} should encode a JPEG start marker`);
}

async function pressShortcutOutsideControls(page, video, key) {
  await video.click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press(key);
}

async function runCaptureAndReview(page, serverUrl, browserMode, requestAudit) {
  await page.goto(`${serverUrl}${fixtureUrl}`);
  const requestStart = requestAudit.length;
  const video = await expectVideoReady(page, browserMode);
  const cameraPermission = await page.evaluate(async () => {
    try {
      return (await navigator.permissions.query({ name: "camera" })).state;
    } catch {
      return "unsupported";
    }
  });
  assert.equal(cameraPermission, "granted", `${browserMode} camera permission should be granted`);

  const audit = await page.evaluate(() => window.__partsCameraAudit);
  assert.ok(audit.requests.length > 0, `${browserMode} should request the browser camera`);
  assert.equal(audit.requests[0].audio, false, `${browserMode} should not request microphone access`);

  if (browserMode === "desktop") {
    await pressShortcutOutsideControls(page, video, "Space");
    await page.getByRole("alert").waitFor({ state: "visible" });
    assert.match(await page.getByRole("alert").innerText(), /simulated recognition outage/);

    // Enter is the keyboard retry, and the retry must capture a fresh frame.
    await pressShortcutOutsideControls(page, video, "Enter");
  } else {
    await page.getByRole("button", { name: "Capture and identify" }).tap();
    await page.getByLabel("Part name *").waitFor({ state: "visible" });
    assert.equal(await page.getByLabel("Part name *").inputValue(), "Aluminum channel");

    // Space starts another scan from the live preview in mobile viewport emulation.
    const spaceResponse = page.waitForResponse(response => response.url().includes("/api/parts/catalog/identify-image"));
    await pressShortcutOutsideControls(page, video, "Space");
    await spaceResponse;
    const enterResponse = page.waitForResponse(response => response.url().includes("/api/parts/catalog/identify-image"));
    await pressShortcutOutsideControls(page, video, "Enter");
    await enterResponse;
  }

  await page.getByLabel("Part name *").waitFor({ state: "visible" });
  assert.equal(await page.getByLabel("Part name *").inputValue(), "Aluminum channel");
  await inspectRecognitionRequest(requestAudit, requestStart + 1, browserMode);
  assert.equal(await page.getByText(/Visual suggestion · medium uncertainty/).isVisible(), true);
  assert.deepEqual(await page.evaluate(() => window.partsCameraTest.getSaved()), [], "recognition must not save inventory automatically");

  await page.getByLabel("Supplier *").selectOption("andymark");
  await page.getByRole("button", { name: "Save reviewed part" }).click();
  await page.getByRole("button", { name: "Open scanner" }).waitFor({ state: "visible" });
  assert.deepEqual(await page.evaluate(() => window.partsCameraTest.getSaved()), [{
    name: "Aluminum channel",
    vendorKey: "andymark",
    sku: "CH-42",
    category: "Structure",
    description: "Extruded aluminum profile.",
    quantityOwned: 0,
  }], `${browserMode} should save only the reviewed suggestion`);

  await page.waitForFunction(() => window.__partsCameraAudit.stopCount > 0);
  const expectedRequests = requestStart + (browserMode === "desktop" ? 2 : 3);
  assert.ok(requestAudit.length >= expectedRequests, `${browserMode} should issue a fresh recognition request for each tested capture`);
}

try {
  const serverUrl = `http://127.0.0.1:${port}`;
  await startApi(serverUrl);
  await verifyServedDashboardPolicy(serverUrl);

  const chromiumPath = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    "/repl/tools/bin/chromium",
  ].find(candidate => candidate && existsSync(candidate));
  browser = await chromium.launch({
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
    headless: true,
    args: ["--no-sandbox", "--use-fake-device-for-media-stream"],
  });

  let recognitionAttempt = 0;
  const desktopContext = await browser.newContext();
  await desktopContext.grantPermissions(["camera"], { origin: serverUrl });
  const desktopPage = await desktopContext.newPage();
  await installCameraAudit(desktopPage);
  await desktopPage.route("**/api/parts/catalog/identify-image", async route => {
    recognitionAttempt += 1;
    const body = route.request().postDataJSON();
    requestAudit.push(body);
    if (recognitionAttempt === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "simulated recognition outage" }),
      });
      return;
    }
    if (!body || body.contentType !== "image/jpeg") {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Invalid frame" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(identifiedPart) });
  });

  const requestAudit = [];
  await runCaptureAndReview(desktopPage, serverUrl, "desktop", requestAudit);
  assert.equal(recognitionAttempt, 2, "desktop should retry recognition after the simulated service failure");
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    ...devices["iPhone 13"],
    permissions: ["camera"],
  });
  await mobileContext.grantPermissions(["camera"], { origin: serverUrl });
  const mobilePage = await mobileContext.newPage();
  await installCameraAudit(mobilePage);
  await mobilePage.route("**/api/parts/catalog/identify-image", async route => {
    const body = route.request().postDataJSON();
    requestAudit.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(identifiedPart) });
  });
  await runCaptureAndReview(mobilePage, serverUrl, "mobile emulation", requestAudit);
  await mobileContext.close();

  const deniedContext = await browser.newContext();
  const deniedPage = await deniedContext.newPage();
  await installCameraAudit(deniedPage);
  const deniedCdp = await deniedContext.newCDPSession(deniedPage);
  await deniedCdp.send("Browser.setPermission", {
    permission: { name: "camera" },
    setting: "denied",
    origin: serverUrl,
  });
  await deniedPage.goto(`${serverUrl}${fixtureUrl}`);
  await deniedPage.getByRole("alert").waitFor({ state: "visible" });
  assert.match(await deniedPage.getByRole("alert").innerText(), /Camera access was blocked/);
  assert.equal(await deniedPage.getByRole("button", { name: "Continue in manual entry" }).isVisible(), true);
  assert.equal(await deniedPage.evaluate(() => window.__partsCameraAudit.requests.length), 1);
  await deniedContext.grantPermissions(["camera"], { origin: serverUrl });
  await deniedPage.getByRole("button", { name: "Try camera again" }).click();
  await expectVideoReady(deniedPage, "permission retry");
  await deniedPage.getByRole("button", { name: "Close" }).click();
  await deniedPage.waitForFunction(() => window.__partsCameraAudit.stopCount > 0);
  await deniedContext.close();

  const unavailableContext = await browser.newContext();
  await unavailableContext.grantPermissions(["camera"], { origin: serverUrl });
  const unavailablePage = await unavailableContext.newPage();
  await installCameraAudit(unavailablePage, true);
  await unavailablePage.goto(`${serverUrl}${fixtureUrl}`);
  await unavailablePage.getByRole("alert").waitFor({ state: "visible" });
  assert.match(await unavailablePage.getByRole("alert").innerText(), /No camera was found/);
  await unavailablePage.getByRole("button", { name: "Try camera again" }).click();
  await expectVideoReady(unavailablePage, "unavailable-device retry");
  await unavailablePage.getByRole("button", { name: "Close" }).click();
  await unavailablePage.waitForFunction(() => window.__partsCameraAudit.stopCount > 0);
  await unavailableContext.close();

  console.log("Parts camera browser checks passed through the API-served dashboard: response policy, granted/denied/unavailable permissions, desktop and mobile-emulated capture, JPEG recognition requests, retry, review-before-save, and stream cleanup.");
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const stopped = new Promise(resolve => server.once("exit", resolve));
    server.kill("SIGTERM");
    await stopped;
  }
}
