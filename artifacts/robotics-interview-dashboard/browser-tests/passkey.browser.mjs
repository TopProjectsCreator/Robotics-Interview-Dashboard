import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium } from "playwright";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.resolve(appDir, "../api-server");
const apiRequire = createRequire(path.join(apiDir, "package.json"));
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = apiRequire("@simplewebauthn/server");

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "localhost", () => {
    const address = server.address();
    if (!address || typeof address === "string") return reject(new Error("Could not allocate a test port"));
    server.close(error => (error ? reject(error) : resolve(address.port)));
  });
});

const server = spawn("pnpm", ["exec", "vite", "--config", "vite.config.ts", "--host", "localhost"], {
  cwd: appDir,
  env: { ...process.env, BASE_PATH: "/", PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.setEncoding("utf8").on("data", chunk => { serverOutput += chunk; });
server.stderr.setEncoding("utf8").on("data", chunk => { serverOutput += chunk; });

const account = {
  id: "passkey-browser-test-account",
  displayName: "Browser Test",
  role: "coordinator",
  hasPassword: true,
};
const testPassword = "browser-test-password";
const eventPassword = "browser-test-event-code";
const registeredCredentials = new Map();
const responseAudit = [];
let authenticated = true;
let registrationChallenge;
let authenticationChallenge;
let expireNextRegistration = false;
let expireNextAuthentication = false;

function jsonResponse(value) {
  return { status: 200, contentType: "application/json", body: JSON.stringify(value) };
}

function jsonError(status, error) {
  return { status, contentType: "application/json", body: JSON.stringify({ error }) };
}

async function startTestVite(serverUrl) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before starting:\n${serverOutput}`);
    try {
      const response = await fetch(`${serverUrl}/`);
      if (response.ok) return;
    } catch {
      // Wait for Vite to bind the selected port.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Vite did not start:\n${serverOutput}`);
}

async function fulfill(route, payload) {
  if (payload.body) responseAudit.push({ url: route.request().url(), body: payload.body });
  await route.fulfill(payload);
}

async function mockApi(route, origin) {
  const request = route.request();
  const url = new URL(request.url());
  const apiPath = url.pathname.replace(/^\/api(?=\/)/, "");
  const method = request.method();

  if (apiPath === "/auth/session" && method === "GET") {
    await fulfill(route, jsonResponse(authenticated
      ? { authenticated: true, label: account.displayName, interviewerId: account.id, role: account.role }
      : { authenticated: false }));
    return;
  }
  if (apiPath === "/auth/interviewers" && method === "GET") {
    await fulfill(route, jsonResponse({
      items: [{
        ...account,
        hasPasskey: registeredCredentials.size > 0,
      }],
    }));
    return;
  }
  if (apiPath === "/auth/verify-event-passcode" && method === "POST") {
    const body = request.postDataJSON();
    await fulfill(route, body?.eventPassword === eventPassword
      ? jsonResponse({ valid: true, teamName: "Browser Test Team" })
      : jsonError(401, "The event passcode is incorrect."));
    return;
  }
  if (apiPath === "/auth/passkey/list" && method === "GET") {
    const items = [...registeredCredentials.values()].map(credential => ({
      id: credential.id,
      label: credential.label,
      createdAt: credential.createdAt,
      lastUsedAt: credential.lastUsedAt,
      transports: credential.transports,
    }));
    await fulfill(route, jsonResponse({ items }));
    return;
  }
  if (apiPath === "/auth/passkey/register/options" && method === "POST") {
    const options = await generateRegistrationOptions({
      rpName: "Robotics Interview Dashboard",
      rpID: new URL(origin).hostname,
      userName: account.displayName,
      userID: new TextEncoder().encode(account.id),
      userDisplayName: account.displayName,
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      excludeCredentials: [...registeredCredentials.values()].map(credential => ({
        id: credential.id,
        transports: credential.transports,
      })),
    });
    registrationChallenge = options.challenge;
    await fulfill(route, jsonResponse({ publicKey: options }));
    return;
  }
  if (apiPath === "/auth/passkey/register" && method === "POST") {
    if (expireNextRegistration) {
      expireNextRegistration = false;
      registrationChallenge = undefined;
      await fulfill(route, jsonError(400, "Passkey registration expired. Try again."));
      return;
    }
    const body = request.postDataJSON();
    assert.ok(registrationChallenge, "Registration must have a live challenge");
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: registrationChallenge,
      expectedOrigin: origin,
      expectedRPID: new URL(origin).hostname,
      requireUserVerification: false,
    });
    registrationChallenge = undefined;
    assert.equal(verification.verified, true, "The browser's attestation must verify");
    assert.ok(verification.registrationInfo, "Registration verification should return credential data");
    const stored = verification.registrationInfo.credential;
    const credential = {
      id: stored.id,
      publicKey: stored.publicKey,
      counter: stored.counter ?? 0,
      transports: stored.transports ?? [],
      label: typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : "Passkey",
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    registeredCredentials.set(credential.id, credential);
    await fulfill(route, {
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: credential.id,
        label: credential.label,
        createdAt: credential.createdAt,
        lastUsedAt: null,
        transports: credential.transports,
      }),
    });
    return;
  }
  if (apiPath === "/auth/passkey/login/options" && method === "POST") {
    const body = request.postDataJSON();
    if (body?.eventPassword !== eventPassword) {
      await fulfill(route, jsonError(401, "The event passcode is incorrect."));
      return;
    }
    const options = await generateAuthenticationOptions({
      rpID: new URL(origin).hostname,
      allowCredentials: [...registeredCredentials.values()].map(credential => ({
        id: credential.id,
        transports: credential.transports,
      })),
      userVerification: "preferred",
    });
    authenticationChallenge = options.challenge;
    await fulfill(route, jsonResponse({ publicKey: options }));
    return;
  }
  if (apiPath === "/auth/passkey/login" && method === "POST") {
    if (expireNextAuthentication) {
      expireNextAuthentication = false;
      authenticationChallenge = undefined;
      await fulfill(route, jsonError(400, "Passkey sign-in expired. Try again."));
      return;
    }
    const body = request.postDataJSON();
    if (!authenticationChallenge) {
      await fulfill(route, jsonError(400, "Passkey sign-in expired. Try again."));
      return;
    }
    const credentialId = body?.response?.id;
    const stored = registeredCredentials.get(credentialId);
    assert.ok(stored, "Assertion must reference a registered credential");
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: authenticationChallenge,
      expectedOrigin: origin,
      expectedRPID: new URL(origin).hostname,
      requireUserVerification: false,
      credential: {
        id: stored.id,
        publicKey: stored.publicKey,
        counter: stored.counter,
        transports: stored.transports,
      },
    });
    authenticationChallenge = undefined;
    assert.equal(verification.verified, true, "The browser's assertion signature must verify");
    stored.counter = verification.authenticationInfo.newCounter;
    stored.lastUsedAt = new Date().toISOString();
    authenticated = true;
    await fulfill(route, jsonResponse({
      authenticated: true,
      label: account.displayName,
      interviewerId: account.id,
      role: account.role,
      token: "browser-test-session",
    }));
    return;
  }
  if (apiPath === "/auth/login" && method === "POST") {
    const body = request.postDataJSON();
    if (body?.eventPassword !== eventPassword || body?.password !== testPassword) {
      await fulfill(route, jsonError(401, "The password was rejected."));
      return;
    }
    authenticated = true;
    await fulfill(route, jsonResponse({
      authenticated: true,
      label: account.displayName,
      interviewerId: account.id,
      role: account.role,
      token: "browser-test-session",
    }));
    return;
  }

  await fulfill(route, jsonResponse({}));
}

