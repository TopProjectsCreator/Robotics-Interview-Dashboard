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
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before starting:\n${serverOutput}`);
    try {
      const response = await fetch(`${serverUrl}/browser-tests/chat-upload-failure.html`);
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

  const runFailureCase = async ({ failCleanup, expectedStoredObjects }) => {
    const page = await browser.newPage();
    const uploadedObjects = new Map();
    const uploads = [];
    const deleteRequests = [];
    const messages = [];
    const saveError = "The chat service could not save this message. Try again.";
    let uploadNumber = 0;

    await page.route("**/api/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();

      if (url.pathname === "/api/storage/uploads" && method === "POST") {
        const body = request.postDataBuffer();
        const contentType = request.headers()["content-type"] ?? "";
        assert.ok(body?.length, "the browser should send the attachment bytes");
        const objectId = `failed-chat-upload-${++uploadNumber}`;
        uploadedObjects.set(objectId, { body, contentType });
        uploads.push({ objectId, body, contentType });
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ objectPath: `/objects/${objectId}` }) });
        return;
      }

      if (url.pathname === "/api/queue/chat" && method === "POST") {
        messages.push(JSON.parse(request.postData() ?? "{}"));
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: saveError }) });
        return;
      }

      const objectMatch = url.pathname.match(/^\/api\/storage\/objects\/([^/]+)$/);
      if (objectMatch && method === "DELETE") {
        deleteRequests.push(objectMatch[1]);
        if (failCleanup) {
          await route.abort("failed");
        } else {
          uploadedObjects.delete(objectMatch[1]);
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        }
        return;
      }

      if (url.pathname === "/api/queue/chat") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], scope: "shared", peer: null }),
        });
        return;
      }

      if (url.pathname === "/api/session") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ authenticated: true, interviewerId: "browser-test", label: "Browser Tester" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], interviewerLabels: [] }),
      });
    });

    await page.goto(`${serverUrl}/browser-tests/chat-upload-failure.html`);
    await page.getByTestId("input-chat-image").setInputFiles([
      {
        name: "brief.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\nRobotics interview brief"),
      },
      {
        name: "interview.mp3",
        mimeType: "audio/mpeg",
        buffer: Buffer.from("ID3 robotics audio fixture"),
      },
    ]);
    await page.getByTestId("input-interviewer-chat").fill("Please review these interview materials.");
    await page.getByText("brief.pdf").waitFor();
    await page.getByText("interview.mp3").waitFor();
    await page.getByTestId("button-send-interviewer-chat").click();

    const error = page.getByTestId("chat-error");
    await error.waitFor();
    assert.equal(await error.innerText(), saveError, "the original chat-save error should be shown");
    assert.equal(await page.locator(".chat-message-card").count(), 0, "a failed save must not appear in the conversation");
    assert.equal(messages.length, 1, "the browser should make exactly one failed chat-save attempt");
    assert.deepEqual(
      uploads.map(({ contentType }) => contentType).sort(),
      ["application/pdf", "audio/mpeg"],
      "the browser should upload a document and a media file",
    );
    assert.equal(uploads.length, 2);
    assert.deepEqual(deleteRequests.sort(), uploads.map(({ objectId }) => objectId).sort(), "each successful upload should be cleaned up");
    assert.equal(uploadedObjects.size, expectedStoredObjects, "the storage fixture should reflect cleanup results");

    await page.close();
  };

  await runFailureCase({ failCleanup: false, expectedStoredObjects: 0 });
  await runFailureCase({ failCleanup: true, expectedStoredObjects: 2 });

  console.log("Chat save failures showed the original error, did not add a message, and attempted cleanup for both uploaded files.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}