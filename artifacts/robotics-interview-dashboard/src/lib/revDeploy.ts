import { zipSync } from "fflate";
import { onBotPathFor, TOOLCHAIN_NOTE } from "./codeWorkspace";

export type CodeDeployFile = { path: string; content: string };

export function supportsWebSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export function supportsWebUSB(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export type SerialConsole = {
  close: () => Promise<void>;
  send: (line: string) => Promise<void>;
};

export async function openSerialConsole(options: {
  baudRate?: number;
  onLine: (line: string) => void;
  onError?: (message: string) => void;
}): Promise<SerialConsole> {
  const serial = (navigator as Navigator & { serial: Serial }).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate: options.baudRate ?? 115200, dataBits: 8, stopBits: 1, parity: "none" });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let closed = false;
  let buffer = "";

  const reader = port.readable?.getReader();
  const pump = async (): Promise<void> => {
    if (!reader) return;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done || closed) break;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          let index = buffer.indexOf("\n");
          while (index >= 0) {
            const line = buffer.slice(0, index).replace(/\r$/, "");
            buffer = buffer.slice(index + 1);
            options.onLine(line);
            index = buffer.indexOf("\n");
          }
        }
      }
    } catch (error) {
      if (!closed) options.onError?.(error instanceof Error ? error.message : "Serial read failed.");
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Already released.
      }
    }
  };
  void pump();

  return {
    close: async () => {
      closed = true;
      try {
        await reader?.cancel();
      } catch {
        // Ignore cancel races.
      }
      try {
        await port.close();
      } catch {
        // Port may already be closed.
      }
    },
    send: async (line: string) => {
      const writer = port.writable?.getWriter();
      if (!writer) throw new Error("This serial port is not writable.");
      try {
        await writer.write(encoder.encode(`${line}\n`));
      } finally {
        writer.releaseLock();
      }
    },
  };
}

export type UsbDeviceSummary = {
  productName: string;
  vendorId: string;
  productId: string;
  serialNumber: string;
  manufacturerName: string;
};

export async function requestUsbDevice(): Promise<UsbDeviceSummary> {
  const usb = (navigator as Navigator & { usb: USB }).usb;
  const device = await usb.requestDevice({ filters: [] });
  await device.open().catch(() => undefined);
  const summary: UsbDeviceSummary = {
    productName: device.productName ?? "Unknown USB device",
    vendorId: `0x${device.vendorId.toString(16).padStart(4, "0")}`,
    productId: `0x${device.productId.toString(16).padStart(4, "0")}`,
    serialNumber: device.serialNumber ?? "—",
    manufacturerName: device.manufacturerName ?? "—",
  };
  await device.close().catch(() => undefined);
  return summary;
}

export function downloadBlob(fileName: string, data: Uint8Array | string, mime: string): void {
  const blob = data instanceof Uint8Array
    ? new Blob([data as unknown as BlobPart], { type: mime })
    : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** TeamCode ZIP in FtcRobotController layout + deploy notes (JDK 21 / Java 8). */
export function buildTeamCodeZip(projectName: string, files: CodeDeployFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const encoder = new TextEncoder();
  for (const file of files) {
    entries[file.path] = encoder.encode(file.content);
  }
  entries["HOW-TO-DEPLOY.txt"] = encoder.encode(
    `${projectName} — TeamCode export\n` +
      `Toolchain: ${TOOLCHAIN_NOTE}\n\n` +
      `USB deploy (Android Studio, your usual flow):\n` +
      `1. Copy TeamCode/src/... into your FtcRobotController checkout (SDK v12.0 BIOBUZZ).\n` +
      `2. Plug the Control Hub in over USB-C.\n` +
      `3. Run the app (Gradle installDebug) from Android Studio.\n\n` +
      `OnBotJava files (single-file OpModes) live at:\n` +
      files
        .filter((file) => file.path.endsWith(".java"))
        .map((file) => ` - ${onBotPathFor(file.path)}`)
        .join("\n"),
  );
  return zipSync(entries, { level: 6 });
}

/** Single-file OpModes flattened for OnBotJava drag-upload. */
export function onBotExport(files: CodeDeployFile[]): { name: string; content: string }[] {
  return files
    .filter((file) => file.path.endsWith(".java"))
    .map((file) => ({ name: onBotPathFor(file.path), content: file.content }));
}
