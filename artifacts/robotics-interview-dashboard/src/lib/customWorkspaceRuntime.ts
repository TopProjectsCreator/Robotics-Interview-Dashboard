export type WorkspaceSourceFile = { path: string; content: string };

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'">`;
const BRIDGE = `<script>
(() => {
  let sequence = 0;
  const pending = new Map();
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !event.data || event.data.channel !== "workspace-bridge-result") return;
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    event.data.error ? entry.reject(new Error(event.data.error)) : entry.resolve(event.data.result);
  });
  const call = (method, payload) => new Promise((resolve, reject) => {
    const id = String(++sequence);
    pending.set(id, { resolve, reject });
    window.parent.postMessage({ channel: "workspace-bridge", id, method, payload }, "*");
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("Request timed out")); } }, 15000);
  });
  window.workspaceAPI = Object.freeze({
    data: Object.freeze({
      list: () => call("data.list"),
      create: (record) => call("data.create", { record }),
      update: (id, record) => call("data.update", { id, record }),
      delete: (id) => call("data.delete", { id }),
    }),
    llm: Object.freeze({ ask: (prompt) => call("llm.ask", { prompt }) })
  });
})();
</script>`;

const THEME_TOKENS = `<style>
:root {
  --background: 216 38% 96%; --foreground: 220 25% 16%; --border: 215 25% 86%;
  --card: 0 0% 100%; --card-foreground: 220 25% 16%; --card-border: 215 25% 87%;
  --primary: 190 76% 37%; --primary-foreground: 0 0% 100%; --secondary: 215 26% 91%;
  --secondary-foreground: 220 25% 21%; --muted: 215 26% 92%; --muted-foreground: 216 13% 44%;
  --accent: 42 91% 62%; --accent-foreground: 220 32% 13%; --input: 215 22% 80%; --ring: 190 76% 37%;
  --workspace-navy: #183a4b; --workspace-teal: #16869a; --workspace-yellow: #f8c84a;
  --app-font-sans: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  --app-font-mono: 'DM Mono', ui-monospace, monospace;
}
:root.dark {
  color-scheme: dark;
  --background: 220 32% 7%; --foreground: 210 20% 90%; --border: 215 20% 22%;
  --card: 218 28% 11%; --card-foreground: 210 20% 90%; --card-border: 215 20% 22%;
  --primary: 190 55% 55%; --primary-foreground: 220 32% 8%; --secondary: 215 22% 18%;
  --secondary-foreground: 210 18% 88%; --muted: 215 22% 16%; --muted-foreground: 214 14% 62%;
  --accent: 215 22% 18%; --accent-foreground: 210 20% 90%; --input: 215 20% 26%; --ring: 190 60% 55%;
  --workspace-navy: #e5edf2; --workspace-teal: #6fc3cf; --workspace-yellow: #e8c85a;
}
html, body { min-height: 100%; }
body { margin: 0; background: hsl(var(--background)); color: hsl(var(--foreground)); font-family: var(--app-font-sans); }
</style>`;

function safeSvgDataUrl(svg: string): string | null {
  if (new TextEncoder().encode(svg).byteLength > 120_000) return null;
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

function inlineSvgReferences(html: string, files: Map<string, string>): string {
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

export function sandboxDocument(html: string, darkMode: boolean): string {
  const safeMeta = CSP + BRIDGE + THEME_TOKENS;
  const rootClass = darkMode ? "dark" : "";
  const themedHtml = /<html\b([^>]*)>/i.test(html)
    ? html.replace(/<html\b([^>]*)>/i, (_tag, attrs: string) => {
      const existingClass = attrs.match(/\bclass=(["'])(.*?)\1/i);
      if (existingClass) {
        const retainedClasses = existingClass[2].split(/\s+/).filter((name) => name && name !== "dark");
        if (rootClass) retainedClasses.push(rootClass);
        const classValue = retainedClasses.join(" ");
        return `<html${attrs.replace(existingClass[0], `class="${classValue}"`)}>`;
      }
      return `<html${attrs}${rootClass ? ` class="${rootClass}"` : ""}>`;
    })
    : html;
  if (/<head(?:\s[^>]*)?>/i.test(themedHtml)) return themedHtml.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${safeMeta}`);
  return `<!doctype html><html class="${rootClass}"><head>${safeMeta}</head><body>${themedHtml}</body></html>`;
}

export function compileWorkspaceSourceFiles(sourceFiles: WorkspaceSourceFile[]): string | null {
  const files = new Map(sourceFiles.map((file) => [file.path, file.content]));
  const sourceHtml = files.get("index.html");
  if (sourceHtml === undefined) return null;
  const html = sourceHtml
    .replace(/<link\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (tag, before: string, _quote: string, href: string, after: string) => {
      const css = files.get(href.replace(/^\.\//, ""));
      return css === undefined || !/stylesheet/i.test(`${before}${after}`) ? tag : `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
    })
    .replace(/<script\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (tag, before: string, _quote: string, src: string, after: string) => {
      const js = files.get(src.replace(/^\.\//, ""));
      return js === undefined ? tag : `<script${before}${after}>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
    });
  return inlineSvgReferences(html, files);
}
