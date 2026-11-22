import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { teamsTable, DEFAULT_TEAM_ID, normalizeTeamName } from "../../../../lib/db/src/schema/teams.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        specifier.startsWith(".") &&
        !specifier.endsWith(".ts") &&
        !specifier.endsWith(".js")
      ) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const productUrl = "https://www.andymark.com/products/shaft-collar";

function exaResponse(text) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: "parts-test",
    result: {
      isError: false,
      content: text === null ? [] : [{ type: "text", text }],
    },
  }), { headers: { "content-type": "application/json" } });
}

function tavilyResponse(results) {
  return new Response(JSON.stringify({ results }), {
    headers: { "content-type": "application/json" },
  });
}

function productMarkup() {
  return `<meta property="og:type" content="product"><script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "8 mm Shaft Collar",
    sku: "COLLAR-8",
  })}</script>`;
}

async function runSearch(t, fetcher, vendorKey = "andymark") {
  const fetchMock = mock.method(globalThis, "fetch", fetcher);
  t.after(() => mock.restoreAll());
  const [{ searchPublicCatalog }, { VENDORS, vendorByKey }] = await Promise.all([
    import("../routes/parts.ts"),
    import("../lib/partsVendors.ts"),
  ]);
  const results = [];
  let completion = null;
  const vendor = vendorKey ? vendorByKey.get(vendorKey) : undefined;
  await searchPublicCatalog("8 mm shaft collar", vendor, {
    maxCandidatesPerVendor: 40,
    includePartialDetails: true,
    onResult: (result) => results.push(result),
    onComplete: (summary) => {
      completion = summary;
    },
  });
  return { results, completion, fetchMock, vendors: VENDORS };
}

