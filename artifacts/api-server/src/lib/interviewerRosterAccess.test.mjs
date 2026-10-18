import assert from "node:assert/strict";
import test from "node:test";
import { interviewerRosterAccess } from "./interviewerRosterAccess.ts";

test("refuses an anonymous roster read with no team access code", () => {
  assert.deepEqual(interviewerRosterAccess({ hasSession: false }), {
    kind: "denied",
    status: 401,
    error: "Authentication required",
  });
});

test("refuses a blank or non-string team access code rather than falling back to the default team", () => {
  for (const eventPassword of ["", "   ", null, undefined, 42]) {
    assert.deepEqual(
      interviewerRosterAccess({ hasSession: false, eventPassword }),
      { kind: "denied", status: 401, error: "Authentication required" },
    );
  }
});

test("lets the login screen read one team by presenting its access code", () => {
  assert.deepEqual(interviewerRosterAccess({ hasSession: false, eventPassword: " CLAW-4821-KILO " }), {
    kind: "event-password",
    eventPassword: "CLAW-4821-KILO",
  });
});

test("gives a signed-in account its own team regardless of any code in the query", () => {
  assert.deepEqual(interviewerRosterAccess({ hasSession: true }), { kind: "session" });
  assert.deepEqual(
    interviewerRosterAccess({ hasSession: true, eventPassword: "other-team-code" }),
    { kind: "session" },
  );
});