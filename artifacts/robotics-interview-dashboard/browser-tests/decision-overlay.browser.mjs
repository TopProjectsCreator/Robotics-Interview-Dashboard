import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = process.env.SHOT_DIR ?? "/tmp/opencode/decision-overlay-shots";
mkdirSync(shotDir, { recursive: true });

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
      const response = await fetch(`${serverUrl}/browser-tests/decision-overlay.html`);
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

  const page = await browser.newPage({ viewport: { width: 520, height: 640 } });

  async function capture(name, { hash, reduceMotion = false, midMs = null }) {
    // Cache-bust the query so changing only the hash forces a full reload of the fixture page.
    await page.goto(`${serverUrl}/browser-tests/decision-overlay.html?reduceMotion=${reduceMotion ? 1 : 0}&t=${Date.now()}${Math.floor(Math.random() * 1e6)}#${hash}`);
    await page.getByTestId("decision-overlay").waitFor({ state: "visible" });
    if (midMs !== null) await page.waitForTimeout(midMs);
    await page.screenshot({ path: path.join(shotDir, `${name}.png`) });
  }

  // Mid-animation and settled frames for each command.
  await capture("coin-mid-flip", { hash: "coin", midMs: 450 });
  await capture("coin-mid-flip-2", { hash: "coinMulti", midMs: 900 });
  await capture("coin-settled", { hash: "coin" });
  await page.getByTestId("decision-result").filter({ hasNotText: "…" }).waitFor({ timeout: 4000 });
  await page.screenshot({ path: path.join(shotDir, "coin-settled-text.png") });

  await capture("roll-mid-tumble", { hash: "roll", midMs: 500 });
  await page.getByTestId("decision-result").filter({ hasNotText: "…" }).waitFor({ timeout: 4000 });
  await page.screenshot({ path: path.join(shotDir, "roll-settled-text.png") });
  // d20 fixture shows the higher-sided token view.
  await capture("roll-token-settled", { hash: "roll" });
  await page.getByTestId("decision-result").filter({ hasNotText: "…" }).waitFor({ timeout: 4000 });
  await page.screenshot({ path: path.join(shotDir, "roll-token-settled-text.png") });

  await capture("roll-multi-settled", { hash: "rollMulti" });
  await page.getByTestId("decision-result").filter({ hasNotText: "…" }).waitFor({ timeout: 4000 });
  await page.screenshot({ path: path.join(shotDir, "roll-multi-settled-text.png") });

  await capture("spinner-mid-spin", { hash: "spinner", midMs: 700 });
  await capture("spinner-settled", { hash: "spinner" });
  await page.getByTestId("decision-result").filter({ hasNotText: "…" }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: path.join(shotDir, "spinner-settled-text.png") });
  const spinnerText = await page.getByTestId("decision-result").innerText();
  assert.match(spinnerText, /Spinner landed on Tacos \(from Pizza · Tacos · Sushi · Thai\)/, "spinner should settle on the fixture winner");

  // Reduced motion renders the final state instantly.
  await capture("coin-reduced-motion", { hash: "coin", reduceMotion: true });
  const reducedText = await page.getByTestId("decision-result").innerText();
  assert.match(reducedText, /Heads/, "reduce-motion mode should show the settled result immediately");

  await capture("yesno-mid-spin", { hash: "yesNo", midMs: 600 });

  console.log(`Decision overlay rendered in Chromium; screenshots in ${shotDir}`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
