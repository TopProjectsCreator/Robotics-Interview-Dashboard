import { afterEach, describe, expect, it, vi } from "vitest";

import {
  chatAttachmentObjectIds,
  cleanupChatMessageAttachments,
} from "./chat-attachment-cleanup";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat attachment cleanup", () => {
  it("finds unique attachment paths and ignores ordinary text", () => {
    expect(chatAttachmentObjectIds(
      "See [brief.pdf](/api/storage/objects/upload-12345678) and ![preview](/api/storage/objects/upload-12345678).",
    )).toEqual(["upload-12345678"]);
    expect(chatAttachmentObjectIds("No files attached.")).toEqual([]);
  });

  it("does not call storage when the deleted message has no attachment paths", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await cleanupChatMessageAttachments("Message without attachments")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes attachment objects through the credentialed storage endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await cleanupChatMessageAttachments(
      "[brief.pdf](/api/storage/objects/upload-12345678)",
    )).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.BASE_URL}api/storage/objects/upload-12345678`,
      { method: "DELETE", credentials: "include" },
    );
  });

  it("reports a cleanup failure without treating a missing object as an error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await cleanupChatMessageAttachments(
      "[one](/api/storage/objects/upload-12345678) [two](/api/storage/objects/upload-87654321)",
    )).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});