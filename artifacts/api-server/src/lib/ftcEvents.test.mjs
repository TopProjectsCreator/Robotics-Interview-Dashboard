import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const {
  clearFtcEventCacheForTests,
  getFtcGlobeData,
  searchFtcEntities,
  getFtcTeamProfile,
  getFtcEventProfile,
} = await import("./ftcEvents.ts");

const originalUsername = process.env.FTC_EVENTS_USERNAME;
const originalKey = process.env.FTC_EVENTS_AUTHORIZATION_KEY;

afterEach(() => {
  clearFtcEventCacheForTests();
  if (originalUsername === undefined) delete process.env.FTC_EVENTS_USERNAME;
  else process.env.FTC_EVENTS_USERNAME = originalUsername;
  if (originalKey === undefined) delete process.env.FTC_EVENTS_AUTHORIZATION_KEY;
  else process.env.FTC_EVENTS_AUTHORIZATION_KEY = originalKey;
});

function withCredentials() {
  process.env.FTC_EVENTS_USERNAME = "test-user";
  process.env.FTC_EVENTS_AUTHORIZATION_KEY = "test-key";
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function waitForSearch(season, query) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await searchFtcEntities(season, query);
    if (result.teamsStatus !== "loading" && result.eventsStatus !== "loading") return result;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error(`FTC search did not finish loading for ${query}`);
}

test("numeric searches request one team and search event details", async (t) => {
  withCredentials();
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: String(url), authorization: options.headers.Authorization });
    if (String(url).includes("/teams?teamNumber=23442")) {
      return response({
        teams: [{
          teamNumber: 23442,
          nameFull: "BioBuzz",
          nameShort: "BioBuzz",
          city: "Redmond",
          stateProv: "Washington",
        }],
        pageTotal: 1,
      });
    }
    if (String(url).endsWith("/2026/events")) {
      return response({
        events: [{
          code: "CAFO",
          name: "Cascade Premier",
          typeName: "Qualifier",
          city: "Redmond",
          stateprov: "Washington",
        }],
      });
    }
    throw new Error(`Unexpected request ${url}`);
  });

  const results = await waitForSearch(2026, "23442");
  assert.equal(results.teams[0].teamNumber, 23442);
  assert.equal(results.teams[0].nameFull, "BioBuzz");
  assert.equal(results.events.length, 0);
  assert.equal(results.teamsStatus, "ready");
  assert.equal(results.eventsStatus, "ready");
  assert.deepEqual(requests.map(request => request.authorization), [
    "Basic " + Buffer.from("test-user:test-key").toString("base64"),
    "Basic " + Buffer.from("test-user:test-key").toString("base64"),
  ]);
});

test("name search loads paged teams once and filters team and event names", async (t) => {
  withCredentials();
  const requests = [];
  t.mock.method(globalThis, "fetch", async url => {
    const href = String(url);
    requests.push(href);
    if (href.includes("/teams?page=1")) {
      return response({
        teams: [{ teamNumber: 11, nameFull: "Cascade Robotics" }],
        pageTotal: 2,
      });
    }
    if (href.includes("/teams?page=2")) {
      return response({
        teams: [{ teamNumber: 22, nameFull: "Cascade Makers" }],
        pageTotal: 2,
      });
    }
    if (href.endsWith("/2026/events")) {
      return response({
        events: [
          { code: "CASC", name: "Cascade Robotics League Meet", typeName: "League Meet" },
          { code: "OTHR", name: "Other Competition" },
        ],
      });
    }
    throw new Error(`Unexpected request ${url}`);
  });

  const first = await waitForSearch(2026, "Cascade");
  const second = await searchFtcEntities(2026, "Cascade");
  assert.deepEqual(first.teams.map(team => team.teamNumber), [11, 22]);
  assert.deepEqual(first.events.map(event => event.code), ["CASC"]);
  assert.deepEqual(second.teams.map(team => team.teamNumber), [11, 22]);
  assert.equal(requests.filter(url => url.includes("/teams?page=")).length, 2);
});

