#!/usr/bin/env python3
"""CAD worker: run model-generated cadquery code in a locked-down subprocess.

Render (and other PaaS hosts) cannot run docker-in-docker, so the API server
cannot spawn the local docker sandbox there. Instead, this service IS the
sandbox: it runs as its own container with no secrets in its environment
(no Supabase keys, no admin passwords, nothing to exfiltrate), a non-root
user, rlimits on the child process, and a hard timeout.

Protocol:
  GET  /healthz                        -> 200 {"ok": true}
  POST /generate  {"code": "<python>"}  -> 200
      {"ok": true, "output": "...",
       "files": [{"name": "model.stl", "extension": "stl",
                  "contentType": "model/stl", "base64": "..."}]}

Callers authenticate with the CAD_WORKER_SECRET env var sent as the
X-Cad-Secret header (constant-time compared). If the secret is unset the
service refuses every request, failing closed.

Network egress from the child is removed only when the kernel permits user
namespaces (unshare -Urn) — probed once at startup; otherwise the child
keeps network access. That is a tolerable residual risk because the worker
holds no credentials, but do not add secrets to its environment.
"""

import base64
import glob
import hmac
import json
import os
import re
import resource
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "10000"))
SECRET = os.environ.get("CAD_WORKER_SECRET", "")

MAX_CODE_CHARS = 20_000
MAX_BODY_BYTES = 96 * 1024
MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_FILES = 8
TIMEOUT_SECONDS = 45

CONTENT_TYPES = {
    "stl": "model/stl",
    "step": "model/step",
    "stp": "model/step",
    "iges": "model/iges",
    "brep": "model/brep",
    "obj": "model/obj",
    "off": "model/off",
    "3mf": "model/3mf",
    "glb": "model/gltf-binary",
}
OUT_DIR = "/out"

# One /generate runs at a time. The model writes to the shared /out directory
# (its absolute path is baked into the cadquery exports), so concurrent runs
# would clobber each other's files.
run_lock = threading.Lock()


def clean_out() -> None:
    try:
        entries = os.listdir(OUT_DIR)
    except FileNotFoundError:
        os.makedirs(OUT_DIR, 0o1777, exist_ok=True)
        return
    for entry in entries:
        path = os.path.join(OUT_DIR, entry)
        try:
            if os.path.isfile(path) or os.path.islink(path):
                os.remove(path)
            elif os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
        except OSError:
            pass


def set_rlimits() -> None:
    limits = [
        (resource.RLIMIT_CPU, TIMEOUT_SECONDS + 5),
        (resource.RLIMIT_FSIZE, MAX_FILE_BYTES),
        (resource.RLIMIT_NOFILE, 256),
        (resource.RLIMIT_NPROC, 256),
    ]
    for which, value in limits:
        try:
            resource.setrlimit(which, (value, value))
        except (ValueError, OSError):
            pass


CHILD_ENV = {
    "PATH": "/usr/local/bin:/usr/bin:/bin",
    "HOME": "/tmp",
    "LANG": "C.UTF-8",
    "PYTHONDONTWRITEBYTECODE": "1",
    "PYTHONNOUSERSITE": "1",
}


# Cached probe: whether this kernel permits userns+network-namespace isolation.
unshare_ok: bool | None = None


def unshare_works() -> bool:
    global unshare_ok
    if unshare_ok is not None:
        return unshare_ok
    if not shutil.which("unshare"):
        unshare_ok = False
        return unshare_ok
    try:
        completed = subprocess.run(
            ["unshare", "-Urn", "true"],
            timeout=5,
            env=CHILD_ENV,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        unshare_ok = completed.returncode == 0
    except Exception:
        unshare_ok = False
    return unshare_ok


def run_python(argv: list[str], code: str) -> tuple[subprocess.CompletedProcess | None, bool]:
    """Run python with the given argv; return (result, network_disabled)."""
    kwargs = dict(
        input=code,
        capture_output=True,
        text=True,
        timeout=TIMEOUT_SECONDS,
        env=CHILD_ENV,
        preexec_fn=set_rlimits,
        cwd="/tmp",
    )
    if unshare_works():
        # Best effort: the child gets no network at all.
        return subprocess.run(["unshare", "-Urn", *argv], **kwargs), True
    return subprocess.run(argv, **kwargs), False


def collect_files() -> list[dict]:
    files = []
    for path in glob.glob(os.path.join(OUT_DIR, "*.*")):
        name = os.path.basename(path)
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if ext not in CONTENT_TYPES:
            continue
        try:
            size = os.stat(path).st_size
        except OSError:
            continue
        if size == 0 or size > MAX_FILE_BYTES:
            continue
        try:
            with open(path, "rb") as handle:
                data = handle.read()
        except OSError:
            continue
        files.append({
            "name": name,
            "extension": ext,
            "contentType": CONTENT_TYPES[ext],
            "base64": base64.b64encode(data).decode("ascii"),
        })
    files.sort(key=lambda item: item["name"])
    return files[:MAX_FILES]


def generate(code: str) -> dict:
    with run_lock:
        clean_out()
        network_disabled = False
        try:
            result, network_disabled = run_python(["python3", "-I", "-"], code)
        except subprocess.TimeoutExpired:
            return {"ok": False, "output": f"The CAD script timed out after {TIMEOUT_SECONDS}s."}
        except Exception as error:  # noqa: BLE001 — report any launch failure honestly
            return {"ok": False, "output": f"The CAD worker could not start the sandbox: {error}"}
        assert result is not None
        stdout = (result.stdout or "")[-4000:]
        stderr = (result.stderr or "")[-2000:]
        if result.returncode != 0:
            detail = stderr.strip() or stdout.strip()
            return {"ok": False, "output": f"CAD generation failed.\n{detail[-1500:]}"}
        files = collect_files()
        note = " (network disabled)" if network_disabled else ""
        if not files:
            return {
                "ok": False,
                "output": f"The CAD script ran but wrote no CAD files to /out.{note}\nOutput:\n{stdout.strip()[-500:]}",
            }
        return {"ok": True, "output": stdout.strip() + note, "files": files}


class Handler(BaseHTTPRequestHandler):
    server_version = "CadWorker/1.0"

    def log_message(self, format: str, *args) -> None:  # noqa: A002 — stdlib signature
        pass  # quiet logs; secrets must never land in access logs

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/generate":
            self._send_json(404, {"ok": False, "error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send_json(413, {"ok": False, "error": "payload too large"})
            return
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"ok": False, "error": "invalid JSON"})
            return
        if not SECRET:
            # Fail closed: without a shared secret anyone could invoke the worker.
            self._send_json(503, {"ok": False, "error": "worker is not configured"})
            return
        provided = self.headers.get("X-Cad-Secret", "")
        if not hmac.compare_digest(provided, SECRET):
            self._send_json(403, {"ok": False, "error": "forbidden"})
            return
        code = str(body.get("code") or "").strip()[:MAX_CODE_CHARS]
        if not code:
            self._send_json(400, {"ok": False, "error": "no code provided"})
            return
        self._send_json(200, generate(code))


if __name__ == "__main__":
    os.makedirs(OUT_DIR, 0o1777, exist_ok=True)
    clean_out()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"cad-worker listening on :{PORT}", flush=True)
    server.serve_forever()
