import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Sandboxed CAD runner for the `generate_cad_model` assistant tool.
 *
 * Two execution backends, selected by environment:
 *   - CAD_WORKER_URL set (e.g. Render, which cannot run docker-in-docker):
 *     the code is POSTed to a separate CAD worker service that runs it in a
 *     locked-down subprocess and returns the CAD files. The worker holds no
 *     secrets.
 *   - otherwise (local development): docker on this machine with
 *     `--network none`, read-only root FS, 640MB RAM, non-root, and a host
 *     directory mounted at `/out`.
 *
 * The model writes its finished CAD files to `/out`; the caller uploads
 * them to team storage. Mirrors the `python_exec` sandbox shape, but allows
 * CAD libraries (OCCT) and captures an output directory instead of stdout.
 */

export type CadFileOutcome = {
  name: string;
  buffer: Buffer;
  extension: string;
  contentType: string;
};

export type CadPythonOutcome =
  | { ok: true; files: CadFileOutcome[]; output: string }
  | { ok: false; output: string };

const DOCKER_IMAGE = process.env.PYTHON_CAD_IMAGE || "robotics-dashboard/cad-sandbox:latest";
const WORKER_URL = process.env.CAD_WORKER_URL?.trim().replace(/\/+$/, "") || null;
const WORKER_SECRET = process.env.CAD_WORKER_SECRET ?? "";
const DOCKER_TIMEOUT_MS = 60_000;
const DOCKER_INNER_TIMEOUT_S = 45;
const MAX_CODE_CHARS = 20_000;
const MAX_OUTPUT_CHARS = 4_000;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 8;

const CONTENT_TYPES: Record<string, string> = {
  stl: "model/stl",
  step: "model/step",
  stp: "model/step",
  iges: "model/iges",
  brep: "model/brep",
  obj: "model/obj",
  off: "model/off",
  "3mf": "model/3mf",
  glb: "model/gltf-binary",
};

const CAD_EXTENSIONS = new Set(Object.keys(CONTENT_TYPES));

/** The docker command line arguments for one CAD code run. */
export function buildCadDockerArgs(options: { outDir: string }): string[] {
  return [
    "run",
    "--rm",
    "-i",
    "--name", `cad-${randomUUID().slice(0, 8)}`,
    "--network", "none",
    "--memory", "640m",
    "--memory-swap", "640m",
    "--cpus", "1.5",
    "--pids-limit", "64",
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=96m",
    "--user", "65534:65534",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges=true",
    "-e", "HOME=/tmp",
    "-e", "PYTHONDONTWRITEBYTECODE=1",
    "-e", "PYTHONNOUSERSITE=1",
    "-v", `${options.outDir}:/out:rw`,
    DOCKER_IMAGE,
    "timeout", "-s", "KILL", String(DOCKER_INNER_TIMEOUT_S),
    "python", "-I", "-",
  ];
}

/** Content type for a CAD file extension, or null when the extension is unknown. */
export function cadContentType(extension: string): string | null {
  return CONTENT_TYPES[extension.toLowerCase()] ?? null;
}

/** CAD file extensions we accept out of the sandbox. */
export function isCadFileExtension(extension: string): boolean {
  return CAD_EXTENSIONS.has(extension.toLowerCase());
}

function classifyExit(code: number | null, signal: string | null, stdout: string, stderr: string): CadPythonOutcome {
  if (signal) return { ok: false, output: `The CAD script timed out after ${DOCKER_INNER_TIMEOUT_S}s.` };
  if (code !== 0) {
    const detail = stderr.trim() || stdout.trim();
    if (/^(docker:|no such image|Error response|Cannot connect|unable to|permission denied)/im.test(stderr.trim())) {
      return { ok: false, output: "CAD generation is unavailable on this server (sandbox image missing or Docker unavailable)." };
    }
    return { ok: false, output: `CAD generation failed.\n${detail.slice(-1_500)}` };
  }
  return { ok: true, files: [], output: stdout.trim() };
}

/** CAD files in `outDir`, sorted by name, capped at MAX_FILES and 32MB each. */
export async function scanCadOutputDirectory(outDir: string): Promise<CadFileOutcome[]> {
  const entries = await readdir(outDir, { withFileTypes: true });
  const files: { name: string; full: string }[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
    if (!isCadFileExtension(ext)) continue;
    if (entry.name.includes("..") || entry.name.startsWith(".")) continue;
    const full = path.join(outDir, entry.name);
    try {
      const stats = await stat(full);
      if (stats.size === 0 || stats.size > MAX_FILE_BYTES) continue;
    } catch {
      continue;
    }
    files.push({ name: entry.name, full });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  const collected: CadFileOutcome[] = [];
  for (const file of files.slice(0, MAX_FILES)) {
    const extension = file.name.split(".").pop()!.toLowerCase();
    try {
      collected.push({
        name: file.name,
        buffer: await readFile(file.full),
        extension,
        contentType: cadContentType(extension)!,
      });
    } catch {
      continue;
    }
  }
  return collected;
}

function dockerUsableCad(): Promise<boolean> {
  if (dockerState === "no") return Promise.resolve(false);
  if (dockerState === "yes") return Promise.resolve(true);
  return new Promise((resolve) => {
    const child = spawn("docker", ["image", "inspect", DOCKER_IMAGE, "--format", "{{.Id}}"], { timeout: 15000 });
    let found = false;
    child.stdout?.on("data", (chunk) => { found = true; });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0 && found));
  });
}

