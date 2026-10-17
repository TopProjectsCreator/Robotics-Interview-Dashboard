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
    resultCount: 1,
  });
  assert.equal(fetchMock.mock.callCount(), 3);
});
