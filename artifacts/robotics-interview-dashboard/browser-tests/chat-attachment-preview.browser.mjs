import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixtureTypes = {
  "fixture-robotics-clip.webm": "video/webm",
  "fixture-interview-tone.flac": "audio/flac",
  "fixture-interview-tone.ogg": "audio/ogg",
  "fixture-unsupported-alac.m4a": "audio/mp4",
  "fixture-unsupported-hevc.mp4": "video/mp4",
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
      const response = await fetch(`${serverUrl}/browser-tests/chat-attachment-preview.html`);
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
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });

  const page = await browser.newPage();
  await page.route("**/api/storage/objects/*", async route => {
    const fixtureName = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    const contentType = fixtureTypes[fixtureName];
    if (!contentType) {
      await route.fulfill({ status: 404, body: "Unknown browser-test fixture" });
      return;
    }
    const fileName = fixtureName.replace(/^fixture-/, "");
    await route.fulfill({
      status: 200,
      contentType,
      body: readFileSync(path.join(fixturesDir, fileName)),
    });
  });

  await page.goto(`${serverUrl}/browser-tests/chat-attachment-preview.html`);
  const playableFixtures = ["robotics-clip.webm", "interview-tone.flac", "interview-tone.ogg"];
  for (const name of playableFixtures) {
    const container = page.getByTestId(`preview-${name}`);
    const player = container.locator(name.endsWith(".webm") ? "video" : "audio");
    await player.waitFor({ state: "visible" });
    await page.waitForFunction(
      media => media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && Number.isFinite(media.duration),
      await player.elementHandle(),
    );
    const playback = await player.evaluate(async media => {
      media.muted = true;
      await media.play();
      await new Promise((resolve, reject) => {
        if (media.currentTime > 0) return resolve();
        const timeout = setTimeout(() => reject(new Error("Playback did not advance")), 5_000);
        media.addEventListener("timeupdate", () => {
          if (media.currentTime > 0) {
            clearTimeout(timeout);
            resolve();
          }
        }, { once: true });
        media.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error(`Media decode failed with code ${media.error?.code ?? "unknown"}`));
        }, { once: true });
      });
      media.pause();
      return { currentTime: media.currentTime, duration: media.duration };
    });
    assert.ok(playback.duration > 0, `${name} should expose decoded media duration`);
    assert.ok(playback.currentTime > 0, `${name} should advance during playback`);
  }

  for (const name of ["unsupported-alac.m4a", "unsupported-hevc.mp4"]) {
    const unsupported = page.getByTestId(`preview-${name}`);
    await unsupported.getByRole("status").waitFor({ state: "visible" });
    assert.match(
      await unsupported.getByRole("status").innerText(),
      new RegExp(`Couldn’t play ${name.replace(".", "\\.")} in this browser`),
    );
    assert.equal(await unsupported.locator("audio, video").count(), 0, `${name} should not leave a broken player visible`);
  }

  const renderedResourceAttributes = await page.locator("[src], [href], [poster]").evaluateAll(elements =>
    elements.flatMap(element => Array.from(element.attributes, attribute => attribute.value)),
  );
  assert.equal(
    renderedResourceAttributes.some(value => value.includes("/api/storage/")),
    false,
    "attachment previews should not expose storage links",
  );

  console.log("Chromium decoded and played WebM, FLAC, and OGG; unsupported ALAC and HEVC showed the playback fallback.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}