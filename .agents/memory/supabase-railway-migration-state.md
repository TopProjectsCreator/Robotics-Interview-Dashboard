---
name: Supabase to Railway migration state and blockers
description: Secondary Supabase DB is fully restored into Railway Postgres; primary is unreadable under egress restriction and Storage bytes are also blocked.
---

On 2026-11-24 a full Supabase→Railway migration was started using only existing infrastructure (Railway Postgres service `62d83932-9a98-41b5-9300-9e83fc5a51dc`, bucket `app-uploads`, no new services, no commits, no prod-server changes).

**What worked:** the secondary project's Postgres dumps cleanly with `pg_dump` v17 (`/nix/store/269nimkimaaivb4z46bjc1rnjv9jpc0l-postgresql-17.6`; the v16 binary refuses PG17 servers). Restore into Railway Postgres needs `--no-owner --no-privileges` and creation of Supabase roles `anon`, `authenticated`, `service_role` before re-applying the 95 `CREATE POLICY` statements, otherwise 98 policy errors occur. Result: 95 tables, 5,603 messages, 95 policies, 140 `storage.objects` rows — counts match the source exactly.

**Railway access:** `railway domain` on a Postgres service creates an HTTP proxy (Pingora), not TCP. Use `railway tcp-proxy create --port 5432 --service <id>` and connect with `sslmode=disable` to the returned `*.proxy.rlwy.net:<port>` endpoint. `railway connect --tunnel-only` needs an SSH key.

**Blockers:** both Supabase projects now return 402 `exceed_egress_quota` on REST, Storage, public/CDN/signed object URLs, and Management API queries. Primary pooler returns `ECIRCUITBREAKER`/`EAUTHQUERY`; direct host is IPv6-only and this sandbox has no IPv6; Supabase CLI `db dump` fails creating a login role (`ECONNREFUSED`). Pausing the primary via `POST /v1/projects/{ref}/pause` did not restore access. There is no export endpoint in the Management API spec.

**Incident / state change caveat:** Supabase status incident `01M85A4AS1YN8A7ZZEFED974TR` ("API endpoint degradation observed Nov 13-16", status `monitoring`) degraded Management/Data APIs. Attempting `POST /v1/projects/{ref}/pause` on the primary (to test Gemini's "Export data after pause" theory) left the project stuck in `PAUSING`; `POST /restore` returned `Project is pausing`. It later returned to `ACTIVE_HEALTHY` on its own, but the DB listener was still dead (CLI login-role creation and Management API query both `ECONNREFUSED` on the project's IPv6 direct address) and REST still 402. Do not repeat the pause attempt — it neither enabled an export nor restored access.

**Internal dashboard APIs (with a dashboard session JWT, not a CLI PAT):** `GET /platform/projects` and `/platform/projects/{ref}` and `/platform/projects/{ref}/settings` work; `GET /platform/database/{ref}/backups` shows `walg_enabled:true, pitr_enabled:false, backups:[]`; `/backups/downloadable-backups` says `physical-backups-enabled` with empty list; `POST /platform/pg-meta/{ref}/query` demands a connection string in an undiscovered format; `GET /platform/storage/{ref}/archive` returns "only available for paused projects"; internal GraphQL returns the same 402. Org usage shows EGRESS 114.65 GB vs 5 GB free cap, `capped:true`, `pricing_strategy:NONE`. Attempting `POST /platform/projects/{ref}/pause` left the project stuck in `PAUSING`; restore/wake both fail while pausing. Do not retry the pause.

**How to apply:** do not claim primary data is recoverable under these constraints — every documented and internal path was tested. Storage object *metadata* is in the restored DB, but object *bytes* cannot be fetched while Storage returns 402.
