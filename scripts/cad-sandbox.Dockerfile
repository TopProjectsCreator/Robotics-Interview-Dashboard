# Sandbox for the AI assistant's CAD generation.
#
# A locked-down container the model's Python runs in to build CAD files:
#   - network disabled at runtime
#   - read-only root filesystem, tmpfs /tmp
#   - non-root user, all capabilities dropped
#   - one host directory mounted at /out (the only writable path)
#
# The assistant writes its finished CAD files to /out and they are picked up
# and stored in the team's storage. The model imports cadquery as `cq`; the
# generated files must land in /out (e.g. /out/model.stl).
#
# Build:
#   docker build -t robotics-dashboard/cad-sandbox:latest -f scripts/cad-sandbox.Dockerfile .
#
# Optional pin via PYTHON_CAD_IMAGE (must be built with the same layout).
# Image is ~1.2 GB (OCCT kernel); build it once per machine/runner.
FROM python:3.12-slim

# OCCT (cadquery-ocp) needs OpenGL/glib system libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgl1 libglib2.0-0 libxext6 libxrender1 libsm6 libice6 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Pinned to what the host validated so the sandbox is reproducible.
RUN pip install --no-cache-dir \
    cadquery==2.8.0 \
    cadquery-ocp==7.9.3.1.1

# The sandbox runs as uid/gid 65534 (nobody); /out is mounted world-writable at runtime.
USER 65534:65534

WORKDIR /tmp

# No ENTRYPOINT: the API passes the full locked-down command (timeout + python)
# in `docker run`; baking an entrypoint here would shadow the inner timeout.
