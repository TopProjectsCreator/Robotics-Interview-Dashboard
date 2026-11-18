import assert from "node:assert/strict";
import test, { mock } from "node:test";

test("scrypt bounds active derivations, yields the event loop and releases failed permits", async (t) => {
  const callbacks = [];
  let active = 0;
  let peak = 0;
  mock.module("node:crypto", {
    namedExports: {
      scrypt(value, salt, length, callback) {
        assert.equal(length, 64);
        active += 1;
        peak = Math.max(peak, active);
        callbacks.push((error) => {
          active -= 1;
          callback(error, Buffer.alloc(64));
        });
      },
    },
  });
  t.after(() => mock.restoreAll());
  const { deriveSecret } = await import("./asyncScrypt.ts");
  const jobs = Array.from({ length: 8 }, () => deriveSecret("password", Buffer.alloc(16)));
  const results = Promise.allSettled(jobs);
  assert.equal(callbacks.length, 2);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, 2, "timers must proceed while derivations are pending");
  for (let i = 0; i < 8; i += 1) {
    assert.ok(callbacks[i], `queued derivation ${i} started`);
    callbacks[i](i === 0 ? new Error("test worker failure") : null);
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.equal((await results).filter((result) => result.status === "rejected").length, 1);
  const final = deriveSecret("next", Buffer.alloc(16));
  callbacks[8](null);
  assert.equal((await final).length, 64);
});
