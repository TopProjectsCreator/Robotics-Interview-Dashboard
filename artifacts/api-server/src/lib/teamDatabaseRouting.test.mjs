import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.(?:ts|js|mjs|json)$/.test(specifier)) {
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

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/primary";
process.env.SECONDARY_DATABASE_URL = "postgres://test:test@127.0.0.1:5432/secondary";
process.env.SESSION_SECRET = "team-database-routing-test-secret";

const { createInterviewerSession, instanceFromSession } = await import("../middlewares/adminAuth.ts");
const { activeTeamDatabaseInstance } = await import("./activeTeamDatabase.ts");

test("the configured secondary is the active team database", () => {
  assert.equal(activeTeamDatabaseInstance(), "secondary");
});

test("legacy unmarked sessions route to the active team database", () => {
  const legacySession = createInterviewerSession("legacy-account", "primary");
  assert.equal(legacySession.split(".").length, 4);
  assert.equal(instanceFromSession(legacySession), "secondary");
});

test("new sessions use the active database and explicit secondary markers stay stable", () => {
  const activeSession = createInterviewerSession("active-account");
  assert.equal(activeSession.split(".")[3], "s");
  assert.equal(instanceFromSession(activeSession), "secondary");
});
