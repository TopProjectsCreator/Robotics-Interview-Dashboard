import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumePartsCatalogSearchStream,
  searchPartsCatalogStream,
} from "@workspace/api-client-react";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Parts supplier search stream client", () => {
  it("delivers a complete result line before the completion event is sent", async () => {
    const encoder = new TextEncoder();
    let finishStream!: () => void;
    const resultEvent = {
      type: "result",
      result: {
        vendorKey: "andymark",
        vendorName: "AndyMark",
        title: "Early result",
        url: "https://www.andymark.com/products/early-result",
        description: "Verified product.",
        sku: null,
        imageUrl: null,
        price: null,
        currency: null,
        priceIsStartingAt: false,
        inStock: true,
      },
    };
    const completionEvent = {
      type: "complete",
      status: "available",
      providerCount: 2,
      failedProviderCount: 0,
      resultCount: 1,
    };
    const encodedResult = JSON.stringify(resultEvent) + "\n";
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(encodedResult.slice(0, 17)));
        controller.enqueue(encoder.encode(encodedResult.slice(17)));
        finishStream = () => {
          controller.enqueue(encoder.encode(`${JSON.stringify(completionEvent)}\n`));
          controller.close();
        };
      },
    });
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _options?: RequestInit) =>
      new Response(stream, {
        headers: { "content-type": "application/x-ndjson; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const received: string[] = [];
    let signalResult!: () => void;
    const resultDelivered = new Promise<void>((resolve) => {
      signalResult = resolve;
    });
    let signalComplete!: () => void;
    const completionDelivered = new Promise<void>((resolve) => {
      signalComplete = resolve;
    });

    const consuming = consumePartsCatalogSearchStream({ q: "early result" }, (event) => {
      received.push(event.type);
      if (event.type === "result") signalResult();
      if (event.type === "complete") signalComplete();
    });

    await resultDelivered;
    expect(received).toEqual(["result"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/parts/catalog/search/stream?q=early+result",
      expect.objectContaining({ credentials: "include" }),
    );

    finishStream();
    await completionDelivered;
    await consuming;
    expect(received).toEqual(["result", "complete"]);
  });

  it("keeps the generated endpoint response readable instead of buffering it as text", async () => {
    const fetchSpy = vi.fn(async () => new Response('{"type":"complete"}\n', {
      headers: { "content-type": "application/x-ndjson; charset=utf-8" },
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await searchPartsCatalogStream({ q: "stream test" });
    expect(response).toBeInstanceOf(Response);
    expect(await response.text()).toBe('{"type":"complete"}\n');
    await searchPartsCatalogStream({ q: "stream test" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
