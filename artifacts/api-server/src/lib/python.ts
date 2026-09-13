import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const DOCKER_TIMEOUT_MS = 30000;
const DOCKER_INNER_TIMEOUT_S = 25;
const RESTRICTED_TIMEOUT_MS = 10000;
const MAX_CODE_CHARS = 4000;
const MAX_OUTPUT_CHARS = 6000;
const DOCKER_IMAGE = process.env.PYTHON_SANDBOX_IMAGE || "python:3.12-slim";

// Restricted fallback: pure-computation modules only. Used when Docker is
// unavailable (e.g. hosts without a daemon). Everything else is blocked.
const ALLOWED_MODULES = new Set([
  "math",
  "statistics",
  "datetime",
  "json",
  "re",
  "collections",
  "itertools",
  "functools",
  "decimal",
  "fractions",
  "string",
  "operator",
  "heapq",
  "bisect",
  "csv",
  "pprint",
  "textwrap",
  "copy",
  "dataclasses",
  "enum",
  "typing",
  "unicodedata",
  "keyword",
  "reprlib",
  "numbers",
]);

const RESTRICTED_PREAMBLE = `import json as _json
import sys as _sys
import builtins as _builtins
import resource as _resource
try:
    applicants = _json.loads(_sys.argv[1])
except Exception:
    applicants = []
try:
    _resource.setrlimit(_resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
except Exception:
    pass
_allowed_modules = ${JSON.stringify([...ALLOWED_MODULES])}
_scrub_names = {"os", "posix", "nt", "subprocess", "socket", "ssl", "shutil", "pathlib", "tempfile", "runpy", "pkgutil", "pydoc", "webbrowser", "ctypes", "mmap", "signal", "fcntl", "select", "selectors", "asyncio", "concurrent", "multiprocessing", "sqlite3", "dbm", "gdbm", "shelve", "pickle", "_pickle", "marshal", "resource", "pwd", "grp", "crypt", "syslog", "urllib", "http", "ftplib", "smtplib", "poplib", "imaplib", "telnetlib", "xmlrpc", "wsgiref", "cgi", "cgitb", "venv", "ensurepip", "zipapp", "pdb", "bdb", "code", "codeop", "pty", "tty", "termios", "readline", "rlcompleter", "turtle"}
def _scrub_modules(_sys=_sys, _scrub_names=_scrub_names):
    for _name in list(_sys.modules.keys()):
        if _name.split(".")[0] in _scrub_names:
            del _sys.modules[_name]
_real_import = _builtins.__import__
_getframe = _sys._getframe
_snippet_file = __file__
def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0, _getframe=_getframe, _snippet=_snippet_file, _real=_real_import, _allowed=_allowed_modules, _scrub=_scrub_modules):
    top = name.split(".")[0] if isinstance(name, str) else ""
    try:
        _frame = _getframe(1)
    except Exception:
        _frame = None
    direct = False
    if _frame is not None:
        try:
            _g = _frame.f_globals
            _is_main = isinstance(_g, dict) and _g.get("__name__") == "__main__"
            _dyn = _frame.f_code.co_filename in ("<string>", "<stdin>", "<unknown>")
            direct = bool(_is_main or _dyn)
        except Exception:
            direct = True
    if (not direct) or (top in _allowed):
        # NOTE: no sys.modules scrubbing here — deleting entries mid-flight
        # breaks the import machinery (KeyError inside _bootstrap). The
        # preamble scrubs once at startup; later arrivals (e.g. os via
        # statistics→random) are unreachable without imports, which stay guarded.
        return _real(name, globals, locals, fromlist, level)
    raise ImportError("module '%s' is not available in the restricted sandbox (Docker unavailable on this host)" % (name,))
_builtins.__import__ = _guarded_import
_builtins.open = None
_scrub_modules()
del _json, _sys, _builtins, _resource, _real_import, _getframe, _snippet_file, _scrub_modules, _guarded_import
`;

const DOCKER_PREAMBLE = `import json as _json
import sys as _sys
try:
    applicants = _json.loads(_sys.argv[1])
except Exception:
    applicants = []
`;

