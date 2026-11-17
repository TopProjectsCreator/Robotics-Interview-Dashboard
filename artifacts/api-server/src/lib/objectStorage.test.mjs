import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { describe, mock } from "node:test";

// @workspace/db cannot load outside the app bundle (its source uses directory
// imports), so it is mocked — the CAD path validation needs no database.
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

mock.module("@workspace/db", {
  namedExports: {
    currentInstance: () => "primary",
    DEFAULT_TEAM_ID: "default",
    pool: { query: async () => ({ rows: [], rowCount: 0 }) },
    runWithInstance: (_instance, fn) => fn(),
  },
});

const { toStoragePath, ObjectNotFoundError } = await import("./objectStorage.ts");

describe("toStoragePath", () => {
  test("accepts generated/cad/<teamId>/<id> and pins it as-is", () => {
    assert.equal(
      toStoragePath("/objects/generated/cad/2aa0f5c6607d75f3d2de56f55fe50453/928836f6-5d2a-48cb-8616-034eba8dff6c"),
      "generated/cad/2aa0f5c6607d75f3d2de56f55fe50453/928836f6-5d2a-48cb-8616-034eba8dff6c",
    );
    // The secondary prefix pins the instance; the path is normalized the same.
    assert.equal(
      toStoragePath("/objects/secondary/generated/cad/2aa0f5c6607d75f3d2de56f55fe50453/928836f6-5d2a-48cb-8616-034eba8dff6c"),
      "generated/cad/2aa0f5c6607d75f3d2de56f55fe50453/928836f6-5d2a-48cb-8616-034eba8dff6c",
    );
  });

  test("still accepts the pre-existing shapes", () => {
    assert.equal(
      toStoragePath("/objects/team-branding/teamA/abcdef12-1234-1234-1234-abcdef123456"),
      "team-branding/teamA/abcdef12-1234-1234-1234-abcdef123456",
    );
    assert.equal(toStoragePath("/objects/abcdef12-1234-1234-1234-abcdef123456"), "uploads/abcdef12-1234-1234-1234-abcdef123456");
    assert.equal(
      toStoragePath("/objects/generated/abcdef12-1234-1234-1234-abcdef123456"),
      "generated/abcdef12-1234-1234-1234-abcdef123456",
    );
  });

  test("rejects traversal, odd shapes, and bad segments", () => {
    const rejects = [
      "",                                                   // empty
      "abc",                                                // missing /objects/ prefix
      "/objects/",                                          // empty rest
      "/objects/../generated/cad/team/../../etc",           // path traversal
      "/objects/generated/cad/team",                        // too few segments
      "/objects/generated/cad/team/id/extra",               // too many segments
      "/objects/generated/cad/team bad name/928836f6-5d2a-48cb-8616-034eba8dff6c", // spaces
      "/objects/generated/cad/teamA/short",                 // id segment too short
      "/objects/generated/cad/bad id with space/1234abcd-1234-1234-1234-abcdef123456", // team spaces
    ];
    for (const candidate of rejects) {
      assert.throws(() => toStoragePath(candidate), ObjectNotFoundError, candidate);
    }
  });
});
