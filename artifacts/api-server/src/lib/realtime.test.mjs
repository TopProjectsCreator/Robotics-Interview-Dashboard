import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const subscriptions = [];
const clients = [];
mock.module("@supabase/supabase-js", {
  namedExports: {
    createClient() {
      const relay = {
        realtime: {
          async disconnect() {
            relay.disconnectCount += 1;
            return "ok";
          },
        },
        disconnectCount: 0,
        channel() {
          return {
            on() {
              return this;
            },
            subscribe(callback) {
              subscriptions.push(callback);
              return this;
            },
          };
        },
      };
      clients.push(relay);
      return relay;
    },
  },
});
mock.module("@workspace/db", {
  namedExports: { pool: { query: async () => undefined } },
});

process.env.SUPABASE_URL = "https://primary.example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
delete process.env.SECONDARY_SUPABASE_URL;
delete process.env.SECONDARY_SUPABASE_SECRET_KEY;

const { initRealtime, isRealtimeEnabled } = await import("./realtime.ts");

test("failed relay disconnects before retry and does not create replacement sockets early", () => {
  initRealtime();
  assert.equal(clients.length, 1);
  assert.equal(isRealtimeEnabled(), false);

  subscriptions[0]("SUBSCRIBED");
  assert.equal(isRealtimeEnabled(), true);

  subscriptions[0]("CHANNEL_ERROR", new Error("temporary outage"));
  assert.equal(clients[0].disconnectCount, 1);
  assert.equal(isRealtimeEnabled(), false);

  // Disconnecting may report CLOSED, and repeated failure callbacks must not
  // schedule another replacement or leave more sockets open.
  subscriptions[0]("CLOSED");
  subscriptions[0]("CHANNEL_ERROR", new Error("still unavailable"));
  assert.equal(clients.length, 1);
  assert.equal(clients[0].disconnectCount, 1);
});
