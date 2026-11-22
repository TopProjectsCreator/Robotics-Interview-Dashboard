---
name: Supabase egress diagnosis without a usage endpoint
description: The Management API has no egress-bytes route; attribute egress with node network counters plus pg_stat_statements and compare against real account counts.
---

Supabase's Management API (`api.supabase.com/v1`, PAT auth) has **no endpoint returning egress bytes**. `/platform/projects/{ref}/usage` rejects a CLI PAT with `Unsupported access token`; the OpenAPI spec (`https://api.supabase.com/api/v1-json`) only exposes `analytics/endpoints/metrics` (Prometheus text) and `usage.api-counts` / `usage.api-requests-count` (request counts, not bytes).

**Why:** The team project returned HTTP 402 from the metrics endpoint with `exceed_egress_quota`, while `/v1/projects/{ref}` still reported `ACTIVE_HEALTHY`. A separate project's network metrics showed database egress far out of proportion to API-gateway requests, pointing to direct Postgres/Supavisor traffic rather than REST or Storage.

**How to apply:** To attribute egress: (1) call `/v1/projects/{ref}/analytics/endpoints/metrics` with each profile's PAT and read `node_boot_time_seconds` to get a bytes/day rate; (2) use `usage.api-counts` to rule out gateway traffic; (3) query `pg_stat_statements` ordered by `calls` and by `rows`, taking two snapshots about 10 seconds apart for the live rate, and multiply by `pg_column_size` of the polled table to estimate volume. Compare the result with the size of the active team and account population. A 402 on the metrics endpoint is itself the egress-restriction signal.