async function enterPasswordLogin(page, serverUrl) {
  await page.goto(`${serverUrl}/auth?returnTo=%2Fdashboard`);
  await page.getByTestId("input-event-passcode").fill(eventPassword);
  await page.getByTestId("button-event-passcode").click();
  await page.getByTestId(`button-choose-interviewer-${account.displayName.toLowerCase().replaceAll(" ", "-")}`).click();
  await page.getByTestId("input-personal-password").waitFor();
}

async function submitPassword(page) {
  await page.getByTestId("input-personal-password").fill(testPassword);
  assert.equal(await page.getByTestId("button-personal-password").isDisabled(), false, "Password sign-in should remain enabled after a password is entered");
  await page.getByTestId("button-personal-password").click();
  await page.waitForURL("**/dashboard");
}

let browser;
try {
  const serverUrl = `http://localhost:${port}`;
  await startTestVite(serverUrl);

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
  await context.addInitScript(() => localStorage.setItem("robotics_admin_session_token", "browser-test-session"));
  await context.addInitScript(() => {
    if (typeof PublicKeyCredential !== "undefined") {
      Object.defineProperty(PublicKeyCredential, "getClientCapabilities", {
        configurable: true,
        value: async () => ({
          passkeyPlatformAuthenticator: true,
          userVerifyingPlatformAuthenticator: true,
        }),
      });
    }
  });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on("console", message => consoleMessages.push(message.text()));
  await page.route("**/api/**", route => mockApi(route, serverUrl));

  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresence: true,
    },
  });

  await page.goto(`${serverUrl}/dashboard`);
  await page.getByTestId("button-account-menu").waitFor();
  await page.getByTestId("button-account-menu").click();
  await page.getByTestId("button-open-settings").click();
  await page.getByRole("dialog", { name: "Workspace settings" }).waitFor();
  await page.getByTestId("button-add-passkey").waitFor();

  // A completed browser ceremony must still be rejected by the server when
  // its short-lived registration challenge has expired.
  expireNextRegistration = true;
  await page.getByTestId("input-passkey-label").fill("Expired registration");
  await page.getByTestId("button-add-passkey").click();
  await page.getByTestId("passkey-error").waitFor();
  assert.match(await page.getByTestId("passkey-error").innerText(), /expired/i);
  assert.equal(registeredCredentials.size, 0, "An expired challenge must not persist a credential");

  // Retry with a fresh challenge and complete an actual CTAP2-backed
  // registration. The server-side SimpleWebAuthn verifier checks the
  // attestation generated by Chromium's virtual authenticator.
  await page.getByTestId("input-passkey-label").fill("Chromium test passkey");
  await page.getByTestId("button-add-passkey").click();
  await page.getByTestId("passkey-success").waitFor();
  assert.match(await page.getByTestId("passkey-success").innerText(), /Chromium test passkey added/i);
  assert.equal(registeredCredentials.size, 1);
  await assert.doesNotReject(async () => cdp.send("WebAuthn.getCredentials", { authenticatorId }));

  // Leave Settings and use the product's team-code + account + passkey flow.
  authenticated = false;
  await page.evaluate(() => localStorage.clear());
  await enterPasswordLogin(page, serverUrl);
  await page.getByTestId("button-passkey-login").click();
  await page.waitForURL("**/dashboard");
  assert.equal(authenticated, true, "A verified browser assertion should sign in");
  assert.ok([...registeredCredentials.values()][0].lastUsedAt, "Successful use should update the credential's last-used time");

  // Browser cancellation is surfaced as the standard WebAuthn NotAllowedError
  // that browsers produce when a user dismisses the authenticator prompt.
  authenticated = false;
  await page.evaluate(() => localStorage.clear());
  await enterPasswordLogin(page, serverUrl);
  await page.evaluate(() => {
    window.__nativeCredentialGet = navigator.credentials.get.bind(navigator.credentials);
    Object.defineProperty(navigator.credentials, "get", {
      configurable: true,
      value: async () => { throw new DOMException("The request was cancelled.", "NotAllowedError"); },
    });
  });
  await page.getByTestId("button-passkey-login").click();
  await page.getByTestId("login-error").waitFor();
  assert.match(await page.getByTestId("login-error").innerText(), /password instead/i);
  await submitPassword(page);
  assert.equal(authenticated, true, "Password sign-in should work after authenticator cancellation");

  // The server can reject an otherwise valid assertion after challenge
  // expiry; the UI must keep its password path available.
  authenticated = false;
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    Object.defineProperty(navigator.credentials, "get", {
      configurable: true,
      value: window.__nativeCredentialGet,
    });
  });
  await enterPasswordLogin(page, serverUrl);
  expireNextAuthentication = true;
  await page.getByTestId("button-passkey-login").click();
  await page.getByTestId("login-error").waitFor();
  assert.match(await page.getByTestId("login-error").innerText(), /expired.*password instead/i);
  await submitPassword(page);
  assert.equal(authenticated, true, "Password sign-in should work after an expired passkey challenge");

  // Hide WebAuthn support as on a browser without PublicKeyCredential. This
  // must remove the passkey action, not the ordinary password route.
  authenticated = false;
  const unsupportedContext = await browser.newContext();
  await unsupportedContext.addInitScript(() => {
    localStorage.clear();
    Object.defineProperty(window, "PublicKeyCredential", { configurable: true, value: undefined });
  });
  const unsupportedPage = await unsupportedContext.newPage();
  await unsupportedPage.route("**/api/**", route => mockApi(route, serverUrl));
  await enterPasswordLogin(unsupportedPage, serverUrl);
  assert.equal(await unsupportedPage.getByTestId("button-passkey-login").count(), 0);
  await submitPassword(unsupportedPage);
  assert.equal(authenticated, true, "Unsupported-browser password sign-in should still work");

  const storedPublicKeyBytes = Buffer.from([...registeredCredentials.values()][0].publicKey).toString("base64url");
  for (const { body } of responseAudit) {
    assert.doesNotMatch(body, /"privateKey"\s*:|"credentialPublicKey"\s*:/i, "API responses must not include private credential material");
    assert.equal(body.includes(storedPublicKeyBytes), false, "API responses must not expose stored credential key bytes");
  }
  assert.equal(
    consoleMessages.some(message => message.includes(storedPublicKeyBytes)),
    false,
    "Frontend console logs must not expose credential key bytes",
  );

  await unsupportedContext.close();
  await context.close();
  console.log("Chromium WebAuthn passed: registration and assertion signatures verified; expired/cancelled challenges and unsupported-browser password fallback worked without exposing stored key material.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
