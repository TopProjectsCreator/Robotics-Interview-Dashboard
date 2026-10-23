import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assistantSystemPrompt,
  assistantUserPrompt,
} from "./assistantPrompts.ts";
import {
  GetAssistantPromptQueueResponse,
  QueueAssistantPromptBody,
  StopAssistantPromptResponse,
} from "../../../../lib/api-zod/src/generated/api.ts";

const routePath = fileURLToPath(new URL("../routes/robotics.ts", import.meta.url));

test("the system prompt covers every workspace area, not just interviews", () => {
  const prompt = assistantSystemPrompt();
  for (const area of ["Tryouts and interviews", "Parts and inventory", "CAD library", "Code workspace", "Planning and sharing", "Outside knowledge"]) {
    assert.ok(prompt.includes(area), `system prompt should describe the ${area} area`);
  }
  assert.ok(prompt.includes("not only for tryouts"), "the prompt should say the workspace is more than the tryout area");
  assert.ok(prompt.includes("list_parts_catalog"), "the prompt should point at the parts tools");
  assert.ok(prompt.includes("list_code_projects"), "the prompt should point at the code tools");
  assert.ok(prompt.includes("list_cad_library"), "the prompt should point at the CAD tools");
  assert.ok(prompt.includes("search_applicants"), "the prompt should point at the applicant tools");
});

test("the system prompt says workspace data is only available through tools", () => {
  const prompt = assistantSystemPrompt();
  assert.ok(prompt.includes("No workspace data is preloaded"), "the prompt should state that no records are preloaded");
  assert.ok(prompt.includes("you see them only when a tool returns them"), "the prompt should state that tools are the only source of records");
  assert.ok(prompt.includes("Never guess names, scores, stock levels, file contents, or ids"), "the prompt should forbid guessing record values");
});

test("the user prompt carries the question and no applicant records", () => {
  const prompt = assistantUserPrompt({
    question: "How many parts do we have for Munchies?",
    attachments: [{ fileName: "roster.csv", objectPath: "/objects/roster.csv" }],
    chatContext: [{ author: "Maxim", message: "check the drivetrain" }],
  });
  assert.ok(prompt.includes("How many parts do we have for Munchies?"));
  assert.ok(prompt.includes("/objects/roster.csv"), "attachments should still be described");
  assert.ok(prompt.includes("check the drivetrain"), "recent chat should still be described");
  assert.ok(!prompt.includes("Applicant records"), "the prompt must not carry an applicant record dump");
  assert.ok(!prompt.includes("aiScore"), "the prompt must not carry applicant fields");
});

test("the assistant route no longer pastes applicant records into the prompt", async () => {
  const source = await readFile(routePath, "utf8");
  assert.ok(!source.includes("Applicant records:"), "the route must not paste applicant records into the prompt");
  assert.ok(source.includes("assistantUserPrompt("), "the route must build the user turn with the shared prompt helper");
  assert.ok(source.includes("assistantSystemPrompt()"), "the route must use the shared system prompt");
});

test("assistant prompt queue contracts accept persisted statuses and reject unknown ones", () => {
  const item = {
    id: "run-1",
    conversationId: "conversation-1",
    prompt: "Check the build notes",
    status: "queued",
    answer: null,
    error: null,
    activities: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
  assert.equal(GetAssistantPromptQueueResponse.parse({ items: [item], isRunning: false }).items[0].status, "queued");
  assert.equal(
    GetAssistantPromptQueueResponse.parse({ items: [{ ...item, status: "interrupted" }], isRunning: false }).items[0].status,
    "interrupted",
  );
  assert.equal(GetAssistantPromptQueueResponse.safeParse({
    items: [{ ...item, status: "retrying" }],
    isRunning: false,
  }).success, false);
  assert.deepEqual(QueueAssistantPromptBody.parse({ question: "Check the build notes", conversationId: "conversation-1" }), {
    question: "Check the build notes",
    conversationId: "conversation-1",
  });
  assert.deepEqual(StopAssistantPromptResponse.parse({ items: [], isRunning: false }), { items: [], isRunning: false });
});

test("queued assistant prompts are claimed in order with one running prompt per conversation", async () => {
  const source = await readFile(routePath, "utf8");
  const start = source.indexOf("async function claimQueuedAssistantPrompt");
  const end = source.indexOf("\nasync function setAssistantPromptRunFailure", start);
  assert.notEqual(start, -1, "the persisted queue should have a server-side claim operation");
  const claim = source.slice(start, end);
  for (const contract of [
    `queued."status" = 'queued'`,
    `active."status" = 'running'`,
    `order by queued."created_at", queued."id"`,
    "for update skip locked",
    `set "status" = 'running'`,
  ]) assert.ok(claim.includes(contract), `claim operation should preserve ${contract}`);
});

test("queue workers keep accepted runs durable, scoped, and non-duplicating on recovery", async () => {
  const source = await readFile(routePath, "utf8");
  for (const contract of [
    "payload,",
    "createInterviewerSession(run.accountId, run.instance)",
    `"x-assistant-run-proof"`,
    "assistantPromptWorkerProof(run.id, run.teamId, run.accountId)",
    "setInterval(() => { void dispatch(); }, 1500)",
    `status: "interrupted"`,
    "It was not retried to avoid repeating completed tool actions",
    `status: "failed"`,
  ]) assert.ok(source.includes(contract), `durable worker should preserve ${contract}`);
});

test("queue reads and writes stay within the authorized conversation, team, and owner", async () => {
  const source = await readFile(routePath, "utf8");
  const routes = source.slice(
    source.indexOf('router.get("/assistant/conversations/:conversationId/queue"'),
    source.indexOf('router.post("/assistant/ask/stream"'),
  );
  for (const contract of [
    `router.get("/assistant/conversations/:conversationId/queue", requireAdmin`,
    `router.post("/assistant/conversations/:conversationId/queue", requireAdmin`,
    `router.post("/assistant/conversations/:conversationId/stop", requireAdmin`,
    "teamFilter(assistantConversationsTable.teamId, teamId)",
    "assistantConversationOwnerFilter(account)",
  ]) assert.ok(routes.includes(contract), `queue routes should preserve ${contract}`);
  assert.ok(source.includes("assistantPromptRunsTable.accountId, account.id"), "worker runs must be bound to their submitting account");
});

test("Stop is persisted and failures leave later queued prompts available", async () => {
  const source = await readFile(routePath, "utf8");
  for (const contract of [
    "cancelRequested: true",
    "activeAssistantPromptControllers.get(activeRun.id)?.abort()",
    `status: "cancelled"`,
    `status: "failed"`,
    "Later prompts remain queued and will continue",
  ]) assert.ok(source.includes(contract), `stop and failure handling should preserve ${contract}`);
});
