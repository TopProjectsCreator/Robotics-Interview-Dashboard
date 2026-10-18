import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileViewports = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
];
const desktopViewport = { width: 1024, height: 900 };
const project = {
  id: "mobile-code-project",
  name: "Robot Code",
  sdkVersion: "v12",
  gitConfig: {},
  fileCount: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const file = {
  id: "mobile-code-file",
  projectId: project.id,
  path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Robot.java",
  content: "public class Robot {\n    void run() {}\n}",
  sizeBytes: 41,
  updatedBy: "Browser Tester",
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
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
      const response = await fetch(`${serverUrl}/code`);
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

  const page = await browser.newPage({ viewport: mobileViewports[0], hasTouch: true });
  const pageErrors = [];
  let savedContent = null;
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    class PreviewSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = PreviewSocket.CONNECTING;
      binaryType = "blob";
      onopen = null;
      onmessage = null;
      onerror = null;
      onclose = null;
      send() {}
      close() { this.readyState = PreviewSocket.CLOSED; }
      addEventListener() {}
      removeEventListener() {}
    }
    window.WebSocket = PreviewSocket;
  });
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body = {};
    if (url.pathname === "/api/auth/session") {
      body = { authenticated: true, interviewerId: "code-mobile-test", label: "Browser Tester", role: "coordinator" };
    } else if (url.pathname === "/api/code/projects") {
      body = { projects: [project] };
    } else if (url.pathname === `/api/code/projects/${project.id}/files`) {
      body = { files: [file] };
    } else if (url.pathname === `/api/code/projects/${project.id}/revisions`) {
      body = { revisions: [] };
    } else if (url.pathname === `/api/code/projects/${project.id}/presence`) {
      body = { presence: [] };
    } else if (url.pathname === `/api/code/files/${file.id}` && request.method() === "PUT") {
      savedContent = request.postDataJSON().content;
      body = { file: { ...file, content: savedContent } };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(`${serverUrl}/code`, { waitUntil: "domcontentloaded" });
  await page.getByTestId(`code-file-${file.path}`).waitFor({ state: "visible" });
  await page.getByTestId("code-project-name").waitFor({ state: "visible" });

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    const explorer = page.getByTestId("code-side-explorer");
    await explorer.click();
    assert.equal(await page.getByTestId("code-search").isVisible(), true, `${viewport.width}px explorer should be reachable`);

    const layout = await page.evaluate(() => {
      const rect = element => {
        const { left, right, width, height } = element.getBoundingClientRect();
        return { left, right, width, height };
      };
      return {
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        ide: rect(document.querySelector('[data-testid="code-workspace"]')),
        navigation: [...document.querySelectorAll('button[data-testid^="code-side-"]')].map(rect),
        projectActions: rect(document.querySelector(".code-project-actions")),
        projectSelect: rect(document.querySelector('[data-testid="code-project-select"]')),
        createProject: rect(document.querySelector('[data-testid="code-new-project"]')),
        save: rect(document.querySelector('[data-testid="code-save"]')),
        problems: rect(document.querySelector('[data-testid="code-bottom-problems"]')),
        terminal: rect(document.querySelector('[data-testid="code-bottom-terminal"]')),
        overflowing: [...document.body.querySelectorAll("*")]
          .map(element => {
            const bounds = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              testId: element.getAttribute("data-testid"),
              className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
              left: Math.round(bounds.left),
              right: Math.round(bounds.right),
              width: Math.round(bounds.width),
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            };
          })
          .filter(element => element.right > window.innerWidth + 1 || element.left < -1)
          .sort((a, b) => b.right - a.right)
          .slice(0, 8),
      };
    });
    assert.equal(layout.viewport, viewport.width);
    assert.ok(layout.document <= viewport.width && layout.body <= viewport.width,
      `${viewport.width}px code workspace should not cause page-level horizontal scrolling: ${JSON.stringify(layout)}`);
    assert.ok(layout.ide.left >= 0 && layout.ide.right <= viewport.width,
      `${viewport.width}px IDE should fit the viewport: ${JSON.stringify(layout)}`);
    assert.equal(layout.navigation.length, 4, "all four side panels should be available");
    for (const bounds of layout.navigation) {
      assert.ok(bounds.left >= 0 && bounds.right <= viewport.width && bounds.width >= 64 && bounds.height >= 44,
        `${viewport.width}px side-panel controls should be touch-friendly: ${JSON.stringify(bounds)}`);
    }
    for (const [name, bounds] of [["Project selector", layout.projectSelect], ["New project", layout.createProject]]) {
      assert.ok(bounds.left >= 0 && bounds.right <= viewport.width,
        `${viewport.width}px ${name} should remain within the viewport: ${JSON.stringify(bounds)}`);
    }
    assert.ok(layout.projectActions.left >= 0 && layout.projectActions.right <= viewport.width,
      `${viewport.width}px project actions should fit the viewport: ${JSON.stringify(layout.projectActions)}`);
    assert.ok(layout.save.right <= viewport.width && layout.save.height >= 40,
      `${viewport.width}px save action should remain visible and touch-friendly: ${JSON.stringify(layout.save)}`);
    for (const [name, bounds] of [["Problems", layout.problems], ["Terminal", layout.terminal]]) {
      assert.ok(bounds.left >= 0 && bounds.right <= viewport.width && bounds.height >= 40,
        `${viewport.width}px ${name} control should fit and remain touch-friendly: ${JSON.stringify(bounds)}`);
    }

    for (const [panel, label, control] of [
      ["git", "Git", "code-git-url"],
      ["ai", "AI assistant", "code-ai-prompt"],
      ["deploy", "Deploy", "code-deploy-zip"],
    ]) {
      const navigation = page.getByTestId(`code-side-${panel}`);
      await navigation.focus();
      await navigation.press("Enter");
      assert.equal(await page.getByTestId(control).isVisible(), true,
        `${viewport.width}px ${panel} panel should open from keyboard-accessible navigation`);
      assert.equal(await page.getByRole("region", { name: `${label} panel` }).isVisible(), true,
        `${viewport.width}px ${label} panel should be announced as a named region`);
      assert.equal(await page.getByTestId("code-mobile-panel-close").isVisible(), true,
        `${viewport.width}px ${panel} panel should offer a return-to-editor control`);
      await page.getByTestId("code-mobile-panel-close").click();
      assert.equal(await page.getByTestId(control).isVisible(), false,
        `${viewport.width}px return-to-editor should close the panel`);
    }

    await page.getByTestId("code-side-explorer").click();
    const fileRow = page.getByTestId(`code-file-${file.path}`);
    const openFileButton = fileRow.getByRole("button").first();
    const openFileBounds = await openFileButton.boundingBox();
    const deleteFileBounds = await fileRow.getByRole("button", { name: `Delete ${file.path}` }).boundingBox();
    assert.ok(openFileBounds && openFileBounds.height >= 44,
      `${viewport.width}px file selection should be a touch-sized control: ${JSON.stringify(openFileBounds)}`);
    assert.ok(deleteFileBounds && deleteFileBounds.width >= 40 && deleteFileBounds.height >= 40,
      `${viewport.width}px file delete should be visible and touch-sized: ${JSON.stringify(deleteFileBounds)}`);
    await openFileButton.focus();
    await openFileButton.press("Enter");
    const editor = page.getByTestId("code-textarea");
    await editor.waitFor({ state: "visible" });
    const fileTabBounds = await page.getByTestId(`code-tab-${file.path}`).boundingBox();
    const closeTabBounds = await page.getByTestId(`code-tab-${file.path}`).getByRole("button", { name: `Close ${file.path}` }).boundingBox();
    assert.ok(fileTabBounds && fileTabBounds.x >= 0 && fileTabBounds.x + fileTabBounds.width <= viewport.width,
      `${viewport.width}px open-file tab should fit the viewport: ${JSON.stringify(fileTabBounds)}`);
    assert.ok(closeTabBounds && closeTabBounds.width >= 40 && closeTabBounds.height >= 40,
      `${viewport.width}px close-tab control should be touch-sized: ${JSON.stringify(closeTabBounds)}`);
    assert.equal(await page.getByTestId("code-mobile-panel-close").isVisible(), false,
      `${viewport.width}px file selection should return to the editor`);
    const nextContent = `${file.content}\n// edited on ${viewport.width}px`;
    await editor.fill(nextContent);
    const saveResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/code/files/${file.id}` && response.request().method() === "PUT");
    await page.getByTestId("code-save").click();
    await saveResponse;
    assert.equal(savedContent, nextContent, `${viewport.width}px save should persist the edited buffer`);

    await page.getByTestId("code-bottom-terminal").click();
    assert.equal(await page.getByTestId("code-bottom-terminal").getAttribute("aria-selected"), "true");
    await page.getByTestId("code-bottom-problems").click();
    assert.equal(await page.getByTestId("code-bottom-problems").getAttribute("aria-selected"), "true");
  }

  await page.setViewportSize(desktopViewport);
  const desktopGeometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    sidePanel: document.querySelector('[data-testid="code-side-panel"]').getBoundingClientRect().width,
    activityBar: document.querySelector(".code-activity-bar").getBoundingClientRect().width,
  }));
  assert.ok(desktopGeometry.document <= desktopGeometry.viewport,
    `desktop code workspace should not overflow: ${JSON.stringify(desktopGeometry)}`);
  assert.equal(desktopGeometry.sidePanel, 280, "desktop side panel should retain its existing width");
  assert.equal(desktopGeometry.activityBar, 48, "desktop activity bar should retain its existing width");
  await page.getByTestId("code-side-git").click();
  assert.equal(await page.getByTestId("code-git-url").isVisible(), true, "desktop Git navigation should still work");
  assert.deepEqual(pageErrors, [], "code workspace should not raise browser errors");

  console.log("Code workspace navigation, file editing, save, bottom-panel controls, and desktop split-pane behavior passed at 320px, 375px, 430px, and 1024px.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
