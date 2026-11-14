# syntax=docker/dockerfile:1
# Production image for the Robotics Interview Dashboard.
# The API server serves the built frontend statically, so a single
# service hosts the whole app (API + SPA) from one origin.

# ---------- build stage ----------
FROM node:24-bookworm AS build
WORKDIR /app

# pnpm, matching the version used in development (see pnpm-lock.yaml v9).
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Rust toolchain for the bundled CAD converter native binaries
# (artifacts/api-server/native/cadconvert). build.mjs would install
# rustup on demand; pre-installing keeps builds deterministic.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates build-essential pkg-config \
 && rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh \
 && sh /tmp/rustup-init.sh -y --default-toolchain stable --profile minimal \
 && rm /tmp/rustup-init.sh
ENV PATH="/root/.cargo/bin:${PATH}"

# Workspace manifests first so dependency install stays cached
# across source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY artifacts/robotics-chat-tutorial/package.json artifacts/robotics-chat-tutorial/package.json
COPY artifacts/robotics-interview-dashboard/package.json artifacts/robotics-interview-dashboard/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/integrations-openai-ai-react/package.json lib/integrations-openai-ai-react/package.json
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/package.json
COPY lib/object-storage-web/package.json lib/object-storage-web/package.json
COPY scripts/package.json scripts/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# Frontend build (Vite requires PORT and BASE_PATH). The ~5.6k-module
# bundle exceeds Node's default 2 GB heap, so raise the cap for the build.
ENV PORT=5173 BASE_PATH=/ NODE_OPTIONS=--max-old-space-size=4096
RUN pnpm --filter @workspace/robotics-interview-dashboard run build

# API build (esbuild bundle + Rust native converter).
RUN pnpm --filter @workspace/api-server run build

# ---------- runtime stage ----------
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

# Layout mirrors the repo so the API's relative path resolution
# (../../robotics-interview-dashboard/dist/public) finds the frontend.
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/robotics-interview-dashboard/dist ./artifacts/robotics-interview-dashboard/dist

# Railway injects PORT; the server refuses to boot without it.
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
