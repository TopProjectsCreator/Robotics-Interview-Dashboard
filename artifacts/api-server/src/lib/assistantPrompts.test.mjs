import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assistantSystemPrompt,
  assistantUserPrompt,
} from "./assistantPrompts.ts";

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
