#!/bin/bash
set -e
CI=true pnpm install --frozen-lockfile

# The API's idempotent startup migrations synchronize both configured
# instances when the workflow is reconciled. Do not use drizzle-kit push here:
# its schema snapshot omits runtime-managed tables/columns and proposes
# destructive drops on the Supabase databases.
pnpm --filter @workspace/api-server run build
echo "Schema synchronization will run through the API startup migrations."
