import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { before } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
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

// Static imports resolve before the hooks above register, so the subject
// under test is loaded dynamically like boardOperations.test.mjs does.
let deployProjectToHub;
let hubPathFor;
let normalizeHubBaseUrl;
before(async () => {
  ({ deployProjectToHub, hubPathFor, normalizeHubBaseUrl } = await import("./hubDeploy.ts"));
});

test("hub paths accept TeamCode files and reject the rest", () => {
  assert.equal(
    hubPathFor("TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Auto.java"),
    "org/firstinspires/ftc/teamcode/Auto.java",
  );
  assert.equal(hubPathFor("README.md"), null);
  assert.equal(hubPathFor("TeamCode/build.gradle"), null);
  assert.equal(hubPathFor("../escape.java"), null);
});

test("hub URLs must be http(s) and never cloud metadata", () => {
  assert.equal(normalizeHubBaseUrl("http://192.168.43.1:8080"), "http://192.168.43.1:8080");
  assert.equal(normalizeHubBaseUrl("http://192.168.43.1:8080/"), "http://192.168.43.1:8080");
  assert.equal(normalizeHubBaseUrl("ftp://192.168.43.1/"), null);
  assert.equal(normalizeHubBaseUrl("http://169.254.169.254/"), null);
  assert.equal(normalizeHubBaseUrl("not a url"), null);
});

function fakeHub({ buildSucceeds = true } = {}) {
  const seen = [];
  const fail = (message) => { throw new Error(message); };
  return {
    seen,
    fetch: async (url, init) => {
      seen.push({ url, method: init?.method });
      if (url.endsWith("/java/file/save")) {
        return { status: 200, text: async () => '{"success":"true"}' };
      }
      if (url.endsWith("/java/build/start")) {
        return { status: 200, text: async () => '{"success":"true","data":7}' };
      }
      if (url.endsWith("/java/build/status")) {
        return {
          status: 200,
          text: async () => JSON.stringify({ success: "true", data: { completed: true, successful: buildSucceeds } }),
        };
      }
      if (url.endsWith("/java/build/log")) {
        return { status: 200, text: async () => (buildSucceeds ? "Build successful!" : "A.java:3:5: error: wat") };
      }
      return fail(`unexpected hub call ${url}`);
    },
  };
}

test("deploy saves each file, starts the hub build, and reports success", async () => {
  const hub = fakeHub();
  const result = await deployProjectToHub(
    "http://192.168.43.1:8080",
    [{ path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/A.java", content: "class A {}" }],
    hub.fetch,
  );
  assert.equal(result.pushed.length, 1);
  assert.equal(result.pushed[0].hubPath, "org/firstinspires/ftc/teamcode/A.java");
  assert.equal(result.buildStarted, true);
  assert.equal(result.buildSuccessful, true);
  assert.match(result.log, /Build successful/);
  assert.ok(hub.seen.some((call) => call.url.endsWith("/java/build/start")));
});

test("deploy surfaces a failed hub build with its log", async () => {
  const hub = fakeHub({ buildSucceeds: false });
  const result = await deployProjectToHub(
    "http://192.168.43.1:8080",
    [{ path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/A.java", content: "class A {}" }],
    hub.fetch,
  );
  assert.equal(result.buildSuccessful, false);
  assert.match(result.log, /error/);
});

test("deploy throws a clear error when the hub is unreachable", async () => {
  await assert.rejects(
    deployProjectToHub("http://192.168.43.1:8080", [{ path: "A.java", content: "x" }], async () => {
      throw new Error("no route");
    }),
    /did not answer/,
  );
});
