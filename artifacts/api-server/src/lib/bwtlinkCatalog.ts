const BWTLINK_DOMAIN = "bwtlink.com";
const BWTLINK_LIST_URL = "https://bwtlink.com/ProductLists.aspx";
const BWTLINK_MIN_TABS = 6;

type BwtLinkTab = {
  value: string;
  label: string;
};

export type BwtLinkCatalogRecord = {
  externalKey: string;
  name: string;
  category: string;
  productUrl: string;
  imageUrl: string | null;
};

export type BwtLinkCatalogResult = {
  records: BwtLinkCatalogRecord[];
  tabsFound: number;
  tabsFetched: number;
  failedTabs: string[];
};

type ParsedBwtLinkPage = {
  tabs: BwtLinkTab[];
  activeTab: string | null;
  hiddenFields: Record<string, string>;
  records: BwtLinkCatalogRecord[];
};

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_match, code: string) => {
      const radix = code.toLowerCase().startsWith("x") ? 16 : 10;
      const digits = radix === 16 ? code.slice(1) : code;
      const point = Number.parseInt(digits, radix);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : " ";
    });
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  const body = tag.replace(/^<\/?\w+/, "").replace(/\/?>\s*$/, "");
  const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of body.matchAll(pattern)) {
    const name = (match[1] ?? "").toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name) result.set(name, decodeEntities(value));
  }
  return result;
}

function parseTabs(html: string): { tabs: BwtLinkTab[]; activeTab: string | null } {
  const tabs = new Map<string, BwtLinkTab>();
  let activeTab: string | null = null;
  for (const match of html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi)) {
    const tag = match[0];
    const openingTag = tag.slice(0, tag.indexOf(">") + 1);
    const attrs = attributes(openingTag);
    const onClick = attrs.get("onclick") ?? "";
    const value = /showMe\(['"]([^'"]+)['"]\)/i.exec(onClick)?.[1];
    const label = stripTags(tag.slice(openingTag.length, tag.lastIndexOf("</button>")));
    if (!value || !label) continue;
    tabs.set(value, { value, label });
    if (/\bactive\b/i.test(attrs.get("class") ?? "")) activeTab = value;
  }
  return { tabs: [...tabs.values()], activeTab };
}

function parseHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.get("type") ?? "").toLowerCase() !== "hidden") continue;
    const name = attrs.get("name");
    const value = attrs.get("value");
    if (name && value !== undefined) fields[name] = value;
  }
  return fields;
}

function parseProductRecords(html: string, category: string): BwtLinkCatalogRecord[] {
  const records = new Map<string, BwtLinkCatalogRecord>();
  for (const match of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const anchor = match[0];
    const attrs = attributes(anchor.slice(0, anchor.indexOf(">") + 1));
    const href = attrs.get("href");
    if (!href) continue;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(href, BWTLINK_LIST_URL);
    } catch {
      continue;
    }
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname.toLowerCase().replace(/^www\./, "") !== BWTLINK_DOMAIN ||
      parsedUrl.pathname.toLowerCase() !== "/productitem.aspx"
    ) continue;
    const pid = parsedUrl.searchParams.get("PID");
    if (!pid || !/^\d+$/.test(pid)) continue;

    const externalKey = `pid-${pid}`;
    const current = records.get(externalKey);
    const imageSource = /<img\b[^>]*>/i.exec(anchor)?.[0];
    const imagePath = imageSource ? attributes(imageSource).get("src") : null;
    let imageUrl = current?.imageUrl ?? null;
    if (imagePath) {
      try {
        const parsedImage = new URL(imagePath, BWTLINK_LIST_URL);
        if (
          parsedImage.protocol === "https:" &&
          parsedImage.hostname.toLowerCase().replace(/^www\./, "") === BWTLINK_DOMAIN
        ) imageUrl = parsedImage.toString();
      } catch {
        // Keep the prior official image value when a malformed path appears.
      }
    }
    const text = stripTags(anchor.slice(anchor.indexOf(">") + 1, anchor.lastIndexOf("</a>")));
    const name = text && !/^more$/i.test(text) ? text : current?.name;
    if (!name) {
      if (imageUrl && !current) {
        records.set(externalKey, {
          externalKey,
          name: "",
          category,
          productUrl: `https://bwtlink.com/ProductItem.aspx?PID=${pid}`,
          imageUrl,
        });
      } else if (current && imageUrl && !current.imageUrl) {
        current.imageUrl = imageUrl;
      }
      continue;
    }
    records.set(externalKey, {
      externalKey,
      name: name.slice(0, 250),
      category,
      productUrl: `https://bwtlink.com/ProductItem.aspx?PID=${pid}`,
      imageUrl: imageUrl ?? current?.imageUrl ?? null,
    });
  }
  return [...records.values()].filter((record) => record.name.length > 0);
}