test("stale season results return immediately while the cache refreshes", async (t) => {
  withCredentials();
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  let refreshing = false;
  const refreshRequests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const href = String(url);
    if (refreshing) {
      return await new Promise(resolve => refreshRequests.push({ href, resolve }));
    }
    if (href.endsWith("/2026/teams?page=1")) {
      return response({ teams: [{ teamNumber: 11, nameFull: "Cascade Robotics" }], pageTotal: 1 });
    }
    if (href.endsWith("/2026/events")) {
      return response({ events: [{ code: "CASC", name: "Cascade League Meet" }] });
    }
    throw new Error(`Unexpected request ${href}`);
  });

  const initial = await waitForSearch(2026, "Cascade");
  assert.equal(initial.teams[0].nameFull, "Cascade Robotics");
  assert.equal(initial.events[0].code, "CASC");

  now += 16 * 60 * 1000;
  refreshing = true;
  const stale = await searchFtcEntities(2026, "Cascade");
  assert.equal(stale.teams[0].nameFull, "Cascade Robotics");
  assert.equal(stale.events[0].code, "CASC");
  assert.equal(stale.teamsStatus, "loading");
  assert.equal(stale.eventsStatus, "loading");
  assert.equal(refreshRequests.length, 2);

  for (const request of refreshRequests) {
    if (request.href.includes("/teams?")) {
      request.resolve(response({ teams: [{ teamNumber: 11, nameFull: "Cascade Updated" }], pageTotal: 1 }));
    } else {
      request.resolve(response({ events: [{ code: "UPDT", name: "Cascade Updated Meet" }] }));
    }
  }
  await new Promise(resolve => setTimeout(resolve, 0));

  const refreshed = await waitForSearch(2026, "Cascade");
  assert.equal(refreshed.teams[0].nameFull, "Cascade Updated");
  assert.equal(refreshed.events[0].code, "UPDT");
});

test("cold searches expose matching first-page data while later team pages load", async (t) => {
  withCredentials();
  let resolvePageThree;
  let markPageThreeStarted;
  const pageThreeStarted = new Promise(resolve => { markPageThreeStarted = resolve; });
  const pageThree = new Promise(resolve => { resolvePageThree = resolve; });
  t.mock.method(globalThis, "fetch", async url => {
    const href = String(url);
    if (href.endsWith("/2026/teams?page=1")) {
      return response({
        teams: [{ teamNumber: 11, nameFull: "Cascade Robotics" }],
        pageTotal: 3,
      });
    }
    if (href.endsWith("/2026/teams?page=2")) {
      return response({ teams: [{ teamNumber: 22, nameFull: "Cascade Makers" }], pageTotal: 3 });
    }
    if (href.endsWith("/2026/teams?page=3")) {
      markPageThreeStarted();
      return await pageThree;
    }
    if (href.endsWith("/2026/events")) {
      return response({ events: [{ code: "CASC", name: "Cascade Open" }] });
    }
    throw new Error(`Unexpected request ${href}`);
  });

  const initial = await searchFtcEntities(2026, "Cascade");
  assert.equal(initial.teamsStatus, "loading");
  assert.equal(initial.eventsStatus, "loading");
  await pageThreeStarted;

  let currentPartial = await searchFtcEntities(2026, "Cascade");
  for (let attempt = 0; currentPartial.eventsStatus !== "ready" && attempt < 20; attempt += 1) {
    await new Promise(resolve => setImmediate(resolve));
    currentPartial = await searchFtcEntities(2026, "Cascade");
  }
  assert.deepEqual(currentPartial.teams.map(team => team.teamNumber), [11, 22]);
  assert.deepEqual(currentPartial.events.map(event => event.code), ["CASC"]);
  assert.equal(currentPartial.teamsStatus, "loading");
  assert.equal(currentPartial.eventsStatus, "ready");

  resolvePageThree(response({ teams: [{ teamNumber: 33, nameFull: "Cascade Builders" }], pageTotal: 3 }));
  const complete = await waitForSearch(2026, "Cascade");
  assert.deepEqual(complete.teams.map(team => team.teamNumber), [11, 22, 33]);
  assert.equal(complete.teamsStatus, "ready");
});

