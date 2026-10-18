// Matches hubAdb.ts: the ADB layer uses stream-extra's ReadableStream, which
// is a distinct class from the DOM global of the same name.
import { ReadableStream } from "@yume-chan/stream-extra";
import { describe, expect, it, vi } from "vitest";

import {
  collectStream,
  createCredentialStore,
  HUB_ADB_BUILD_COMPLETE,
  HUB_ADB_BUILD_REQUEST,
  HUB_ADB_SRC_ROOT,
  textToStream,
  uploadAndBuildViaUsb,
  waitForBuildComplete,
  type HubAdbSync,
} from "./hubAdb";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("usb adb credential store", () => {
  it("keeps one stable key per browser", async () => {
    const storage = memoryStorage();
    const store = createCredentialStore(storage);
    const first = await store.generateKey();
    const second = await store.generateKey();
    expect(first.buffer).toEqual(second.buffer);
    const names: string[] = [];
    // AdbKeyIterable is `Iterable | AsyncIterable`; our store implements it as a
    // sync generator, so narrow to the sync half that `for...of` can consume.
    for (const key of store.iterateKeys() as Iterable<{ name?: string }>) {
      names.push(key.name ?? "");
    }
    expect(names).toEqual(["dashboard"]);
  });
});

describe("stream helpers", () => {
  it("round-trips text through a stream", async () => {
    const stream = textToStream("hello hub");
    await expect(collectStream(stream)).resolves.toBe("hello hub");
  });
});

function fakeSync(files: Map<string, string>): HubAdbSync {
  return {
    write: async ({ filename, file }) => {
      files.set(filename, await collectStream(file));
    },
    read: (filename: string) => {
      const content = files.get(filename);
      if (content === undefined) {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(new Error("no such file"));
          },
        });
      }
      return textToStream(content);
    },
  };
}

describe("usb build wait", () => {
  it("returns once the completion marker changes", async () => {
    let marker: string | null = "111 - begin build";
    setTimeout(() => {
      marker = "222 - build finished";
    }, 20);
    const result = await waitForBuildComplete(async () => marker, "111 - begin build", {
      timeoutMs: 2000,
      intervalMs: 5,
    });
    expect(result).toBe("222 - build finished");
  });

  it("times out instead of hanging forever", async () => {
    const result = await waitForBuildComplete(async () => "same", "same", {
      timeoutMs: 30,
      intervalMs: 5,
    });
    expect(result).toBe(null);
  });
});

describe("usb upload and build", () => {
  it("pushes sources, triggers the build file, and reads the log back", async () => {
    const files = new Map<string, string>([[HUB_ADB_BUILD_COMPLETE, "100 - old"]]);
    const sync = fakeSync(files);
    const connection = {
      adb: { sync: async () => ({ ...sync, dispose: async () => undefined }) },
      serial: "test",
      label: "hub",
      close: vi.fn(),
    };
    const resultPromise = uploadAndBuildViaUsb(
      connection as never,
      [{ path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Auto.java", content: "class Auto {}" }],
      () => undefined,
    );
    // Simulate the hub finishing its compile shortly after the trigger.
    setTimeout(() => {
      files.set(HUB_ADB_BUILD_COMPLETE, `${Date.now()} - build finished`);
      files.set(
        HUB_ADB_BUILD_COMPLETE.replace("buildComplete.txt", "buildLog.txt"),
        "Build successful!",
      );
    }, 30);
    const result = await resultPromise;
    expect(result.pushed).toEqual([
      { path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Auto.java", hubPath: "org/firstinspires/ftc/teamcode/Auto.java" },
    ]);
    expect(files.get(`${HUB_ADB_SRC_ROOT}/org/firstinspires/ftc/teamcode/Auto.java`)).toBe("class Auto {}");
    expect(files.get(HUB_ADB_BUILD_REQUEST)).toMatch(/begin build/);
    expect(result.buildStarted).toBe(true);
    expect(result.buildSuccessful).toBe(true);
    expect(result.log).toMatch(/Build successful/);
  });

  it("skips non-java files without starting a build", async () => {
    const files = new Map<string, string>();
    const sync = fakeSync(files);
    const result = await uploadAndBuildViaUsb(
      {
        adb: { sync: async () => ({ ...sync, dispose: async () => undefined }) },
        serial: "t",
        label: "h",
        close: async () => undefined,
      } as never,
      [{ path: "README.md", content: "# hi" }],
      () => undefined,
    );
    expect(result.pushed).toEqual([]);
    expect(result.buildStarted).toBe(false);
    expect(files.has(HUB_ADB_BUILD_REQUEST)).toBe(false);
  });
});
