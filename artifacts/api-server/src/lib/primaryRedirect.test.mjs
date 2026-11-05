import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_REDIRECT_TARGET_URL,
  getRedirectConfig,
  getRedirectLocation,
} from "./primaryRedirect.ts";

test("defaults redirect primaries to the backup and preserve path+query", () => {
  const config = getRedirectConfig({});
  assert.equal(config.enabled, true);
  assert.equal(config.targetUrl, DEFAULT_REDIRECT_TARGET_URL);
  assert.equal(
    getRedirectLocation({
      host: "roboticsdashboard.onrender.com",
      originalUrl: "/attendance?x=1",
      config,
    }),
    "https://roboticsdashboardbackup.onrender.com/attendance?x=1",
  );
  assert.equal(
    getRedirectLocation({
      host: "robotics-interview-dashboard.onrender.com",
      originalUrl: "/",
      config,
    }),
    "https://roboticsdashboardbackup.onrender.com/",
  );
});

test("backup, localhost and unknown hosts are not redirected", () => {
  const config = getRedirectConfig({});
  for (const host of [
    "roboticsdashboardbackup.onrender.com",
    "localhost:8080",
    "example.com",
    undefined,
  ]) {
    assert.equal(
      getRedirectLocation({ host, originalUrl: "/", config }),
      null,
      `host=${String(host)}`,
    );
  }
});

test("host comparison ignores port and case", () => {
  const config = getRedirectConfig({});
  assert.equal(
    getRedirectLocation({
      host: "RoboticsDashboard.ONRENDER.COM:443",
      originalUrl: "/boards",
      config,
    }),
    "https://roboticsdashboardbackup.onrender.com/boards",
  );
});

test("empty REDIRECT_TARGET_URL disables the redirect", () => {
  const config = getRedirectConfig({ REDIRECT_TARGET_URL: "" });
  assert.equal(config.enabled, false);
  assert.equal(
    getRedirectLocation({
      host: "roboticsdashboard.onrender.com",
      originalUrl: "/",
      config,
    }),
    null,
  );
});

test("the backup host is never in the redirect set (no loop)", () => {
  const config = getRedirectConfig({
    REDIRECT_FROM_HOSTS:
      "roboticsdashboard.onrender.com,roboticsdashboardbackup.onrender.com",
  });
  assert.equal(config.enabled, true);
  assert.equal(
    getRedirectLocation({
      host: "roboticsdashboardbackup.onrender.com",
      originalUrl: "/",
      config,
    }),
    null,
  );
});

test("custom target and hosts are honoured", () => {
  const config = getRedirectConfig({
    REDIRECT_TARGET_URL: "https://example-backup.test/",
    REDIRECT_FROM_HOSTS: "roboticsdashboard.onrender.com",
  });
  assert.equal(config.enabled, true);
  assert.equal(config.targetUrl, "https://example-backup.test");
  assert.equal(
    getRedirectLocation({
      host: "roboticsdashboard.onrender.com",
      originalUrl: "/a/b?c=d",
      config,
    }),
    "https://example-backup.test/a/b?c=d",
  );
  // robotics-interview-dashboard is no longer in the custom list.
  assert.equal(
    getRedirectLocation({
      host: "robotics-interview-dashboard.onrender.com",
      originalUrl: "/",
      config,
    }),
    null,
  );
});

test("invalid target URL disables the redirect", () => {
  const config = getRedirectConfig({ REDIRECT_TARGET_URL: "not a url" });
  assert.equal(config.enabled, false);
});