test("a failed source reports an error without hiding the source that loaded", async (t) => {
  withCredentials();
  t.mock.method(globalThis, "fetch", async url => {
    const href = String(url);
    if (href.endsWith("/2026/teams?teamNumber=23442")) {
      return response({ teams: [{ teamNumber: 23442, nameFull: "BioBuzz Robotics" }] });
    }
    if (href.endsWith("/2026/events")) return response({ error: "temporary outage" }, 503);
    throw new Error(`Unexpected request ${href}`);
  });

  const result = await waitForSearch(2026, "23442");
  assert.deepEqual(result.teams.map(team => team.teamNumber), [23442]);
  assert.equal(result.teamsStatus, "ready");
  assert.equal(result.eventsStatus, "error");
});

test("team and event detail requests include the requested season", async (t) => {
  withCredentials();
  t.mock.method(globalThis, "fetch", async url => {
    const href = String(url);
    if (href.endsWith("/2025/teams?teamNumber=23442")) {
      return response({ teams: [{ teamNumber: 23442, nameFull: "BioBuzz" }] });
    }
    if (href.endsWith("/2025/events?teamNumber=23442")) {
      return response({ events: [{ code: "CAFO", name: "Cascade Open" }] });
    }
    if (href.endsWith("/2024/events?eventCode=CAFO")) {
      return response({ events: [{ code: "CAFO", name: "Cascade Regional" }] });
    }
    if (href.endsWith("/2024/teams?eventCode=CAFO")) {
      return response({ teams: [{ teamNumber: 23442, nameFull: "BioBuzz" }] });
    }
    throw new Error(`Unexpected request ${url}`);
  });

  const team = await getFtcTeamProfile(2025, 23442);
  const event = await getFtcEventProfile(2024, "CAFO");
  assert.equal(team.team?.nameFull, "BioBuzz");
  assert.equal(team.events[0].season, 2025);
  assert.equal(event.event?.name, "Cascade Regional");
  assert.equal(event.teams[0].teamNumber, 23442);
});

test("public globe data includes every team and event with a mapped location", async (t) => {
  withCredentials();
  t.mock.method(globalThis, "fetch", async url => {
    const href = String(url);
    if (href.endsWith("/2026/teams?page=1")) {
      return response({
        teams: [{
          teamNumber: 23442,
          nameFull: "BioBuzz",
          schoolName: "Pine Lake Middle School",
          city: "Sharon",
          stateProv: "MA",
          country: "USA",
        }],
        pageTotal: 1,
      });
    }
    if (href.endsWith("/2026/events")) {
      return response({
        events: [{
          code: "MASH1",
          name: "Massachusetts FTC Meet",
          city: "Sharon",
          stateprov: "MA",
          country: "USA",
        }],
      });
    }
    throw new Error(`Unexpected request ${href}`);
  });

  const globe = await getFtcGlobeData(2026);
  assert.equal(globe.teamCount, 1);
  assert.equal(globe.eventCount, 1);
  assert.equal(globe.points.length, 2);
  assert.deepEqual(globe.points.map(point => point.kind), ["team", "event"]);
  assert.deepEqual(globe.points.map(point => point.precision), ["city", "city"]);
  assert.deepEqual(globe.points.map(point => [point.latitude, point.longitude]), [
    [42.1237, -71.1787],
    [42.1237, -71.1787],
  ]);
  assert.equal(globe.points[0].teamNumber, 23442);
  assert.equal(globe.points[1].eventCode, "MASH1");
});

test("missing FIRST credentials fail explicitly before making a request", async () => {
  delete process.env.FTC_EVENTS_USERNAME;
  delete process.env.FTC_EVENTS_AUTHORIZATION_KEY;
  await searchFtcEntities(2026, "robotics");
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(searchFtcEntities(2026, "robotics"), /could not be loaded/i);
});
