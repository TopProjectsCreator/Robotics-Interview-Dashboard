import test from "node:test";
import assert from "node:assert/strict";

const { backgroundVisibleToMember, canReadTeamBrandingObject } = await import("./teamBackgroundVisibility.ts");

test("legacy and everyone audiences include every signed-in member", () => {
  assert.equal(backgroundVisibleToMember(null, null, "member-a"), true);
  assert.equal(backgroundVisibleToMember("everyone", [], "member-a"), true);
});

test("selected audiences include only exact member account IDs", () => {
  assert.equal(backgroundVisibleToMember("selected", ["member-a"], "member-a"), true);
  assert.equal(backgroundVisibleToMember("selected", ["member-a"], "member-b"), false);
  assert.equal(backgroundVisibleToMember("selected", ["member-a"], undefined), false);
});

test("background object reads enforce audience while branding managers retain preview access", () => {
  const object = {
    requestedPath: "secondary/team-branding/team-a/background.webp",
    backgroundPath: "secondary/team-branding/team-a/background.webp",
    backgroundAudience: "selected",
    backgroundMemberIds: ["member-a"],
    interviewerId: "member-b",
  };
  assert.equal(canReadTeamBrandingObject(object), false);
  assert.equal(canReadTeamBrandingObject({ ...object, interviewerId: "member-a" }), true);
  assert.equal(canReadTeamBrandingObject({ ...object, canManageBranding: true }), true);
  assert.equal(canReadTeamBrandingObject({ ...object, requestedPath: "team-branding/team-a/old.webp" }), false);
  assert.equal(canReadTeamBrandingObject({
    requestedPath: "team-branding/team-a/logo.webp",
    logoPath: "team-branding/team-a/logo.webp",
    interviewerId: "member-b",
  }), true);
});