export type PythonExecOutcome = {
  ok: boolean;
  output: string;
  sandbox: "docker" | "restricted";
};

let dockerState: "unknown" | "yes" | "no" = "unknown";

async function runLocal(
  command: string,
  args: string[],
  input: string | null,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number | null; signal: string | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { timeout: timeoutMs, killSignal: "SIGKILL" });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8").slice(0, MAX_OUTPUT_CHARS);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8").slice(0, 2000);
    });
    child.on("error", (error) => resolve({ stdout, stderr: String(error), code: -1, signal: null }));
    child.on("close", (exitCode, exitSignal) => resolve({ stdout, stderr, code: exitCode, signal: exitSignal }));
    if (input !== null && child.stdin) {
      child.stdin.on("error", () => undefined);
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

async function dockerUsable(): Promise<boolean> {
  if (process.env.PYTHON_SANDBOX === "restricted") return false;
  if (process.env.PYTHON_SANDBOX === "docker") return true;
  if (dockerState !== "unknown") return dockerState === "yes";
  try {
    const probe = await new Promise<boolean>((resolve) => {
      const child = spawn("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 8000 });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
    if (!probe) {
      dockerState = "no";
      return false;
    }
    const inspect = await runLocal("docker", ["image", "inspect", DOCKER_IMAGE, "--format", "{{.Id}}"], null, 15000);
    dockerState = inspect.code === 0 ? "yes" : "no";
    return dockerState === "yes";
  } catch {
    dockerState = "no";
    return false;
  }
}

function dockerFailed(stderr: string): boolean {
  return /^(docker:|Error response|Cannot connect|unable to|no such image|permission denied)/im.test(stderr.trim());
}

async function runDocker(code: string, applicantsJson: string): Promise<PythonExecOutcome | null> {
  const name = `assistant-py-${randomUUID().slice(0, 8)}`;
  const script = `${DOCKER_PREAMBLE}\n${code}\n`;
  const args = [
    "run", "--rm", "-i",
    "--name", name,
    "--network", "none",
    "--memory", "512m",
    "--memory-swap", "512m",
    "--cpus", "1",
    "--pids-limit", "64",
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    "--user", "65534:65534",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges=true",
    "-e", "HOME=/tmp",
    "-e", "PYTHONDONTWRITEBYTECODE=1",
    "-e", "PYTHONNOUSERSITE=1",
    DOCKER_IMAGE,
    "timeout", "-s", "KILL", String(DOCKER_INNER_TIMEOUT_S),
    "python", "-I", "-", applicantsJson.slice(0, 200000),
  ];
  const child = spawn("docker", args, { timeout: DOCKER_TIMEOUT_MS, killSignal: "SIGKILL" });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8").slice(0, MAX_OUTPUT_CHARS);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8").slice(0, 2000);
  });
  if (child.stdin) {
    child.stdin.on("error", () => undefined);
    child.stdin.write(script);
    child.stdin.end();
  }
  const finished: { code: number | null; signal: string | null } = await new Promise((resolve) => {
    child.on("error", () => resolve({ code: -1, signal: null }));
    child.on("close", (exitCode, exitSignal) => resolve({ code: exitCode, signal: exitSignal }));
  });
  if (finished.signal) {
    runLocal("docker", ["rm", "-f", name], null, 10000).catch(() => undefined);
    return { ok: false, output: `Python timed out after ${DOCKER_INNER_TIMEOUT_S}s.`, sandbox: "docker" };
  }
  if (finished.code !== 0) {
    if (dockerFailed(stderr)) return null;
    if (finished.code === 137 && !stderr.trim() && !stdout.trim()) {
      return { ok: false, output: `Python timed out after ${DOCKER_INNER_TIMEOUT_S}s.`, sandbox: "docker" };
    }
    const detail = stdout.trim();
    return { ok: false, output: `Python failed (${stderr.trim().slice(0, 500)}).${detail ? ` Partial output:\n${detail}` : ""}`.slice(0, MAX_OUTPUT_CHARS), sandbox: "docker" };
  }
  const text = stdout.trim();
  return { ok: true, output: (text || "(no output)").slice(0, MAX_OUTPUT_CHARS), sandbox: "docker" };
}

let prlimitState: "unknown" | "yes" | "no" = "unknown";

async function prlimitAvailable(): Promise<boolean> {
  if (prlimitState !== "unknown") return prlimitState === "yes";
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn("prlimit", ["--version"], { timeout: 8000 });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
    prlimitState = ok ? "yes" : "no";
  } catch {
    prlimitState = "no";
  }
  return prlimitState === "yes";
}

