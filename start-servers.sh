#!/usr/bin/env bash
# Bring up the Robotics Interview Dashboard after a codespace wake.
# Usage: ./start-servers.sh
set -u
cd "$(dirname "$0")"

# Secrets (DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, Supabase keys)
set -a
# shellcheck source=/dev/null
source ./.env
set +a

# Free-tier defaults (not secret)
export AI_INTEGRATIONS_OPENAI_BASE_URL="${AI_INTEGRATIONS_OPENAI_BASE_URL:-https://api.kilo.ai/api/openrouter}"
export AI_INTEGRATIONS_OPENAI_API_KEY="${AI_INTEGRATIONS_OPENAI_API_KEY:-anonymous}"
export AI_ASSISTANT_MODEL="${AI_ASSISTANT_MODEL:-minimax/minimax-m3.1-flash:free}"
export DISABLE_DEMO_SEED="${DISABLE_DEMO_SEED:-true}"
export NODE_ENV=development
export PORT=8080

# Clear stale servers from a previous run
pkill -f "dist/index.mjs" 2>/dev/null || true
pkill -f "vite --config vite.codespaces.ts" 2>/dev/null || true
sleep 2

nohup pnpm --filter @workspace/api-server run start > /tmp/api.log 2>&1 &
echo "api pid $!"
export PORT=5173 BASE_PATH=/
nohup pnpm --filter @workspace/robotics-interview-dashboard exec vite --config vite.codespaces.ts --host 0.0.0.0 > /tmp/vite.log 2>&1 &
echo "vite started"

sleep 12
echo "--- health ---"
curl -s -m 10 -o /dev/null -w "api:%{http_code}\n" http://localhost:8080/api/healthz
curl -s -m 10 -o /dev/null -w "vite:%{http_code}\n" http://localhost:5173/attendance
