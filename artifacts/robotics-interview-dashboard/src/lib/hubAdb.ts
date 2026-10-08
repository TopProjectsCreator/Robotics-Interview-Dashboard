import {
  Adb,
  AdbDaemonTransport,
  type AdbCredentialStore,
  type AdbPrivateKey,
} from "@yume-chan/adb";
import { ReadableStream } from "@yume-chan/stream-extra";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import { hubPathFor } from "./codeWorkspace";

/**
 * Direct hub upload over USB from this dashboard tab. No cloud routing, no
 * CORS, no opening the hub's site: the browser speaks ADB to the Control Hub
 * over WebUSB (Render-hosted dashboard works fine — only this tab and the USB
 * cable matter).
 *
 * On-hub layout was verified against the shipped OnBotJava 12.0 binaries
 * (OnBotJavaManager static init hangs everything off AppUtil.FIRST_FOLDER,
 * i.e. /sdcard/FIRST):
 * - sources:            /sdcard/FIRST/java/src/<org/.../X.java>
 * - build trigger:      write "<ts> - begin build" to
 *                       /sdcard/FIRST/java/control/buildRequest.txt
 *                       (BuildMonitor.launchBuild does exactly this)
 * - completion + log:   /sdcard/FIRST/java/status/buildComplete.txt and
 *                       .../buildLog.txt
 */

export const HUB_ADB_SRC_ROOT = "/sdcard/FIRST/java/src";
export const HUB_ADB_BUILD_REQUEST = "/sdcard/FIRST/java/control/buildRequest.txt";
export const HUB_ADB_BUILD_COMPLETE = "/sdcard/FIRST/java/status/buildComplete.txt";
export const HUB_ADB_BUILD_LOG = "/sdcard/FIRST/java/status/buildLog.txt";

const ADB_KEY_STORAGE = "code-adb-key-pkcs8-b64";
const BUILD_WAIT_TIMEOUT_MS = 150_000;
const BUILD_WAIT_INTERVAL_MS = 1_500;
const MAX_USB_FILES = 60;

export type HubAdbStep = (line: string) => void;
export type HubAdbFile = { path: string; content: string };

export type HubAdbResult = {
  pushed: { path: string; hubPath: string }[];
  skipped: { path: string; reason: string }[];
  buildStarted: boolean;
  buildSuccessful: boolean | null;
  log: string;
};

export function isUsbAdbSupported(): boolean {
  return AdbDaemonWebUsbDeviceManager.BROWSER !== undefined;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function generateRsaKey(): Promise<Uint8Array> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
}

/**
 * ADB credential store. The key persists in this browser so the hub keeps
 * recognizing the laptop across sessions instead of re-prompting.
 */
export function createCredentialStore(storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage): AdbCredentialStore {
  let cached: AdbPrivateKey | null = null;
  const load = (): AdbPrivateKey | null => {
    if (cached) return cached;
    try {
      const saved = storage.getItem(ADB_KEY_STORAGE);
      if (saved) cached = { buffer: base64ToBytes(saved), name: "dashboard" };
    } catch {
      cached = null;
    }
    return cached;
  };
  return {
    async generateKey(): Promise<AdbPrivateKey> {
      const existing = load();
      if (existing) return existing;
      const buffer = await generateRsaKey();
      cached = { buffer, name: "dashboard" };
      try {
        storage.setItem(ADB_KEY_STORAGE, bytesToBase64(buffer));
      } catch {
        // Private-browsing fallback: the key just lives for this session.
      }
      return cached;
    },
    *iterateKeys(): Iterable<AdbPrivateKey> {
      const existing = load();
      if (existing) yield existing;
    },
  };
}

export function textToStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export async function collectStream(stream: ReadableStream<Uint8Array>, maxBytes = 100_000): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
      if (total >= maxBytes) break;
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const room = Math.min(chunk.byteLength, merged.byteLength - offset);
    if (room <= 0) break;
    merged.set(chunk.subarray(0, room), offset);
    offset += room;
  }
  return new TextDecoder().decode(merged);
}

export type HubAdbSync = {
  write: (options: { filename: string; file: ReadableStream<Uint8Array> }) => Promise<void>;
  read: (filename: string) => ReadableStream<Uint8Array>;
};

export async function readRemoteText(sync: HubAdbSync, path: string): Promise<string | null> {
  try {
    return await collectStream(sync.read(path));
  } catch {
    return null;
  }
}

async function writeRemoteText(sync: HubAdbSync, path: string, text: string): Promise<void> {
  await sync.write({ filename: path, file: textToStream(text) });
}

