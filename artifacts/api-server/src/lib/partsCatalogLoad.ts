import { readFile } from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";

export type PartsCatalogResourceUsage = {
  cpuPercent: number | null;
  memoryPercent: number | null;
  memoryUsedBytes: number | null;
  memoryLimitBytes: number | null;
  source: "cgroup" | "process";
};

export const PARTS_CATALOG_MAX_CPU_PERCENT = 50;
/** Keep at least 30% of the container's memory limit available. */
export const PARTS_CATALOG_MAX_MEMORY_PERCENT = 70;
export const PARTS_CATALOG_RESOURCE_SAMPLE_MS = 1_000;

const CPU_STAT_PATH = "/sys/fs/cgroup/cpu.stat";
const CPU_MAX_PATH = "/sys/fs/cgroup/cpu.max";
const MEMORY_CURRENT_PATH = "/sys/fs/cgroup/memory.current";
const MEMORY_MAX_PATH = "/sys/fs/cgroup/memory.max";

type ResourceReader = (path: string) => Promise<string>;

function readResourceText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function tryRead(reader: ResourceReader, path: string): Promise<string | null> {
  try {
    return await reader(path);
  } catch {
    return null;
  }
}

export function parseCgroupCpuUsageMicros(stat: string): number | null {
  const match = /^usage_usec\s+(\d+)$/m.exec(stat);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Returns the CPU quota in cores, or null when the cgroup has no quota. */
export function parseCgroupCpuQuotaCores(cpuMax: string): number | null {
  const [quotaText, periodText] = cpuMax.trim().split(/\s+/);
  if (quotaText === "max") return null;
  const quota = Number(quotaText);
  const period = Number(periodText);
  if (!Number.isFinite(quota) || quota <= 0 || !Number.isFinite(period) || period <= 0) return null;
  return quota / period;
}

export function calculateCpuPercent(
  beforeMicros: number,
  afterMicros: number,
  elapsedMs: number,
  availableCores: number,
): number | null {
  if (
    !Number.isFinite(beforeMicros) || beforeMicros < 0 ||
    !Number.isFinite(afterMicros) || afterMicros < beforeMicros ||
    !Number.isFinite(elapsedMs) || elapsedMs <= 0 ||
    !Number.isFinite(availableCores) || availableCores <= 0
  ) return null;
  const elapsedMicros = elapsedMs * 1_000;
  return Math.min(100, Math.max(0, ((afterMicros - beforeMicros) / (elapsedMicros * availableCores)) * 100));
}

export function calculateMemoryPercent(usedBytes: number, limitBytes: number): number | null {
  if (
    !Number.isFinite(usedBytes) || usedBytes < 0 ||
    !Number.isFinite(limitBytes) || limitBytes <= 0
  ) return null;
  return Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100));
}

export function partsCatalogLoadAllowsWork(
  usage: Pick<PartsCatalogResourceUsage, "cpuPercent" | "memoryPercent">,
  limits: { maxCpuPercent?: number; maxMemoryPercent?: number } = {},
): boolean {
  const maxCpuPercent = limits.maxCpuPercent ?? PARTS_CATALOG_MAX_CPU_PERCENT;
  const maxMemoryPercent = limits.maxMemoryPercent ?? PARTS_CATALOG_MAX_MEMORY_PERCENT;
  return (
    typeof usage.cpuPercent === "number" &&
    Number.isFinite(usage.cpuPercent) &&
    usage.cpuPercent < maxCpuPercent &&
    typeof usage.memoryPercent === "number" &&
    Number.isFinite(usage.memoryPercent) &&
    usage.memoryPercent < maxMemoryPercent
  );
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Samples container CPU over a short interval and reads its current memory use.
 * Cgroup v2 metrics are preferred so the gate follows the container's actual
 * allocation; process and host metrics are the fallback on other runtimes.
 */
export async function samplePartsCatalogResourceUsage(options: {
  sampleMs?: number;
  readText?: ResourceReader;
  sleep?: (milliseconds: number) => Promise<void>;
} = {}): Promise<PartsCatalogResourceUsage> {
  const sampleMs = options.sampleMs ?? PARTS_CATALOG_RESOURCE_SAMPLE_MS;
  const readText = options.readText ?? readResourceText;
  const sleep = options.sleep ?? pause;

  const [cpuBeforeText, cpuMaxText, memoryCurrentText, memoryMaxText] = await Promise.all([
    tryRead(readText, CPU_STAT_PATH),
    tryRead(readText, CPU_MAX_PATH),
    tryRead(readText, MEMORY_CURRENT_PATH),
    tryRead(readText, MEMORY_MAX_PATH),
  ]);
  const cgroupCpuBefore = cpuBeforeText ? parseCgroupCpuUsageMicros(cpuBeforeText) : null;
  const processCpuBefore = process.cpuUsage();
  const processTimeBefore = performance.now();

  await sleep(sampleMs);

  const processElapsedMs = Math.max(1, performance.now() - processTimeBefore);
  const processCpuDelta = process.cpuUsage(processCpuBefore);
  const processCpuMicros = processCpuDelta.user + processCpuDelta.system;
  const cpuAfterText = await tryRead(readText, CPU_STAT_PATH);
  const cgroupCpuAfter = cpuAfterText ? parseCgroupCpuUsageMicros(cpuAfterText) : null;
  const quotaCores = cpuMaxText ? parseCgroupCpuQuotaCores(cpuMaxText) : null;
  const availableCores = quotaCores ?? Math.max(1, os.availableParallelism());
  const cgroupCpuPercent =
    cgroupCpuBefore !== null && cgroupCpuAfter !== null
      ? calculateCpuPercent(cgroupCpuBefore, cgroupCpuAfter, processElapsedMs, availableCores)
      : null;
  const cpuPercent =
    cgroupCpuPercent ??
    calculateCpuPercent(0, processCpuMicros, processElapsedMs, Math.max(1, os.availableParallelism()));

  const memoryUsedFromCgroup =
    memoryCurrentText !== null && /^\d+$/.test(memoryCurrentText.trim())
      ? Number(memoryCurrentText.trim())
      : null;
  const memoryLimitFromCgroup =
    memoryMaxText !== null && /^\d+$/.test(memoryMaxText.trim())
      ? Number(memoryMaxText.trim())
      : null;
  const cgroupMemoryPercent =
    memoryUsedFromCgroup !== null && memoryLimitFromCgroup !== null
      ? calculateMemoryPercent(memoryUsedFromCgroup, memoryLimitFromCgroup)
      : null;

  if (cgroupCpuPercent !== null && cgroupMemoryPercent !== null) {
    return {
      cpuPercent: cgroupCpuPercent,
      memoryPercent: cgroupMemoryPercent,
      memoryUsedBytes: memoryUsedFromCgroup,
      memoryLimitBytes: memoryLimitFromCgroup,
      source: "cgroup",
    };
  }

  const processMemoryBytes = process.memoryUsage().rss;
  const hostMemoryBytes = os.totalmem();
  return {
    cpuPercent,
    memoryPercent:
      cgroupMemoryPercent ?? calculateMemoryPercent(processMemoryBytes, hostMemoryBytes),
    memoryUsedBytes: memoryUsedFromCgroup ?? processMemoryBytes,
    memoryLimitBytes: memoryLimitFromCgroup ?? hostMemoryBytes,
    source: "process",
  };
}
