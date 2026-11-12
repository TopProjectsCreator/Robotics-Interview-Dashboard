import test from "node:test";
import assert from "node:assert/strict";
import {
  publicOriginFromHeaders,
  agentProfileUrlFromOrigin,
  UCP_AGENT_PROFILE_PATH,
} from "./publicOrigin.ts";

test("plain Host header yields an https origin", () => {
  assert.equal(publicOriginFromHeaders({ host: "RoboticsDashboard.onRender.com" }), "https://roboticsdashboard.onrender.com");
});

test("X-Forwarded-* wins over Host and is case-insensitive", () => {
  assert.equal(
    publicOriginFromHeaders({
      host: "internal:8080",
      "x-forwarded-host": "Roboticsdashboard.Example.com",
      "x-forwarded-proto": "HTTPS",
    }),
    "https://roboticsdashboard.example.com",
  );
});

test("forwarded lists take the first hop", () => {
  assert.equal(
    publicOriginFromHeaders({ host: "a.com, b.net", "x-forwarded-host": "edge.example.com, loop:1" }),
    "https://edge.example.com",
  );
});

test("non-standard ports are kept, standard ports dropped", () => {
  assert.equal(publicOriginFromHeaders({ host: "app.local:3123" }), "https://app.local:3123");
  assert.equal(publicOriginFromHeaders({ host: "app.local:443" }), "https://app.local");
  assert.equal(publicOriginFromHeaders({ host: "app.local:80", "x-forwarded-proto": "http" }), "http://app.local");
});

test("malformed hosts are rejected rather than trusted", () => {
  assert.equal(publicOriginFromHeaders({ host: "evil site.com" }), null);
  assert.equal(publicOriginFromHeaders({ host: "user@host.com" }), null);
  assert.equal(publicOriginFromHeaders({ host: "a.com/path" }), null);
  assert.equal(publicOriginFromHeaders({ host: "ho$t.example" }), null);
  assert.equal(publicOriginFromHeaders({ host: "" }), null);
  assert.equal(publicOriginFromHeaders({}), null);
});

test("explicit http proto is honoured for local development", () => {
  assert.equal(publicOriginFromHeaders({ host: "localhost:8080", "x-forwarded-proto": "http" }), "http://localhost:8080");
});

test("agent profile URL is built from origin and path", () => {
  const origin = publicOriginFromHeaders({ host: "x.example.com" });
  assert.equal(agentProfileUrlFromOrigin(origin), `https://x.example.com${UCP_AGENT_PROFILE_PATH}`);
});
