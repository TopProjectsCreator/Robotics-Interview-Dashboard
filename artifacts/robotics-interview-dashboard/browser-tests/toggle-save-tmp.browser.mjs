import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const visibility = {
  interview: ["coordinator"],
  chat: ["coordinator", "treasurer", "interviewer"],
  parts: ["coordinator", "treasurer", "interviewer"],
  cad: ["coordinator"],
  code: ["coordinator"],
};
const putBodies = [];

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
      // keep waiting
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

  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", error => console.error("PAGE ERROR:", error.message));
  page.on("console", msg => { if (msg.type() === "error") console.error("CONSOLE ERROR:", msg.text()); });
  await page.route("**/api/**", async route => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    console.log("API:", method, pathname);
    if (pathname === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, interviewerId: "admin-sam", role: "coordinator", label: "Sam Admin" }),
      });
      return;
    }
    if (pathname === "/api/workspaces/visibility") {
      if (method === "PUT") {
        putBodies.push(JSON.parse(route.request().postData() ?? "{}"));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(putBodies[0]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(visibility) });
      return;
    }
    if (pathname === "/api/system/mailbox") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          teamId: "matrix-team",
          mailbox: null,
          forwardingAddress: null,
          enabled: false,
          configured: false,
          apiKeyConfigured: false,
          allowedSenders: [],
          legacy: false,
        }),
      });
      return;
    }
    if (pathname === "/api/auth/interviewers") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [
          { id: "member-zara", displayName: "Zara Team", hasPassword: true, role: "interviewer" },
          { id: "admin-sam", displayName: "Sam Admin", hasPassword: true, role: "coordinator" },
          { id: "treasurer-zoe", displayName: "Zoe Treasurer", hasPassword: true, role: "treasurer" },
          { id: "member-alex", displayName: "Alex Team", hasPassword: true, role: "interviewer" },
          { id: "admin-avery", displayName: "Avery Admin", hasPassword: true, role: "admin" },
          { id: "treasurer-megan", displayName: "Megan Treasurer", hasPassword: true, role: "treasurer" },
        ] }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto(`${serverUrl}/dashboard`);
  await page.getByRole("heading", { name: "Choose a workspace" }).waitFor({ state: "visible", timeout: 15000 });
  const accountsLoaded = page.waitForResponse(response => response.url().includes("/api/auth/interviewers") && response.request().method() === "GET");
  await page.getByTestId("button-account-menu").click();
  await page.getByTestId("button-open-settings").click();
  await page.getByTestId("settings-modal").waitFor({ state: "visible" });
  await accountsLoaded;

  const allIds = await page.locator("[data-testid]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-testid")).filter(id => id && (id.includes("visibility") || id.includes("save-visibility"))));
  console.log("visibility-related testids:", JSON.stringify(allIds));
  console.log("page errors so far are logged above; modal text sample:", (await page.locator('[data-testid="settings-modal"]').innerText().catch(() => "NO MODAL")).slice(0, 400));
  const toggle = page.getByTestId("toggle-visibility-code-member-alex");
  await toggle.waitFor({ state: "visible" });
  assert.equal(await toggle.getAttribute("aria-checked"), "false", "grant starts off");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-checked"), "true", "click flips the toggle on");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-checked"), "false", "click flips the toggle off");
  await toggle.click();

  const saved = page.waitForResponse(response => response.url().includes("/api/workspaces/visibility") && response.request().method() === "PUT");
  await page.getByTestId("button-save-visibility").click();
  await saved;
  assert.deepEqual(putBodies.length, 1, "one PUT sent");
  assert.ok(putBodies[0].code.includes("member-alex"), `PUT body includes the granted member: ${JSON.stringify(putBodies[0])}`);
  console.log("Toggle click flips, save sends the granted account ID in PUT /api/workspaces/visibility.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
