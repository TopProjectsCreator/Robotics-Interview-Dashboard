import { logger } from "./logger";

/**
 * Direct upload to a REV Control Hub's OnBotJava server, so the dashboard
 * itself pushes code and triggers the on-hub build. Nobody opens the hub's
 * Program & Manage site: the hub base URL is just an address our code talks
 * to (`POST /java/file/save` per file, then `/java/build/start`, then poll
 * `/java/build/status` and read `/java/build/log`).
 *
 * Endpoint shapes were verified against the shipped OnBotJava 12.0 binaries:
 * save takes form/query params `f` (hub-relative path such as
 * `org/firstinspires/ftc/teamcode/X.java`, POST only) and `data` (content);
 * build start takes no params and the status report carries
 * `{completed, running, successful}`.
 */

export type HubDeployFile = { path: string; content: string };

export type HubDeployResult = {
  hubBaseUrl: string;
  pushed: { path: string; hubPath: string }[];
  skipped: { path: string; reason: string }[];
  buildStarted: boolean;
  buildSuccessful: boolean | null;
  log: string;
};

const MAX_DEPLOY_FILES = 60;
const REQUEST_TIMEOUT_MS = 20_000;
const BUILD_POLL_TIMEOUT_MS = 150_000;
const BUILD_POLL_INTERVAL_MS = 2_000;

/** Hub-relative OnBotJava path for a repo path (matches the dashboard editor). */
export function hubPathFor(repoPath: string): string | null {
  const normalized = repoPath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.endsWith(".java")) return null;
  if (normalized.split("/").includes("..")) return null;
  const marker = "org/firstinspires/ftc/teamcode/";
  const index = normalized.indexOf(marker);
  const hubPath = index >= 0 ? normalized.slice(index) : (normalized.split("/").pop() ?? "");
  if (!hubPath || hubPath.includes("..") || hubPath.length > 255) return null;
  return hubPath;
}

/**
 * Normalizes a hub base URL. Private/LAN addresses are the entire point
 * (the hub lives at 192.168.43.1:8080), but cloud metadata and non-HTTP
 * schemes are rejected so this proxy cannot be turned into an SSRF gadget.
 */
export function normalizeHubBaseUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host || host === "169.254.169.254" || host === "metadata.google.internal") return null;
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function envelopeOk(body: string): boolean {
  return body.includes('"success":"true"') || body.includes('"success":true');
}

async function hubFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; body: string }> {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  return { status: response.status, body: await response.text() };
}

export async function deployProjectToHub(
  hubBaseUrl: string,
  files: HubDeployFile[],
  fetchImpl: typeof fetch = fetch,
): Promise<HubDeployResult> {
  const pushed: HubDeployResult["pushed"] = [];
  const skipped: HubDeployResult["skipped"] = [];
  const javaFiles = files.slice(0, MAX_DEPLOY_FILES);

  for (const file of javaFiles) {
    const hubPath = hubPathFor(file.path);
    if (!hubPath) {
      skipped.push({ path: file.path, reason: "not a Java OpMode file" });
      continue;
    }
    const form = new URLSearchParams();
    form.set("f", hubPath);
    form.set("data", file.content);
    let save: { status: number; body: string };
    try {
      save = await hubFetch(fetchImpl, `${hubBaseUrl}/java/file/save`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      }, REQUEST_TIMEOUT_MS);
    } catch (error) {
      throw new Error(
        `The hub did not answer at ${hubBaseUrl}. The dashboard server must be able to reach the hub (same Wi-Fi/USB network).`,
        { cause: error },
      );
    }
    if (save.status < 200 || save.status >= 300 || !envelopeOk(save.body)) {
      throw new Error(`The hub refused ${hubPath} (HTTP ${save.status}).`);
    }
    pushed.push({ path: file.path, hubPath });
  }

  if (!pushed.length) {
    return { hubBaseUrl, pushed, skipped, buildStarted: false, buildSuccessful: null, log: "" };
  }

  try {
    await hubFetch(fetchImpl, `${hubBaseUrl}/java/build/start`, { method: "GET" }, REQUEST_TIMEOUT_MS);
  } catch (error) {
    throw new Error("Files were saved but the hub build could not be started.", { cause: error });
  }

  const deadline = Date.now() + BUILD_POLL_TIMEOUT_MS;
  let status: { completed?: boolean; successful?: boolean } = {};
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, BUILD_POLL_INTERVAL_MS));
    try {
      const res = await hubFetch(fetchImpl, `${hubBaseUrl}/java/build/status`, { method: "GET" }, REQUEST_TIMEOUT_MS);
      const parsed = JSON.parse(res.body) as { data?: { completed?: boolean; successful?: boolean } };
      status = parsed.data ?? {};
    } catch (error) {
      logger.warn({ err: error }, "Hub build status poll failed");
    }
    if (status.completed || Date.now() > deadline) break;
  }

  let log = "";
  try {
    const res = await hubFetch(fetchImpl, `${hubBaseUrl}/java/build/log`, { method: "GET" }, REQUEST_TIMEOUT_MS);
    log = res.body.slice(0, 20_000);
  } catch (error) {
    logger.warn({ err: error }, "Hub build log fetch failed");
  }

  return {
    hubBaseUrl,
    pushed,
    skipped,
    buildStarted: true,
    buildSuccessful: status.completed ? status.successful !== false : null,
    log,
  };
}
