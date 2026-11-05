import assert from "node:assert/strict";
import test from "node:test";
import { parseCustomWorkspaceTabs } from "./customWorkspaceTabs.ts";

test("parses valid custom workspace tabs and trims labels", () => {
  assert.deepEqual(
    parseCustomWorkspaceTabs(JSON.stringify({
      tabs: [
        { id: "overview", label: " Overview " },
        { id: "reports", label: "Reports" },
      ],
    })),
    [
      { id: "overview", label: "Overview" },
      { id: "reports", label: "Reports" },
    ],
  );
});

test("rejects malformed, duplicate, and oversized tab manifests", () => {
  assert.deepEqual(parseCustomWorkspaceTabs("{"), []);
  assert.deepEqual(parseCustomWorkspaceTabs(JSON.stringify({ tabs: [{ id: "overview", label: "Overview" }] })), []);
  assert.deepEqual(parseCustomWorkspaceTabs(JSON.stringify({
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "overview", label: "Duplicate" },
    ],
  })), []);
  assert.deepEqual(parseCustomWorkspaceTabs(JSON.stringify({
    tabs: [
      { id: "../other", label: "Unsafe path" },
      { id: "reports", label: "Reports" },
    ],
  })), []);
  assert.deepEqual(parseCustomWorkspaceTabs("x".repeat(16_001)), []);
});
