import { useEffect, useRef } from "react";

const ICON_SELECTOR = 'link[rel~="icon"]';
// Badge geometry matches the 180×180 viewBox of public/favicon.svg. A white
// ring separates the red dot from the yellow icon at 16 px.
const UNREAD_DOT_MARKUP =
  '<circle cx="143" cy="143" r="29" fill="#ef4444" stroke="#ffffff" stroke-width="13"/>';

function findIconLink(): HTMLLinkElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector<HTMLLinkElement>(ICON_SELECTOR);
  if (existing) return existing;
  const link = document.createElement("link");
  link.rel = "icon";
  document.head.appendChild(link);
  return link;
}

async function buildDottedIconFromSvg(baseHref: string): Promise<string> {
  const url = new URL(baseHref, document.baseURI);
  const response = await fetch(url.href);
  if (!response.ok) throw new Error(`favicon fetch failed with ${response.status}`);
  const svg = await response.text();
  const end = svg.lastIndexOf("</svg>");
  if (end === -1) throw new Error("favicon is not an SVG document");
  const dotted = `${svg.slice(0, end)}${UNREAD_DOT_MARKUP}${svg.slice(end)}`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dotted)}`;
}

// Fallback for when the SVG source cannot be fetched (e.g. offline with an
// uncached icon): draw the base icon onto a canvas and stamp the red dot on.
function buildDottedIconFromCanvas(baseHref: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const size = 180;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 2d context unavailable"));
        return;
      }
      ctx.drawImage(image, 0, 0, size, size);
      ctx.beginPath();
      ctx.arc(143, 143, 29, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.lineWidth = 13;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("favicon image failed to load"));
    image.src = baseHref;
  });
}

async function buildDottedIcon(baseHref: string): Promise<string> {
  try {
    return await buildDottedIconFromSvg(baseHref);
  } catch {
    return buildDottedIconFromCanvas(baseHref);
  }
}

// Cache the generated badge across mounts; reset on failure so a transient
// network error does not permanently suppress the dot.
let dottedIconPromise: Promise<string> | null = null;
function getDottedIcon(baseHref: string): Promise<string> {
  if (!dottedIconPromise) {
    dottedIconPromise = buildDottedIcon(baseHref).catch((error: unknown) => {
      dottedIconPromise = null;
      throw error;
    });
  }
  return dottedIconPromise;
}

/**
 * Overlays a red unread dot on the bottom-right of the site favicon while
 * `hasUnread` is true, and restores the original favicon otherwise. The base
 * icon is read from the page's existing <link rel="icon">, so a team or brand
 * swap of the static favicon carries through automatically.
 */
export function useFaviconUnreadDot(hasUnread: boolean): void {
  const originalRef = useRef<{ href: string; type: string | null } | null>(null);

  useEffect(() => {
    const link = findIconLink();
    if (!link) return;
    if (!originalRef.current) {
      originalRef.current = {
        href: link.getAttribute("href") ?? "/favicon.svg",
        type: link.getAttribute("type"),
      };
    }
    const original = originalRef.current;

    if (!hasUnread) {
      link.setAttribute("href", original.href);
      if (original.type === null) link.removeAttribute("type");
      else link.setAttribute("type", original.type);
      return;
    }

    let cancelled = false;
    void getDottedIcon(original.href)
      .then((dotted) => {
        if (cancelled) return;
        link.setAttribute("type", dotted.startsWith("data:image/png") ? "image/png" : "image/svg+xml");
        link.setAttribute("href", dotted);
      })
      .catch(() => {
        // Favicon is best-effort; leave the base icon in place.
      });
    return () => {
      cancelled = true;
    };
  }, [hasUnread]);

  // Restore the base favicon when the hosting shell unmounts (e.g. sign-out).
  useEffect(
    () => () => {
      const link = findIconLink();
      const original = originalRef.current;
      if (!link || !original) return;
      link.setAttribute("href", original.href);
      if (original.type === null) link.removeAttribute("type");
      else link.setAttribute("type", original.type);
    },
    [],
  );
}