export function parseBwtLinkCatalogPage(html: string): ParsedBwtLinkPage | null {
  if (!/<form\b[^>]*action=["'][^"']*ProductLists\.aspx/i.test(html)) return null;
  const { tabs, activeTab } = parseTabs(html);
  if (tabs.length === 0) return null;
  return {
    tabs,
    activeTab,
    hiddenFields: parseHiddenFields(html),
    records: parseProductRecords(
      html,
      tabs.find((tab) => tab.value === activeTab)?.label ?? "",
    ),
  };
}

function collectResponseCookies(response: Response, jar: Map<string, string>): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  for (const value of values) {
    const match = /(?:^|,\s*)([^=;,\s]+)=([^;]*)/.exec(value);
    if (!match?.[1]) continue;
    if (!match[2]) jar.delete(match[1]);
    else jar.set(match[1], match[2]);
  }
}

async function requestHtml(
  url: string,
  fetchImpl: typeof fetch,
  cookieJar: Map<string, string>,
  body?: URLSearchParams,
): Promise<string> {
  let requested = new URL(url);
  let method = body ? "POST" : "GET";
  let requestBody = body;
  const headers = new Headers({
    accept: "text/html,application/xhtml+xml",
    ...(body ? { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
    referer: BWTLINK_LIST_URL,
  });
  if (cookieJar.size > 0) {
    headers.set("cookie", [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; "));
  }
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    if (
      requested.protocol !== "https:" ||
      requested.username ||
      requested.password ||
      requested.hostname.toLowerCase().replace(/^www\./, "") !== BWTLINK_DOMAIN
    ) {
      throw new Error("BWTLink catalog requests must stay on its official HTTPS domain.");
    }
    const response = await fetchImpl(requested, {
      method,
      headers,
      body: requestBody,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    collectResponseCookies(response, cookieJar);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("BWTLink catalog returned a redirect without a destination.");
      requested = new URL(location, requested);
      // Match fetch's POST redirect behavior, but validate the destination
      // before making the next request so cookies and form data stay private.
      if (
        ((response.status === 301 || response.status === 302) && method === "POST") ||
        (response.status === 303 && method !== "HEAD")
      ) {
        method = "GET";
        requestBody = undefined;
        headers.delete("content-type");
      }
      continue;
    }
    if (!response.ok) throw new Error(`BWTLink catalog returned HTTP ${response.status}.`);
    const finalUrl = response.url ? new URL(response.url) : requested;
    if (
      finalUrl.protocol !== "https:" ||
      finalUrl.hostname.toLowerCase().replace(/^www\./, "") !== BWTLINK_DOMAIN
    ) {
      throw new Error("BWTLink catalog redirected outside its official domain.");
    }
    return response.text();
  }
  throw new Error("BWTLink catalog exceeded its redirect limit.");
}

function pause(milliseconds: number): Promise<void> {
  return milliseconds <= 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Reads the six public catalog tabs through the same read-only form used by
 * BWTLink's product listing page. No product detail pages or search providers
 * are needed to enumerate its current catalog.
 */
export async function collectBwtLinkCatalog(options: {
  fetchImpl?: typeof fetch;
  requestDelayMs?: number;
} = {}): Promise<BwtLinkCatalogResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestDelayMs = options.requestDelayMs ?? 1_000;
  const cookieJar = new Map<string, string>();
  let currentHtml = await requestHtml(BWTLINK_LIST_URL, fetchImpl, cookieJar);
  const initialPage = parseBwtLinkCatalogPage(currentHtml);
  if (!initialPage || initialPage.tabs.length < BWTLINK_MIN_TABS) {
    throw new Error(`BWTLink exposed ${initialPage?.tabs.length ?? 0} catalog tabs; at least ${BWTLINK_MIN_TABS} are required.`);
  }

  let page = initialPage;
  const tabs = initialPage.tabs;
  const orderedTabs = initialPage.activeTab
    ? [
        ...tabs.filter((tab) => tab.value === initialPage.activeTab),
        ...tabs.filter((tab) => tab.value !== initialPage.activeTab),
      ]
    : tabs;
  const records = new Map<string, BwtLinkCatalogRecord>();
  const failedTabs: string[] = [];
  let tabsFetched = 0;
  for (const tab of orderedTabs) {
    if (page.activeTab !== tab.value) {
      await pause(requestDelayMs);
      const body = new URLSearchParams(page.hiddenFields);
      body.set("ctl00$txtTab", tab.value);
      try {
        const nextHtml = await requestHtml(BWTLINK_LIST_URL, fetchImpl, cookieJar, body);
        const nextPage = parseBwtLinkCatalogPage(nextHtml);
        if (!nextPage || nextPage.activeTab !== tab.value) {
          failedTabs.push(tab.value);
          continue;
        }
        currentHtml = nextHtml;
        page = nextPage;
      } catch {
        failedTabs.push(tab.value);
        continue;
      }
    }
    if (page.activeTab !== tab.value) {
      failedTabs.push(tab.value);
      continue;
    }
    tabsFetched += 1;
    for (const record of parseProductRecords(currentHtml, tab.label)) {
      records.set(record.externalKey, record);
    }
  }

  return {
    records: [...records.values()],
    tabsFound: tabs.length,
    tabsFetched,
    failedTabs,
  };
}
