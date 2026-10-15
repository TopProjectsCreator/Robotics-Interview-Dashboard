import { beforeEach, describe, expect, it, vi } from "vitest";

const { createChunkUploadUrl, completeChunkUpload } = vi.hoisted(() => ({
  createChunkUploadUrl: vi.fn(),
  completeChunkUpload: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  createChunkUploadUrl,
  completeChunkUpload,
}));

import { uploadChunked } from "./chunkedUpload";

describe("chunked upload storage failover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const path = await uploadChunked(new Blob(["CAD bytes"]), "part.step", "application/step");

    expect(path).toBe("/objects/chunk/secondary/upload-id");
    expect(createChunkUploadUrl).toHaveBeenNthCalledWith(1, expect.objectContaining({
      partIndex: 0,
      storageInstance: undefined,
    }));
    expect(createChunkUploadUrl).toHaveBeenNthCalledWith(2, expect.objectContaining({
      partIndex: 0,
      storageInstance: "secondary",
    }));
    const primaryUploadId = createChunkUploadUrl.mock.calls[0][0].uploadId;
    const secondaryUploadId = createChunkUploadUrl.mock.calls[1][0].uploadId;
    expect(secondaryUploadId).not.toBe(primaryUploadId);
    expect(completeChunkUpload).toHaveBeenCalledWith(expect.objectContaining({
      uploadId: secondaryUploadId,
      storageInstance: "secondary",
    }));
  });
});
