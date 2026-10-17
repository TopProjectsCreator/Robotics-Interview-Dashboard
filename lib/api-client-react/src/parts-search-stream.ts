import {
  getSearchPartsCatalogStreamUrl,
} from "./generated/api";
import type {
  PartsCatalogSearchStreamEvent,
  SearchPartsCatalogStreamParams,
} from "./generated/api.schemas";
import { customFetch } from "./custom-fetch";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStreamEvent(line: string): PartsCatalogSearchStreamEvent {
  const event: unknown = JSON.parse(line);
  if (
    !isRecord(event) ||
    (event.type !== "catalog" && event.type !== "result" && event.type !== "complete")
  ) {
    throw new TypeError("Supplier search returned an invalid stream event.");
  }
  if (
    event.type === "catalog" &&
    (typeof event.query !== "string" ||
      !Array.isArray(event.catalogItems) ||
      !Number.isInteger(event.catalogTotal) ||
      !Number.isInteger(event.catalogOffset) ||
      !Number.isInteger(event.catalogLimit))
  ) {
    throw new TypeError("Supplier search returned an invalid catalog event.");
  }
  if (event.type === "result") {
    const result = event.result;
    if (
      !isRecord(result) ||
      typeof result.vendorKey !== "string" ||
      typeof result.vendorName !== "string" ||
      typeof result.title !== "string" ||
      typeof result.url !== "string" ||
      typeof result.description !== "string" ||
      (result.sku !== null && typeof result.sku !== "string") ||
      (result.imageUrl !== null && typeof result.imageUrl !== "string") ||
      (result.price !== null && typeof result.price !== "string") ||
      (result.currency !== null && typeof result.currency !== "string") ||
      typeof result.priceIsStartingAt !== "boolean" ||
      typeof result.inStock !== "boolean"
    ) {
      throw new TypeError("Supplier search returned an invalid product result.");
    }
  }
  if (
    event.type === "complete" &&
    ((event.status !== "available" && event.status !== "partial" && event.status !== "unavailable") ||
      !Number.isInteger(event.providerCount) ||
      !Number.isInteger(event.failedProviderCount) ||
      !Number.isInteger(event.resultCount))
  ) {
    throw new TypeError("Supplier search returned an invalid completion event.");
  }
  return event as unknown as PartsCatalogSearchStreamEvent;
}

/**
 * Reads newline-delimited supplier-search events and awaits each consumer
 * callback before continuing. Verified results can therefore render while
 * later provider requests are still in progress.
 */
export async function consumePartsCatalogSearchStream(
  params: SearchPartsCatalogStreamParams,
  onEvent: (event: PartsCatalogSearchStreamEvent) => void | Promise<void>,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const stream = await customFetch<ReadableStream<Uint8Array>>(
    getSearchPartsCatalogStreamUrl(params),
    {
      method: "GET",
      signal: options.signal,
      responseType: "stream",
      headers: { accept: "application/x-ndjson" },
    },
  );
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  const deliverLines = async (flush: boolean) => {
    const lines = pending.split(/\r?\n/);
    pending = flush ? "" : lines.pop() ?? "";
    if (flush && lines.at(-1) === "") lines.pop();
    for (const line of lines) {
      if (line.trim()) await onEvent(parseStreamEvent(line));
    }
    if (flush && pending.trim()) {
      const finalLine = pending;
      pending = "";
      await onEvent(parseStreamEvent(finalLine));
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      await deliverLines(false);
    }
    pending += decoder.decode();
    await deliverLines(true);
  } finally {
    reader.releaseLock();
  }
}
