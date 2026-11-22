import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCpuPercent,
  calculateMemoryPercent,
  parseCgroupCpuQuotaCores,
  parseCgroupCpuUsageMicros,
  partsCatalogLoadAllowsWork,
} from "./partsCatalogLoad.ts";

test("parses cgroup v2 CPU usage and quota", () => {
  assert.equal(parseCgroupCpuUsageMicros("usage_usec 42000\nuser_usec 30000\n"), 42_000);
  assert.equal(parseCgroupCpuUsageMicros("user_usec 42\n"), null);
  assert.equal(parseCgroupCpuQuotaCores("150000 100000"), 1.5);
  assert.equal(parseCgroupCpuQuotaCores("max 100000"), null);
  assert.equal(parseCgroupCpuQuotaCores("0 100000"), null);
});

test("calculates CPU and memory percentages against container allocations", () => {
  assert.equal(calculateCpuPercent(1_000_000, 2_000_000, 1_000, 2), 50);
  assert.equal(calculateCpuPercent(2_000_000, 1_000_000, 1_000, 2), null);
  assert.equal(calculateMemoryPercent(700, 1_000), 70);
  assert.equal(calculateMemoryPercent(1_500, 1_000), 100);
});

test("catalog maintenance requires both CPU and memory below their limits", () => {
  assert.equal(partsCatalogLoadAllowsWork({ cpuPercent: 49.9, memoryPercent: 69.9 }), true);
  assert.equal(partsCatalogLoadAllowsWork({ cpuPercent: 50, memoryPercent: 20 }), false);
  assert.equal(partsCatalogLoadAllowsWork({ cpuPercent: 20, memoryPercent: 70 }), false);
  assert.equal(partsCatalogLoadAllowsWork({ cpuPercent: null, memoryPercent: 20 }), false);
  assert.equal(partsCatalogLoadAllowsWork({ cpuPercent: 20, memoryPercent: null }), false);
});
