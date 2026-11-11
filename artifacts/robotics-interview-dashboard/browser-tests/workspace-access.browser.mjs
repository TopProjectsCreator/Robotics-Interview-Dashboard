import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const users = [
  { id: "matrix-coordinator", role: "coordinator", label: "Coordinator" },
  { id: "matrix-treasurer", role: "treasurer", label: "Treasurer" },
  { id: "matrix-interviewer", role: "interviewer", label: "Interviewer" },
];
const interviewerAccounts = [
  { id: "member-zara", displayName: "Zara Team", hasPassword: true, role: "interviewer" },
  { id: "admin-sam", displayName: "Sam Admin", hasPassword: true, role: "coordinator" },
  { id: "treasurer-zoe", displayName: "Zoe Treasurer", hasPassword: true, role: "treasurer" },
  { id: "member-alex", displayName: "Alex Team", hasPassword: true, role: "interviewer" },
  { id: "admin-avery", displayName: "Avery Admin", hasPassword: true, role: "admin" },
  { id: "treasurer-megan", displayName: "Megan Treasurer", hasPassword: true, role: "treasurer" },
];
const visibility = {
  interview: ["coordinator"],
  chat: users.map(({ id }) => id),
  parts: users.map(({ id }) => id),
  cad: ["matrix-treasurer"],
  code: ["matrix-interviewer"],
};

function canOpen(user, workspace) {
  return user.role === "coordinator"
    || visibility[workspace].includes(user.id)
    || visibility[workspace].includes(user.role);
}