async function runRestricted(code: string, applicantsJson: string): Promise<PythonExecOutcome> {
  const trimmed = code.trim().slice(0, MAX_CODE_CHARS);
  if (!trimmed) return { ok: false, output: "No code to run.", sandbox: "restricted" };
  let dir = "";
  try {
    dir = await mkdtemp(path.join(tmpdir(), "assistant-py-"));
    const scriptPath = path.join(dir, "snippet.py");
    await writeFile(scriptPath, `${RESTRICTED_PREAMBLE}\n${trimmed}\n`, "utf8");
    const usePrlimit = await prlimitAvailable();
    const command = usePrlimit ? "prlimit" : "python3";
    const args = usePrlimit
      ? ["--nproc=64:64", "--as=536870912:536870912", "--", "python3", "-I", scriptPath, applicantsJson.slice(0, 200000)]
      : ["-I", scriptPath, applicantsJson.slice(0, 200000)];
    const output = await new Promise<{ stdout: string; stderr: string; code: number | null; signal: string | null }>((resolve) => {
      let settled = false;
      const done = (value: { stdout: string; stderr: string; code: number | null; signal: string | null }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const child = spawn(command, args, {
        cwd: dir,
        detached: true,
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C.UTF-8", PYTHONNOUSERSITE: "1" },
      });
      // Kill the whole process group so forked grandchildren die too.
      const timer = setTimeout(() => {
        try {
          if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        } catch {
          // Already gone.
        }
        done({ stdout, stderr, code: null, signal: "SIGKILL" });
      }, RESTRICTED_TIMEOUT_MS);
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8").slice(0, MAX_OUTPUT_CHARS);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8").slice(0, 2000);
      });
      child.on("error", () => done({ stdout, stderr: "Python is not available on this server.", code: -1, signal: null }));
      child.on("close", (exitCode, exitSignal) => done({ stdout, stderr, code: exitCode, signal: exitSignal }));
    });
    if (output.code !== 0) {
      const reason = output.signal
        ? `timed out after ${RESTRICTED_TIMEOUT_MS / 1000}s`
        : output.stderr.trim() || ` exited with code ${output.code}`;
      const detail = output.stdout.trim();
      return { ok: false, output: `Python failed (${reason}).${detail ? ` Partial output:\n${detail}` : ""}`.slice(0, MAX_OUTPUT_CHARS), sandbox: "restricted" };
    }
    const text = output.stdout.trim();
    return { ok: true, output: (text || "(no output)").slice(0, MAX_OUTPUT_CHARS), sandbox: "restricted" };
  } catch (error) {
    return { ok: false, output: `Python could not run: ${error instanceof Error ? error.message : String(error)}`, sandbox: "restricted" };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Run model-generated Python for data analysis. The applicant records are
 * preloaded as the `applicants` variable (a list of dicts); whatever the
 * code prints to stdout is returned, truncated.
 *
 * Two tiers: Docker (full standard library in a locked-down container —
 * no network, 512MB RAM, read-only FS, non-root, no capabilities) when a
 * daemon with the sandbox image is available; otherwise a restricted
 * subprocess (import allowlist, no open(), 10s timeout). Coordinator-only.
 */
export async function runPythonCode(code: string, applicantsJson: string): Promise<PythonExecOutcome> {
  const trimmed = code.trim().slice(0, MAX_CODE_CHARS);
  if (!trimmed) return { ok: false, output: "No code to run.", sandbox: "restricted" };
  if (await dockerUsable()) {
    const outcome = await runDocker(trimmed, applicantsJson);
    if (outcome) return outcome;
  }
  return runRestricted(trimmed, applicantsJson);
}