test("verified supplier results arrive before other providers finish and report partial failure", async (t) => {
  mock.module("@workspace/db", {
    namedExports: {
      pool: {},
      db: {},
      primaryDb: {},
      primaryPool: {},
      interviewerAccountsTable: {},
      revokedSessionsTable: {},
      teamsTable,
      DEFAULT_TEAM_ID,
      normalizeTeamName,
      runWithInstance: (_instance, fn) => fn(),
      currentInstance: () => "primary",
      enterInstance: () => {},
      secondaryDb: () => null,
      secondaryPool: () => null,
      hasSecondary: () => false,
    },
  });

  const exaResponse = {
    jsonrpc: "2.0",
    id: "parts-test",
    result: {
      isError: false,
      content: [{
        type: "text",
        text: [
          "Title: 8 mm Shaft Collar",
          "URL: https://www.andymark.com/products/shaft-collar",
          "Highlights:",
          "An official 8 mm shaft collar product.",
          "---",
          "Title: 8 mm Shaft Collar",
          "URL: https://www.andymark.com/products/shaft-collar",
          "Highlights:",
          "An official 8 mm shaft collar product.",
        ].join("\n"),
      }],
    },
  };
  const productMarkup = `<meta property="og:type" content="product"><script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "8 mm Shaft Collar",
    sku: "COLLAR-8",
  })}</script>`;
  const slowProvider = deferred();
  const slowProviderStarted = deferred();
  let productFetchCount = 0;

  const fetchMock = mock.method(globalThis, "fetch", async (input) => {
    const url = String(input);
    if (url.includes("mcp.exa.ai")) {
      return new Response(JSON.stringify(exaResponse), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("api.tavily.com")) {
      slowProviderStarted.resolve();
      return slowProvider.promise;
    }
    if (url === "https://www.andymark.com/products/shaft-collar") {
      productFetchCount += 1;
      return new Response(productMarkup, {
        headers: { "content-type": "text/html" },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  t.after(() => mock.restoreAll());

  const [{ searchPublicCatalog }, { vendorByKey }] = await Promise.all([
    import("../routes/parts.ts"),
    import("../lib/partsVendors.ts"),
  ]);
  const delivered = deferred();
  let completion = null;
  const searchPromise = searchPublicCatalog(
    "8 mm shaft collar",
    vendorByKey.get("andymark"),
    {
      maxCandidatesPerVendor: 40,
      includePartialDetails: true,
      onResult: (result) => delivered.resolve(result),
      onComplete: (summary) => {
        completion = summary;
      },
    },
  );

  await slowProviderStarted.promise;
  const firstResult = await Promise.race([
    delivered.promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("No early product result")), 5000)),
  ]);
  assert.equal(firstResult.title, "8 mm Shaft Collar");
  assert.equal(firstResult.sku, "COLLAR-8");
  assert.equal(completion, null, "completion must wait until the slower provider settles");
  assert.equal(productFetchCount, 1, "duplicate provider candidates are only enriched once");

  slowProvider.resolve(new Response("provider unavailable", { status: 503 }));
  const results = await searchPromise;
  assert.equal(results.length, 1);
  assert.deepEqual(completion, {
    providerCount: 2,
    failedProviderCount: 1,
    providerFailures: [{
      provider: "tavily",
      category: "upstream_http",
      statusCode: 503,
      count: 1,
    }],
    resultCount: 1,
  });
  assert.equal(fetchMock.mock.callCount(), 3);
});

test("Tavily results survive an Exa HTTP failure and identify the failed backend", async (t) => {
  const { results, completion } = await runSearch(t, async (input) => {
    const url = String(input);
    if (url.includes("api.tavily.com")) {
      return tavilyResponse([{
        title: "8 mm Shaft Collar",
        url: productUrl,
        content: "An official 8 mm shaft collar product.",
      }]);
    }
    if (url.includes("mcp.exa.ai")) return new Response("unavailable", { status: 502 });
    if (url === productUrl) return new Response(productMarkup(), {
      headers: { "content-type": "text/html" },
    });
    throw new Error("Unexpected request");
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].sku, "COLLAR-8");
  assert.deepEqual(completion, {
    providerCount: 2,
    failedProviderCount: 1,
    providerFailures: [{
      provider: "exa",
      category: "upstream_http",
      statusCode: 502,
      count: 1,
    }],
    resultCount: 1,
  });
});

test("all-provider failures are counted by request with safe provider categories", async (t) => {
  const { results, completion } = await runSearch(t, async (input) => {
    const url = String(input);
    if (url.includes("api.tavily.com")) {
      const timeout = new Error("internal timeout detail");
      timeout.name = "TimeoutError";
      throw timeout;
    }
    if (url.includes("mcp.exa.ai")) throw new TypeError("internal network detail");
    throw new Error("Unexpected request");
  });

  assert.deepEqual(results, []);
  assert.equal(completion.providerCount, 2);
  assert.equal(completion.failedProviderCount, 2);
  assert.deepEqual(
    [...completion.providerFailures].sort((left, right) => left.provider.localeCompare(right.provider)),
    [
      { provider: "exa", category: "network", count: 1 },
      { provider: "tavily", category: "timeout", count: 1 },
    ],
  );
  assert.doesNotMatch(JSON.stringify(completion), /internal timeout detail|internal network detail/);
});

test("malformed Exa and Tavily payloads are reported as response failures", async (t) => {
  const { results, completion } = await runSearch(t, async (input) => {
    const url = String(input);
    if (url.includes("api.tavily.com")) return tavilyResponse({});
    if (url.includes("mcp.exa.ai")) {
      return new Response("not-json", {
        headers: { "content-type": "text/event-stream" },
      });
    }
    throw new Error("Unexpected request");
  });

  assert.deepEqual(results, []);
  assert.equal(completion.providerCount, 2);
  assert.equal(completion.failedProviderCount, 2);
  assert.deepEqual(
    [...completion.providerFailures].sort((left, right) => left.provider.localeCompare(right.provider)),
    [
      { provider: "exa", category: "invalid_response", count: 1 },
      { provider: "tavily", category: "invalid_response", count: 1 },
    ],
  );
});

test("valid empty results from both live backends are not failures", async (t) => {
  const { results, completion } = await runSearch(t, async (input) => {
    const url = String(input);
    if (url.includes("api.tavily.com")) return tavilyResponse([]);
    if (url.includes("mcp.exa.ai")) return exaResponse(null);
    throw new Error("Unexpected request");
  });

  assert.deepEqual(results, []);
  assert.deepEqual(completion, {
    providerCount: 2,
    failedProviderCount: 0,
    providerFailures: [],
    resultCount: 0,
  });
});

test("all-supplier searches batch Tavily requests instead of making one per vendor", async (t) => {
  const { completion, fetchMock, vendors } = await runSearch(t, async (input) => {
    const url = String(input);
    if (url.includes("api.tavily.com")) return tavilyResponse([]);
    if (url.includes("mcp.exa.ai")) return exaResponse(null);
    throw new Error("Unexpected request");
  }, null);
  const vendorGroups = Math.ceil(vendors.length / 4);
  const tavilyVendors = vendors.filter((vendor) => vendor.publicProductFeedUrl);
  const tavilyGroups = Math.ceil(tavilyVendors.length / 4);

  assert.equal(completion.providerCount, vendorGroups + tavilyGroups);
  assert.equal(completion.failedProviderCount, 0);
  assert.equal(fetchMock.mock.callCount(), completion.providerCount);
  assert.ok(tavilyGroups < tavilyVendors.length);
});