let dockerState: "unknown" | "yes" | "no" = "unknown";

/**
 * Validate the worker's response payload and convert it to CAD files. The
 * worker is trusted only with the shared secret, never with its claim about
 * sizes or types: we re-derive the extension allowlist, sizes, and content
 * types ourselves. Exported for unit tests.
 */
export function filesFromWorkerResponse(payload: unknown): CadFileOutcome[] {
  if (!payload || typeof payload !== "object") return [];
  const rawFiles = (payload as { files?: unknown }).files;
  if (!Array.isArray(rawFiles)) return [];
  const collected: CadFileOutcome[] = [];
  for (const raw of rawFiles.slice(0, MAX_FILES)) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as { name?: unknown; base64?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const base64 = typeof candidate.base64 === "string" ? candidate.base64 : "";
    if (!name || name.length > 200 || name.includes("/") || name.includes("\\") || name.startsWith(".")) continue;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = cadContentType(ext);
    if (!contentType) continue;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      continue;
    }
    if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) continue;
    collected.push({ name, buffer, extension: ext, contentType });
  }
  return collected;
}

/** Generate CAD files through a separate CAD worker service (e.g. Render, which cannot run docker-in-docker). */
async function runViaWorker(code: string): Promise<CadPythonOutcome> {
  let response: Response;
  try {
    response = await fetch(`${WORKER_URL}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cad-secret": WORKER_SECRET },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(75_000),
    });
  } catch {
    return { ok: false, output: "CAD generation is unavailable: the CAD worker could not be reached. Ask an admin to check the cad-worker service." };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, output: "CAD generation failed: the CAD worker returned an unreadable response." };
  }
  const payload = data as { ok?: unknown; output?: unknown } | null;
  const output = typeof payload?.output === "string" ? payload.output.slice(0, MAX_OUTPUT_CHARS) : "";
  if (!response.ok || !payload || payload.ok !== true) {
    return { ok: false, output: output || "CAD generation failed on the CAD worker." };
  }
  const files = filesFromWorkerResponse(data);
  if (!files.length) {
    return { ok: false, output: `The CAD worker reported success but returned no usable CAD files. Output:\n${output}` };
  }
  return { ok: true, files, output };
}

/**
 * Run model-generated CAD code in the locked-down CAD sandbox. The code is
 * expected to import cadquery/build123d and write one or more CAD files to
 * `/out` (e.g. `/out/model.stl`). Whatever lands there is returned; callers
 * upload the files to team storage.
 */
export async function runCadPython(code: string): Promise<CadPythonOutcome> {
  const trimmed = code.trim().slice(0, MAX_CODE_CHARS);
  if (!trimmed) return { ok: false, output: "No CAD code to run." };
  // A configured worker takes precedence: hosts without docker-in-docker
  // (Render) generate there, local development uses the local docker sandbox.
  if (WORKER_URL) return runViaWorker(trimmed);
  if (dockerState === "unknown") {
    dockerState = (await dockerUsableCad()) ? "yes" : "no";
  }
  if (dockerState === "no") {
    return { ok: false, output: "CAD generation is unavailable on this server (sandbox image not built). Ask an admin to build the cad-sandbox image." };
  }
  const dir = await mkdtemp(path.join(tmpdir(), "cad-out-"));
  // The sandbox writes as uid 65534, so the output dir must be world-writable.
  await chmod(dir, 0o1777);
  try {
    const args = buildCadDockerArgs({ outDir: dir });
    const child = spawn("docker", args, { timeout: DOCKER_TIMEOUT_MS, killSignal: "SIGKILL" });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8").slice(0, MAX_OUTPUT_CHARS);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8").slice(0, 2000);
    });
    const finished: { code: number | null; signal: string | null } = await new Promise((resolve) => {
      if (child.stdin) {
        child.stdin.on("error", () => undefined);
        child.stdin.write(trimmed);
        child.stdin.end();
      }
      child.on("error", () => resolve({ code: -1, signal: null }));
      child.on("close", (exitCode, exitSignal) => resolve({ code: exitCode, signal: exitSignal }));
    });
    if (finished.signal) {
      return { ok: false, output: `The CAD script timed out after ${DOCKER_INNER_TIMEOUT_S}s.` };
    }
    const outcome = classifyExit(finished.code, null, stdout, stderr);
    if (!outcome.ok) return outcome;
    const files = await scanCadOutputDirectory(dir);
    if (!files.length) {
      return { ok: false, output: `The CAD script ran but produced no CAD files. Print the file list it wrote (or nothing). Output:\n${stdout.trim().slice(-500)}` };
    }
    return { ok: true, files, output: stdout.trim() };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
