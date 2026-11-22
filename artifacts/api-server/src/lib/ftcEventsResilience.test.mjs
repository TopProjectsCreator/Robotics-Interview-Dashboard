import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const {
  clearFtcEventCacheForTests,
  searchFtcEntities,
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

// The page retry uses a short real timer, so poll on real time (not setImmediate)
// until both sources leave the "loading" state.
async function waitForFinished(season, query) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await searchFtcEntities(season, query);
    if (result.teamsStatus !== "loading" && result.eventsStatus !== "loading") return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`FTC search did not finish for ${query}`);
}

test("a failing team page and events endpoint still return partial results and do not re-fetch during backoff", async (t) => {
  withCredentials();
  const now = 1_000_000;
  t.mock.method(Date, "now", () => now);

  const pageRequests = new Map();
  let eventRequests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    const href = String(url);
    const pageMatch = href.match(/\/2026\/teams\?page=(\d+)/);
    if (pageMatch) {
      const page = Number(pageMatch[1]);
      pageRequests.set(page, (pageRequests.get(page) ?? 0) + 1);
      // Page 7 always fails (including its single retry). The rest of the
      // season must still be searchable.
      if (page === 7) return response({ error: "flaky page" }, 500);
      return response({
        teams: [{ teamNumber: 10_000 + page, nameFull: `Cascade Team ${page}` }],
        pageTotal: 31,
      });
    }
    if (href.endsWith("/2026/events")) {
      eventRequests += 1;
      return response({ error: "temporary outage" }, 503);
    }
    throw new Error(`Unexpected request ${href}`);
  });

  const result = await waitForFinished(2026, "Cascade");

  // Partial teams are returned instead of a 502, with honest degraded statuses.
  assert.ok(result.teams.length > 0, "expected searchable teams from the loaded pages");
  assert.ok(
    result.teams.every(team => team.teamNumber !== 10_007),
    "the failed page's team must be absent",
  );
  assert.equal(result.teamsStatus, "error");
  assert.equal(result.eventsStatus, "error");
  assert.deepEqual(result.events, []);

  // First page loaded once, the retry for page 7 happened once, other pages once.
  assert.equal(pageRequests.get(1), 1);
  assert.equal(pageRequests.get(2), 1);
  assert.equal(pageRequests.get(7), 2);
  assert.equal(pageRequests.size, 31);
  assert.equal(eventRequests, 1);

  const beforePages = new Map(pageRequests);
  const beforeEvents = eventRequests;
  for (let i = 0; i < 6; i += 1) {
    const repeated = await searchFtcEntities(2026, "Cascade");
    assert.ok(repeated.teams.length > 0);
    assert.equal(repeated.teamsStatus, "error");
  }
  assert.deepEqual(pageRequests, beforePages, "backoff must prevent team page re-fetches on each keystroke");
  assert.equal(eventRequests, beforeEvents, "backoff must prevent event re-fetches on each keystroke");
});

test("a transient page failure is retried and its teams are included", async (t) => {
  withCredentials();
  const attempts = new Map();
  t.mock.method(globalThis, "fetch", async (url) => {
    const href = String(url);
    const pageMatch = href.match(/\/2026\/teams\?page=(\d+)/);
    if (pageMatch) {
      const page = Number(pageMatch[1]);
      const attempt = (attempts.get(page) ?? 0) + 1;
      attempts.set(page, attempt);
      if (page === 7 && attempt === 1) return response({ error: "transient" }, 503);
      return response({
        teams: [{ teamNumber: 10_000 + page, nameFull: `Cascade Team ${page}` }],
        pageTotal: 31,
      });
    }
    if (href.endsWith("/2026/events")) {
      return response({ events: [{ code: "CASC", name: "Cascade Open" }] });
    }
    throw new Error(`Unexpected request ${href}`);
  });

  const result = await waitForFinished(2026, "Cascade");

  assert.equal(attempts.get(7), 2, "page 7 should be retried once");
  const numbers = result.teams.map(team => team.teamNumber);
  assert.ok(numbers.includes(10_007), "the retried page's team should be present");
  assert.equal(result.teamsStatus, "ready");
  assert.equal(result.eventsStatus, "ready");
  assert.deepEqual(result.events.map(event => event.code), ["CASC"]);
});

test("a total outage with no usable data still fails with 502", async (t) => {
  withCredentials();
  t.mock.method(globalThis, "fetch", async () => response({ error: "down" }, 503));

  // The first search kicks off both loads; they fail in the background.
  await searchFtcEntities(2026, "robotics");
  await new Promise(resolve => setImmediate(resolve));

  await assert.rejects(searchFtcEntities(2026, "robotics"), /could not be loaded/i);
});