/**
 * Waits until the hub's build-complete marker changes from its baseline.
 * Returns the final marker content, or null on timeout.
 */
export async function waitForBuildComplete(
  readFile: (path: string) => Promise<string | null>,
  baseline: string | null,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? BUILD_WAIT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? BUILD_WAIT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const current = await readFile(HUB_ADB_BUILD_COMPLETE);
    if (current !== null && current !== baseline) return current;
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export type HubAdbConnection = {
  adb: Adb;
  serial: string;
  label: string;
  close: () => Promise<void>;
};

/** Prompts for the hub over USB and completes ADB authentication. Call from a click. */
export async function connectHubUsb(onStep: HubAdbStep = () => undefined): Promise<HubAdbConnection> {
  const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!manager) {
    throw new Error("WebUSB is not available. Use Chrome or Edge on desktop over HTTPS.");
  }
  onStep("Pick the Control Hub in the USB dialog…");
  const device = await manager.requestDevice();
  if (!device) throw new Error("No USB device was picked.");
  onStep(`Opening ${device.name || "USB device"}…`);
  const connection = await device.connect();
  let transport: AdbDaemonTransport;
  try {
    transport = await AdbDaemonTransport.authenticate({
      serial: device.serial,
      connection,
      credentialStore: createCredentialStore(),
    });
  } catch (error) {
    throw new Error(
      "The hub refused the ADB connection. If it asks for authorization, accept it and retry. " +
        (error instanceof Error ? error.message : ""),
    );
  }
  const adb = new Adb(transport);
  const serial = transport.serial || device.serial || "hub";
  onStep(`Connected to ${device.name || "Control Hub"} over USB (ADB).`);
  return {
    adb,
    serial,
    label: device.name || "Control Hub",
    close: async () => {
      try {
        await adb.close();
      } catch {
        // Already closed.
      }
    },
  };
}

/**
 * Full dashboard-side deploy: push sources, trigger the on-hub build by
 * writing the build-request file, then poll the completion marker and read
 * the compiler log back — all over USB, nothing else to open.
 */
export async function uploadAndBuildViaUsb(
  connection: HubAdbConnection,
  files: HubAdbFile[],
  onStep: HubAdbStep = () => undefined,
): Promise<HubAdbResult> {
  const sync = (await connection.adb.sync()) as unknown as HubAdbSync;
  const pushed: HubAdbResult["pushed"] = [];
  const skipped: HubAdbResult["skipped"] = [];
  try {
    const javaFiles = files.filter((file) => file.path.endsWith(".java")).slice(0, MAX_USB_FILES);
    for (const file of files) {
      if (!file.path.endsWith(".java")) skipped.push({ path: file.path, reason: "not a Java OpMode file" });
    }
    const baseline = await readRemoteText(sync, HUB_ADB_BUILD_COMPLETE);
    for (const [index, file] of javaFiles.entries()) {
      const hubPath = hubPathFor(file.path);
      if (!hubPath) {
        skipped.push({ path: file.path, reason: "path rejected" });
        continue;
      }
      const remote = `${HUB_ADB_SRC_ROOT}/${hubPath}`;
      await writeRemoteText(sync, remote, file.content);
      pushed.push({ path: file.path, hubPath });
      onStep(`Pushed ${hubPath} (${index + 1}/${javaFiles.length}) over USB.`);
    }
    if (!pushed.length) {
      return { pushed, skipped, buildStarted: false, buildSuccessful: null, log: "" };
    }
    await writeRemoteText(sync, HUB_ADB_BUILD_REQUEST, `${Date.now()} - begin build`);
    onStep("Build triggered on the hub — waiting for the compiler…");
    const completed = await waitForBuildComplete(
      (path) => readRemoteText(sync, path),
      baseline,
    );
    const log = (await readRemoteText(sync, HUB_ADB_BUILD_LOG)) ?? "";
    if (completed === null) {
      onStep("Timed out waiting for the hub build. It may still be running — check the Driver Station.");
      return { pushed, skipped, buildStarted: true, buildSuccessful: null, log: log.slice(0, 20_000) };
    }
    const successful = /build successful/i.test(log);
    onStep(successful ? "Hub build succeeded." : "Hub build finished with errors — see Problems.");
    return { pushed, skipped, buildStarted: true, buildSuccessful: successful, log: log.slice(0, 20_000) };
  } finally {
    try {
      await (sync as unknown as { dispose: () => Promise<void> }).dispose();
    } catch {
      // Sync socket cleanup is best-effort.
    }
  }
}
