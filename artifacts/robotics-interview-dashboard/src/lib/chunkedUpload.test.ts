import { beforeEach, describe, expect, it, vi } from "vitest";

const { abortChunkUpload, createChunkUploadUrl, completeChunkUpload } = vi.hoisted(() => ({
  abortChunkUpload: vi.fn(),
  createChunkUploadUrl: vi.fn(),
  completeChunkUpload: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  abortChunkUpload,
  createChunkUploadUrl,
  completeChunkUpload,
}));

import { uploadChunked } from "./chunkedUpload";

describe("chunked upload storage failover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    abortChunkUpload.mockResolvedValue({ ok: true });
  });

  it("restarts a failed primary upload on secondary storage and records that destination", async () => {
    createChunkUploadUrl
      .mockResolvedValueOnce({ signedUrl: "https://primary/upload", storageInstance: "primary" })
      .mockResolvedValueOnce({ signedUrl: "https://secondary/upload", storageInstance: "secondary" });
    completeChunkUpload.mockResolvedValue({ objectPath: "/objects/chunk/secondary/upload-id" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("quota exceeded", { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const path = await uploadChunked(new Blob(["CAD bytes"]), "part.step", "application/step", undefined, "cad");

    expect(path).toBe("/objects/chunk/secondary/upload-id");
    expect(createChunkUploadUrl).toHaveBeenNthCalledWith(1, expect.objectContaining({
      partIndex: 0,
      storageInstance: undefined,
      purpose: "cad",
    }));
    expect(createChunkUploadUrl).toHaveBeenNthCalledWith(2, expect.objectContaining({
      partIndex: 0,
      storageInstance: "secondary",
      purpose: "cad",
    }));
    const primaryUploadId = createChunkUploadUrl.mock.calls[0][0].uploadId;
    const secondaryUploadId = createChunkUploadUrl.mock.calls[1][0].uploadId;
    expect(secondaryUploadId).not.toBe(primaryUploadId);
    expect(abortChunkUpload).toHaveBeenCalledWith({
      uploadId: primaryUploadId,
      totalParts: 1,
      storageInstance: "primary",
    });
    expect(completeChunkUpload).toHaveBeenCalledWith(expect.objectContaining({
      uploadId: secondaryUploadId,
      storageInstance: "secondary",
      purpose: "cad",
    }));
  });

  it("retries a part after a dropped connection instead of restarting the upload", async () => {
    createChunkUploadUrl.mockResolvedValue({
      signedUrl: "https://primary/upload",
      storageInstance: "primary",
    });
    completeChunkUpload.mockResolvedValue({ objectPath: "/objects/chunk/upload-id" });
    const fetchMock = vi.fn()
      // The connection dropped before the bucket answered.
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const path = await uploadChunked(new Blob(["CAD bytes"]), "part.step", "application/step", undefined, "cad");

    expect(path).toBe("/objects/chunk/upload-id");
    // The part was sent twice, and the upload was NOT restarted on the
    // secondary bucket.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(abortChunkUpload).not.toHaveBeenCalled();
    // Both attempts stayed on the primary bucket: the upload was retried in
    // place, not restarted on the secondary.
    expect(createChunkUploadUrl).toHaveBeenCalledTimes(2);
    expect(createChunkUploadUrl).toHaveBeenLastCalledWith(expect.objectContaining({
      storageInstance: "primary",
    }));
    expect(completeChunkUpload).toHaveBeenCalledWith(expect.objectContaining({
      storageInstance: "primary",
    }));
  });
});
