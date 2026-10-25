import test from "node:test";
import assert from "node:assert/strict";
import {
  assistantTaskRunIdempotencyKey,
  nextAssistantTaskOccurrence,
  shouldRetryAssistantTaskRun,
  validateAssistantTaskSchedule,
} from "./assistantSchedule.ts";

test("validates daily and weekly recurrence shapes and IANA timezones", () => {
  assert.equal(validateAssistantTaskSchedule({
    frequency: "daily", hour: 8, minute: 30, daysOfWeek: [],
  }, "America/Los_Angeles"), null);
  assert.equal(validateAssistantTaskSchedule({
    frequency: "weekly", hour: 8, minute: 30, daysOfWeek: [1, 3, 5],
  }, "America/Los_Angeles"), null);
  assert.match(validateAssistantTaskSchedule({
    frequency: "weekly", hour: 8, minute: 30, daysOfWeek: [],
  }, "America/Los_Angeles"), /weekdays/);
  assert.match(validateAssistantTaskSchedule({
    frequency: "daily", hour: 8, minute: 30, daysOfWeek: [1],
  }, "Mars/Olympus"), /timezone/);
});

test("finds the next weekly local occurrence across a timezone boundary", () => {
  const next = nextAssistantTaskOccurrence({
    frequency: "weekly", hour: 9, minute: 30, daysOfWeek: [1],
  }, "America/New_York", new Date("2026-10-23T17:00:00.000Z"));
  assert.equal(next.toISOString(), "2026-10-26T13:30:00.000Z");
});

test("moves a nonexistent spring-forward time to the first valid local minute", () => {
  const next = nextAssistantTaskOccurrence({
    frequency: "weekly", hour: 2, minute: 30, daysOfWeek: [0],
  }, "America/New_York", new Date("2026-03-07T12:00:00.000Z"));
  assert.equal(next.toISOString(), "2026-03-08T07:00:00.000Z");
});

test("chooses the first instance of an ambiguous fall-back time", () => {
  const next = nextAssistantTaskOccurrence({
    frequency: "weekly", hour: 1, minute: 30, daysOfWeek: [0],
  }, "America/New_York", new Date("2026-10-31T12:00:00.000Z"));
  assert.equal(next.toISOString(), "2026-11-01T05:30:00.000Z");
});

test("retries transient failures only before side effects and only once", () => {
  assert.equal(shouldRetryAssistantTaskRun(1, false, 429), true);
  assert.equal(shouldRetryAssistantTaskRun(1, false, 503), true);
  assert.equal(shouldRetryAssistantTaskRun(1, false, 400), false);
  assert.equal(shouldRetryAssistantTaskRun(1, true, 503), false);
  assert.equal(shouldRetryAssistantTaskRun(2, false, 503), false);
});

test("uses a stable idempotency key for the same task occurrence", () => {
  const slot = new Date("2026-10-26T13:30:00.000Z");
  assert.equal(assistantTaskRunIdempotencyKey("task-a", slot), "task-a:2026-10-26T13:30:00.000Z");
  assert.equal(assistantTaskRunIdempotencyKey("task-a", slot), assistantTaskRunIdempotencyKey("task-a", new Date(slot)));
  assert.notEqual(assistantTaskRunIdempotencyKey("task-a", slot), assistantTaskRunIdempotencyKey("task-a", new Date(slot.getTime() + 60_000)));
});
