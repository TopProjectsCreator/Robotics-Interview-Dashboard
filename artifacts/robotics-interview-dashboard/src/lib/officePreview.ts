import officeParserBundleUrl from "@jose.espana/docstream/dist/officeparser.browser.js?url";
import { resolveFileFormat } from "./fileFormats";

type ParsedOfficeDocument = {
  toMarkdown?: () => string;
  toText?: () => string;
};

type OfficeParserRuntime = {
  parseOffice: (
    file: File | ArrayBuffer,
    options?: { extractAttachments?: boolean; outputErrorToConsole?: boolean; includeRawContent?: boolean },
  ) => Promise<ParsedOfficeDocument>;
};

declare global {
  interface Window {
    officeParser?: OfficeParserRuntime;
  }
}

let parserPromise: Promise<OfficeParserRuntime> | null = null;

function loadOfficeParser(): Promise<OfficeParserRuntime> {
  if (window.officeParser?.parseOffice) return Promise.resolve(window.officeParser);
  if (parserPromise) return parserPromise;

  parserPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = officeParserBundleUrl;
    script.onload = () => {
      const parser = window.officeParser;
      if (parser?.parseOffice) resolve(parser);
      else {
        parserPromise = null;
        reject(new Error("The Office preview parser did not initialize."));
      }
    };
    script.onerror = () => {
      parserPromise = null;
      reject(new Error("The Office preview parser could not be loaded."));
    };

    // The bundled browser parser includes Node stream shims that call
    // process.nextTick. Provide only the browser-safe pieces those shims use.
    const browserGlobal = window as unknown as {
      process?: { env?: Record<string, string>; nextTick?: (callback: () => void) => number };
    };
    browserGlobal.process ??= {
      env: {},
      nextTick: (callback) => window.setTimeout(callback, 0),
    };
    document.head.append(script);
  });
  return parserPromise;
}

/** Read Office/OpenDocument content as safe text; callers render it as text, never HTML. */
export async function parseOfficePreview(blob: Blob, fileName: string): Promise<string> {
  const parser = await loadOfficeParser();
  const file = new File([blob], fileName, { type: blob.type });
  // The browser bundle documents File support, but its current implementation
  // accepts only ArrayBuffer/Buffer. Passing bytes also keeps parsing in the
  // browser's own ArrayBuffer realm for its format detection.
  const parsed = await parser.parseOffice(await file.arrayBuffer(), {
    extractAttachments: false,
    outputErrorToConsole: false,
    includeRawContent: false,
  });
  const content = (parsed.toMarkdown?.() || parsed.toText?.() || "").trim();
  if (!content) throw new Error("This file did not contain readable text.");
  return content.slice(0, 250000);
}

const OFFICE_PREVIEW_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
]);

export type FullFidelityOfficeKind = "pptx" | "presentation" | "word" | "spreadsheet";

/**
 * The single source of truth for which Office formats bypass the lossy text
 * parser in favour of a browser-side full-fidelity renderer.
 *
 * PPTX uses pptx-preview. The legacy/ODF formats use lazily loaded WASM
 * viewers, which need a real browser (workers + WebAssembly); in jsdom/SSR
 * they deliberately stay on the established text fallback so every caller
 * still gets a usable preview. ODS falls through to the existing SheetJS
 * spreadsheet renderer, which shows all sheets and cells as tables.
 */
export function fullFidelityOfficeKind(fileName: string): FullFidelityOfficeKind | null {
  // Every full-fidelity renderer needs a real browser (workers + WASM + full
  // DOM APIs). In jsdom/SSR they would only produce empty containers, so those
  // environments keep the established text preview.
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") return null;
  if (/\.pptx$/i.test(fileName)) return "pptx";
  if (/\.(?:ppt|ppsx|odp)$/i.test(fileName)) return "presentation";
  if (/\.(?:doc|odt)$/i.test(fileName)) return "word";
  if (/\.ods$/i.test(fileName)) return "spreadsheet";
  return null;
}

/** True when the caller should render this file with a full-fidelity viewer. */
export function usesFullFidelityPreview(fileName: string): boolean {
  return fullFidelityOfficeKind(fileName) !== null;
}

export function isOfficePreviewAttachment(fileName: string, contentType = ""): boolean {
  if (/\.docx$/i.test(fileName)) return false; // Keep the established docx-preview renderer for DOCX.
  if (usesFullFidelityPreview(fileName)) return false; // Full-fidelity renderers win over text extraction.
  if (/\.(?:doc|ppt|pptx|odt|ods|odp)$/i.test(fileName)) return true;
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const format = resolveFileFormat(fileName, contentType);
  return OFFICE_PREVIEW_MIME_TYPES.has(mime) && (
    ((mime === "application/vnd.ms-powerpoint" || mime.includes("presentationml.presentation")) && format === "presentation") ||
    (mime.includes("opendocument.spreadsheet") && format === "spreadsheet") ||
    (mime.includes("opendocument.presentation") && format === "presentation") ||
    ((mime.includes("msword") || mime.includes("wordprocessingml") || mime.includes("opendocument.text")) && format === "document")
  );
}

export function isJsonAttachment(fileName: string, contentType: string): boolean {
  if (/\.json$/i.test(fileName)) return true;
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ["application/json", "application/ld+json"].includes(mime) && resolveFileFormat(fileName, null) === null;
}

export function formatJsonPreview(source: string): string {
  const value: unknown = JSON.parse(source);
  return JSON.stringify(value, null, 2);
}
