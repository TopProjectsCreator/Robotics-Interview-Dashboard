export type CustomWorkspaceAssetFile = { path: string; content: string };

function safeSvgDataUrl(svg: string): string | null {
  if (Buffer.byteLength(svg, "utf8") > 120_000) return null;
  if (!/<svg\b/i.test(svg) || !/<\/svg\s*>/i.test(svg)) return null;
  if (/<\s*(?:script|foreignObject|iframe|object|embed)\b/i.test(svg)) return null;
  if (/\bon[a-z][\w:-]*\s*=/i.test(svg) || /@import\b/i.test(svg)) return null;
  if (/(?:href|xlink:href)\s*=\s*["']\s*(?!#)[^"']+/i.test(svg)) return null;
  if (/url\(\s*["']?\s*(?!#)/i.test(svg)) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function localSvgDataUrl(reference: string, files: Map<string, string>): string | null {
  const fragmentMatch = reference.match(/(#[A-Za-z_][\w:.-]*)$/);
  const fragment = fragmentMatch?.[1] ?? "";
  const path = (fragment ? reference.slice(0, -fragment.length) : reference).replace(/^\.\//, "");
  if (
    !path.toLowerCase().endsWith(".svg") ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes(":") ||
    /[?#]/.test(path)
  ) return null;
  const source = files.get(path);
  const dataUrl = source === undefined ? null : safeSvgDataUrl(source);
  return dataUrl ? `${dataUrl}${fragment}` : null;
}

export function inlineLocalSvgAssets(html: string, sourceFiles: CustomWorkspaceAssetFile[]): string {
  const files = new Map(sourceFiles.map((file) => [file.path, file.content]));
  const inlineAttributes = (tag: string) =>
    tag.replace(/\b(src|href|xlink:href)\s*=\s*(["'])([^"']+)\2/gi, (attribute, name: string, quote: string, reference: string) => {
      const dataUrl = localSvgDataUrl(reference, files);
      return dataUrl ? `${name}=${quote}${dataUrl}${quote}` : attribute;
    });

  return html
    .replace(/<(?:img|image)\b[^>]*>/gi, inlineAttributes)
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, (_tag, attributes: string, css: string) => (
      `<style${attributes}>${css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (url, quote: string, reference: string) => {
        const dataUrl = localSvgDataUrl(reference.trim(), files);
        return dataUrl ? `url(${quote}${dataUrl}${quote})` : url;
      })}</style>`
    ))
    .replace(/\bstyle=(["'])([\s\S]*?)\1/gi, (_attribute, quote: string, css: string) => (
      `style=${quote}${css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (url, urlQuote: string, reference: string) => {
        const dataUrl = localSvgDataUrl(reference.trim(), files);
        return dataUrl ? `url(${urlQuote}${dataUrl}${urlQuote})` : url;
      })}${quote}`
    ));
}