async function verifyWorkspaceAccessOrdering(page) {
  const accountsLoaded = page.waitForResponse(response =>
    response.url().includes("/api/auth/interviewers") && response.request().method() === "GET",
  );
  await page.getByTestId("button-account-menu").click();
  await page.getByTestId("button-open-settings").click();
  await page.getByTestId("settings-modal").waitFor({ state: "visible" });
  const accountResponse = await accountsLoaded;
  assert.equal(accountResponse.status(), 200, "settings should load the mock interviewer account list");
  const accessMatrix = page.locator('[data-testid^="visibility-row-"]').first().locator("xpath=ancestor::table");
  await accessMatrix.locator('[data-testid="workspace-access-account-member-alex"]').waitFor({ state: "visible" });
  assert.deepEqual(
    await accessMatrix.evaluate(table =>
      Array.from(table.querySelectorAll("thead th"))
        .filter(node => (node.getAttribute("data-testid") ?? "").startsWith("workspace-access-account-"))
        .map(node => ({
          id: node.getAttribute("data-testid")?.replace("workspace-access-account-", ""),
          name: node.querySelector("span")?.textContent?.trim(),
          role: node.querySelectorAll("span")[1]?.textContent?.trim(),
        })),
    ),
    [
      { id: "admin-avery", name: "Avery Admin", role: "Admin" },
      { id: "admin-sam", name: "Sam Admin", role: "Admin" },
      { id: "treasurer-megan", name: "Megan Treasurer", role: "Treasurer" },
      { id: "treasurer-zoe", name: "Zoe Treasurer", role: "Treasurer" },
      { id: "member-alex", name: "Alex Team", role: "Team member" },
      { id: "member-zara", name: "Zara Team", role: "Team member" },
    ],
    "workspace access columns should sort by role, then display name",
  );
  for (const adminId of ["admin-avery", "admin-sam"]) {
    const adminToggle = accessMatrix.getByTestId(`toggle-visibility-interview-${adminId}`);
    assert.equal(await adminToggle.isChecked(), true, `${adminId} must always have workspace access`);
    assert.equal(await adminToggle.isDisabled(), true, `${adminId} workspace access must stay locked`);
  }
  await page.getByTestId("button-close-settings").click();
}

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

  const sessions = [];
  for (const user of users) {
    const context = await browser.newContext();
    const pageErrors = [];
    context.on("page", page => page.on("pageerror", error => pageErrors.push(error.message)));
    await context.route("**/api/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/api/auth/session") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ authenticated: true, interviewerId: user.id, role: user.role, label: user.label }),
        });
        return;
      }
      if (pathname === "/api/workspaces/visibility") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(visibility) });
        return;
      }
      if (pathname === "/api/auth/interviewers") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: interviewerAccounts }),
        });
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
      if (pathname === "/api/cad/library" || pathname === "/api/code/projects") {
        const workspace = pathname.includes("/cad/") ? "cad" : "code";
        const allowed = canOpen(user, workspace);
        await route.fulfill({
          status: allowed ? 200 : 403,
          contentType: "application/json",
          body: JSON.stringify(allowed
            ? (workspace === "cad" ? { bots: [], folders: [], models: [] } : { projects: [] })
            : { error: "This workspace is not available for your account" }),
        });
        return;
      }
      // Other dashboard queries are unrelated to this matrix; keep them isolated
      // from a real API or database and return empty responses.
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    sessions.push({ user, context, page: await context.newPage(), pageErrors });
  }

  for (const { user, page, pageErrors } of sessions) {
    for (const workspace of ["cad", "code"]) {
      const settingsLoaded = page.waitForResponse(response =>
        response.url().includes("/api/workspaces/visibility") && response.request().method() === "GET",
      );
      await page.goto(`${serverUrl}/dashboard`);
      await page.getByRole("heading", { name: "Choose a workspace" }).waitFor({ state: "visible" });
      await settingsLoaded;
      await page.getByTestId(user.role === "coordinator" ? "link-workspace-code" : "link-workspace-chat")
        .waitFor({ state: "visible" });
      const name = workspace === "cad" ? "CAD" : "Code";
      const visible = canOpen(user, workspace);
      assert.equal(
        await page.getByTestId(`link-workspace-${workspace}`).isVisible().catch(() => false),
        visible,
        `${user.role} dashboard should ${visible ? "show" : "hide"} ${name}; rendered links: ${
          await page.locator('[data-testid^="link-workspace-"]').evaluateAll(nodes =>
            nodes.map(node => node.getAttribute("data-testid")).join(", "),
          )
        }; main: ${(await page.locator("main").innerText()).slice(0, 1400)}`,
      );

      const apiPath = workspace === "cad" ? "/api/cad/library" : "/api/code/projects";
      const apiStatus = await page.evaluate(async path => (await fetch(path)).status, apiPath);
      assert.equal(apiStatus, visible ? 200 : 403, `${user.role} direct ${name} API request should match settings`);

      await page.goto(`${serverUrl}/${workspace}`);
      if (visible) {
        await page.getByTestId(`link-${workspace}`).waitFor({ state: "visible" });
        assert.equal(new URL(page.url()).pathname, `/${workspace}`, `${user.role} should reach direct /${workspace}`);
      } else {
        await page.waitForURL(url => url.pathname === "/chat", { timeout: 10_000 });
        assert.equal(new URL(page.url()).pathname, "/chat", `${user.role} should be redirected from hidden /${workspace}`);
      }
    }
    assert.deepEqual(pageErrors, [], `${user.role} session should not raise browser errors`);
  }

  // The Settings access matrix groups by role first, then alphabetically.
  const coordinator = sessions.find(({ user }) => user.role === "coordinator");
  await verifyWorkspaceAccessOrdering(coordinator.page);

  // Model an admin saving new settings server-side. The treasurer's separate
  // browser session must refetch them on reload and gain Code in both UI and API.
  visibility.code.push("matrix-treasurer");
  const treasurer = sessions.find(({ user }) => user.role === "treasurer");
  await treasurer.page.goto(`${serverUrl}/dashboard`);
  await treasurer.page.getByRole("heading", { name: "Choose a workspace" }).waitFor({ state: "visible" });
  const refreshedSettings = treasurer.page.waitForResponse(response =>
    response.url().includes("/api/workspaces/visibility") && response.request().method() === "GET",
  );
  await treasurer.page.reload();
  await treasurer.page.getByRole("heading", { name: "Choose a workspace" }).waitFor({ state: "visible" });
  await refreshedSettings;
  await treasurer.page.getByTestId("link-workspace-code").waitFor({ state: "visible" });
  assert.equal(await treasurer.page.getByTestId("link-workspace-code").isVisible(), true);
  assert.equal(
    await treasurer.page.evaluate(async () => (await fetch("/api/code/projects")).status),
    200,
    "treasurer Code API access should update after reloading changed settings",
  );
  await treasurer.page.goto(`${serverUrl}/code`);
  await treasurer.page.getByTestId("link-code").waitFor({ state: "visible" });
  assert.equal(new URL(treasurer.page.url()).pathname, "/code");

  await Promise.all(sessions.map(({ context }) => context.close()));
  console.log("Workspace access role ordering and locked admin toggles verified alongside the existing CAD/Code access checks.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
