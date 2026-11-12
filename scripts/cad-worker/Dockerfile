# CAD worker service for hosts without docker-in-docker (e.g. Render).
#
# The Node API server calls this service over the private network with a
# shared secret. This container IS the sandbox: it holds no secrets, runs
# the model's cadquery code as a locked-down subprocess (no network when
# the kernel permits user namespaces, rlimits, a hard timeout, non-root),
# and returns the produced CAD files as base64.
#
# Deploy on Render as a *private service* (see render.yaml / replit.md):
#   - runtime: docker, plan: starter (private services need a paid plan)
#   - health check: /healthz
#   - env: CAD_WORKER_SECRET (set on this service AND on the API service)
#
# Local smoke test:
#   docker build -t robotics-dashboard/cad-worker:latest -f scripts/cad-worker/Dockerfile .
#   docker run --rm -p 10000:10000 -e CAD_WORKER_SECRET=testsecret robotics-dashboard/cad-worker:latest
#   curl -s localhost:10000/healthz
FROM python:3.12-slim

# OCCT (cadquery-ocp) needs OpenGL/glib system libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgl1 libglib2.0-0 libxext6 libxrender1 libsm6 libice6 libgomp1 util-linux \
    && rm -rf /var/lib/apt/lists/*

# Pinned to what the host validated so the worker is reproducible.
RUN pip install --no-cache-dir \
    cadquery==2.8.0 \
    cadquery-ocp==7.9.3.1.1

# The model writes its finished files to /out (the only shared path). /out is
# world-writable and shared across runs; the worker serializes runs and
# cleans the directory before and after each one.
RUN mkdir -p /out && chmod 1777 /out

COPY scripts/cad-worker/server.py /app/server.py

USER 65534:65534
WORKDIR /tmp

EXPOSE 10000
CMD ["python3", "/app/server.py"]
