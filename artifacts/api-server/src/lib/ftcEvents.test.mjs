import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const {
  clearFtcEventCacheForTests,
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

  const results = await searchFtcEntities(2026, "23442");
  assert.equal(results.teams[0].teamNumber, 23442);
  assert.equal(results.teams[0].nameFull, "BioBuzz");
  assert.equal(results.events.length, 0);
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

  const first = await searchFtcEntities(2026, "Cascade");
  const second = await searchFtcEntities(2026, "Cascade");
  assert.deepEqual(first.teams.map(team => team.teamNumber), [11, 22]);
  assert.deepEqual(first.events.map(event => event.code), ["CASC"]);
  assert.deepEqual(second.teams.map(team => team.teamNumber), [11, 22]);
  assert.equal(requests.filter(url => url.includes("/teams?page=")).length, 2);
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

test("missing FIRST credentials fail explicitly before making a request", async () => {
  delete process.env.FTC_EVENTS_USERNAME;
  delete process.env.FTC_EVENTS_AUTHORIZATION_KEY;
  await assert.rejects(searchFtcEntities(2026, "robotics"), /credentials are not configured/i);
});
