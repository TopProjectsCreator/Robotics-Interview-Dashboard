import assert from "node:assert/strict";
import test from "node:test";

const {
  collectBwtLinkCatalog,
  parseBwtLinkCatalogPage,
} = await import("./bwtlinkCatalog.ts");

const TABS = [
  ["9Others", "Others"],
  ["5Tools", "Tools"],
  ["4Electronics", "Electronics"],
  ["3Screws", "Screws"],
  ["2Transmission", "Transmission"],
  ["1Slides", "Slides"],
];

function listingPage(activeValue, productId) {
  const buttons = TABS.map(([value, label]) =>
    `<button class="tablinks${value === activeValue ? " active" : ""}" onclick="return showMe('${value}')">${label}</button>`,
  ).join("");
  return `<html><form method="post" action="./ProductLists.aspx">
    <input type="hidden" name="__VIEWSTATE" value="state-${activeValue}">
    <input type="hidden" name="__EVENTVALIDATION" value="event-${activeValue}">
    <input type="hidden" name="__VIEWSTATEGENERATOR" value="generator">
    <input type="hidden" name="ctl00$txtTab" id="txtTab" value="">
    <div class="tab">${buttons}</div>
    <a href="/ProductItem.aspx?PID=${productId}"><img src="/Images/${productId}.jpg"></a>
    <a href="/ProductItem.aspx?PID=${productId}">Part &amp; ${activeValue}</a>
    <a href="/ProductItem.aspx?PID=${productId}">More</a>
  </form></html>`;
}

test("BWTLink parser reads public tabs and product data from a listing page", () => {
  const parsed = parseBwtLinkCatalogPage(listingPage("1Slides", 17));
  assert.ok(parsed);
  assert.equal(parsed.tabs.length, 6);
  assert.equal(parsed.activeTab, "1Slides");
  assert.equal(parsed.records.length, 1);
  assert.deepEqual(parsed.records[0], {
    externalKey: "pid-17",
    name: "Part & 1Slides",
    category: "Slides",
    productUrl: "https://bwtlink.com/ProductItem.aspx?PID=17",
    imageUrl: "https://bwtlink.com/Images/17.jpg",
  });
  assert.equal(parsed.hiddenFields.__VIEWSTATE, "state-1Slides");
});

test("BWTLink full sync reads every tab and keeps partial results on one failure", async () => {
  const requests = [];
  const fetchImpl = async (input, init = {}) => {
    const tab = init.method === "POST"
      ? init.body.get("ctl00$txtTab")
      : "1Slides";
    requests.push({ method: init.method ?? "GET", tab });
    if (tab === "4Electronics" && init.method === "POST") {
      return new Response("upstream failure", { status: 503 });
    }
    const productId = 100 + TABS.findIndex(([value]) => value === tab);
    return new Response(listingPage(tab, productId), { status: 200 });
  };
  const result = await collectBwtLinkCatalog({ fetchImpl, requestDelayMs: 0 });
  assert.equal(result.tabsFound, 6);
  assert.equal(result.tabsFetched, 5);
  assert.deepEqual(result.failedTabs, ["4Electronics"]);
  assert.equal(result.records.length, 5);
  assert.equal(requests.length, 6);
});

test("BWTLink full sync rejects incomplete tab inventories", async () => {
  const fetchImpl = async () =>
    new Response(`<form action="./ProductLists.aspx"><button class="tablinks" onclick="return showMe('1Slides')">Slides</button></form>`, {
      status: 200,
    });
  await assert.rejects(
    collectBwtLinkCatalog({ fetchImpl, requestDelayMs: 0 }),
    /at least 6 are required/,
  );
});

test("BWTLink rejects an off-domain redirect before requesting its destination", async () => {
  const requests = [];
  const fetchImpl = async (input) => {
    requests.push(String(input));
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/internal" },
    });
  };
  await assert.rejects(
    collectBwtLinkCatalog({ fetchImpl, requestDelayMs: 0 }),
    /official HTTPS domain/,
  );
  assert.deepEqual(requests, ["https://bwtlink.com/ProductLists.aspx"]);
});
