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
      body = { authenticated: true, interviewerId: "mention-test", label: "Browser Tester" };
    } else if (url.pathname === "/api/queue/chat") {
      body = {
        items: [],
        scope: url.searchParams.get("scope") ?? "shared",
        peer: url.searchParams.get("peer"),
      };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(`${serverUrl}/chat`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Signed in as Browser Tester").waitFor({ state: "visible", timeout: 120_000 });

  const input = page.getByTestId("input-interviewer-chat");
  const mentionMenu = page.getByTestId("mention-menu");

  // 1. Typing "@" in the middle of an existing message opens the picker.
  await input.fill("hello world");
  await input.press("Home");
  for (let i = 0; i < 6; i += 1) await input.press("ArrowRight");
  await input.pressSequentially("@ai");
  assert.equal(await input.inputValue(), "hello @aiworld");
  await mentionMenu.waitFor({ state: "visible", timeout: 5000 });
  console.log("ok 1: picker opens when @ is typed mid-message");

  // 2. Enter picks the highlighted option, replacing only the @query in the middle.
  await input.press("Enter");
  assert.equal(await input.inputValue(), "hello @ai world");
  await mentionMenu.waitFor({ state: "hidden", timeout: 5000 });
  console.log("ok 2: Enter replaces mid-message @query and keeps trailing text");

  // 3. Clicking into an existing @token mid-message (no typing) opens the picker.
  await input.fill("ping @ai please");
  await input.press("Home");
  for (let i = 0; i < 8; i += 1) await input.press("ArrowRight");
  await mentionMenu.waitFor({ state: "visible", timeout: 5000 });
  console.log("ok 3: picker opens when caret moves into an @token mid-message");

  // 4. Clicking a suggestion replaces the token without double spaces or re-opening.
  await page.getByTestId("mention-option-ai").click();
  assert.equal(await input.inputValue(), "ping @ai please");
  await mentionMenu.waitFor({ state: "hidden", timeout: 5000 });
  console.log("ok 4: click selection replaces mid-message token cleanly");

  // 5. Selecting at the very start of a message replaces the query and keeps the rest.
  await input.fill("call me later");
  await input.press("Home");
  await input.pressSequentially("@jor");
  await mentionMenu.waitFor({ state: "visible", timeout: 5000 });
  await input.press("Enter");
  assert.equal(await input.inputValue(), "@Jordan call me later");
  console.log("ok 5: selection at message start ->", JSON.stringify(await input.inputValue()));

  // 6. Escape dismisses the picker.
  await input.press("Home");
  for (let i = 0; i < 3; i += 1) await input.press("ArrowRight");
  await mentionMenu.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
  await input.fill("say @aihi now");
  await input.press("Home");
  for (let i = 0; i < 7; i += 1) await input.press("ArrowRight"); // after "say @ai"
  await mentionMenu.waitFor({ state: "visible", timeout: 5000 });
  await input.press("Escape");
  await mentionMenu.waitFor({ state: "hidden", timeout: 5000 });
  console.log("ok 6: Escape closes the picker");

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
  console.log("ALL MENTION PICKER CHECKS PASSED");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
