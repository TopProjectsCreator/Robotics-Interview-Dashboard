# Robotics Dashboard — project notes

Operational companion to `README.md`. `README.md` is the product-facing overview; this file keeps run commands, the environment reference, repository map, architecture decisions, a complete shipped-feature checklist, and gotchas. Code and routers are authoritative; documentation is not.

Private, multi-tenant software for robotics teams: chat, collaborative documents, parts, CAD, FTC code, AI assistant, AI-built custom apps, one login per isolated team silo. Built by Team 23442 (the Wolverines); free for FTC teams.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server
- From the web app package directory, `pnpm run dev` — team web app
- `pnpm --filter @workspace/robotics-chat-tutorial run dev` — robotics chat tutorial video artifact
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks and Zod schemas from OpenAPI
- Database schema changes belong in the API's idempotent startup migrations. Do not run `drizzle-kit push` against the configured Supabase databases: its schema snapshot omits runtime-managed tables and columns, so it proposes destructive drops.
- `pnpm --filter @workspace/api-server run typecheck` — server type check
- From the web app package directory, `pnpm run typecheck` — frontend type check
- From the web app package directory, `PORT=5173 BASE_PATH=/ pnpm run build` — production frontend build
- `pnpm lint` — ESLint across the workspace

CAD generation setup (the assistant's `generate_cad_model` tool, see `artifacts/api-server/src/lib/cadPython.ts`): two backends exist — the API picks based on environment. Local development spawns Docker (`docker build -t robotics-dashboard/cad-sandbox:latest -f scripts/cad-sandbox.Dockerfile .`; `python:3.12-slim` + OCCT). Render has no Docker-in-Docker, so there you deploy a separate **private service** built from `scripts/cad-worker/Dockerfile`. That worker holds no secrets — no Supabase or admin credentials exist inside its environment — and it runs model code as a locked-down subprocess (resource limits, a hard timeout, non-root; network is removed when the kernel permits user namespaces, otherwise it keeps network access). `render.yaml` declares only the worker; the existing API service is untouched. Render setup: create the `cad-worker` private service from that Dockerfile (health check `/healthz`), set `CAD_WORKER_SECRET` on it, then set `CAD_WORKER_URL=http://cad-worker:10000` and the same `CAD_WORKER_SECRET` on the API service. Alternatively apply `render.yaml` as a Blueprint to create only the worker, then set the two variables on the API service.

Environment:

- `PRIMARY_DATABASE_URL` — optional primary PostgreSQL connection override; use this for a separate primary Supabase project without replacing Replit's runtime-managed `DATABASE_URL`
- `DATABASE_URL` — PostgreSQL connection fallback when `PRIMARY_DATABASE_URL` is not set
- `ADMIN_PASSWORD` — server-side admin passcode
- `SESSION_SECRET` — session signing secret (required in production); also the fallback key for BYOK credential encryption
- `AI_BYOK_ENCRYPTION_KEY` — preferred AES-256-GCM key for provider/MCP credentials
- `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` — optional OpenAI-compatible provider overrides; the checked-in default is Kilo's keyless OpenRouter route with the `anonymous` key
- `AI_ASSISTANT_MODEL` — general-purpose assistant model override (default `minimax/minimax-m3.1-flash:free`, catalog label “MiniMax: MiniMax M3.1 Flash (free)”)
- `DISABLE_DEMO_SEED` — set `true` to stop sample data from seeding an empty database
- `ALLOWED_ORIGINS` — comma-separated origins allowed to call the API (default reflects any origin for iframe embedding; lock down in production)
- `PYTHON_SANDBOX` — `auto` (default), `docker` (full standard library, needs daemon + `python:3.12-slim` image), or `restricted`
- `PYTHON_CAD_IMAGE` — optional override for the local Docker sandbox image used by `generate_cad_model` (default `robotics-dashboard/cad-sandbox:latest`; build with `docker build -t robotics-dashboard/cad-sandbox:latest -f scripts/cad-sandbox.Dockerfile .`). Ignored when `CAD_WORKER_URL` is set.
- `CAD_WORKER_URL` — when set, `generate_cad_model` sends model CadQuery code to this worker instead of spawning Docker. This is the production path for Render, which cannot run Docker-in-Docker (for example, `http://cad-worker:10000`).
- `CAD_WORKER_SECRET` — shared secret sent to the worker as the `X-Cad-Secret` header; it is also required on the worker, which fails closed when unset.
- `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `EXA_API_KEY`, `PARALLEL_API_KEY` — optional provider keys for expanded web-research limits; these providers also support keyless use
- `POLLINATIONS_API_KEY` — optional, server-only, never expose to the frontend. Authenticates image generation (honors `nologo`, higher RPM). Falls back to anonymous automatically on 401/402 with an hourly retry. Rotate immediately if ever pasted anywhere.
- `POLLINATIONS_IMAGE_MODEL` — image model name (default `z-image-turbo`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (default `app-uploads`) — Supabase Storage for private team files, profile photos, and CAD uploads
- `SECONDARY_DATABASE_URL`, `SECONDARY_SUPABASE_URL`, `SECONDARY_SUPABASE_SECRET_KEY`, `SECONDARY_SUPABASE_STORAGE_BUCKET` — secondary team database and storage instance; secondary storage also supports CAD upload failover

## Stack

- pnpm workspaces, TypeScript, Express 5, React + Vite
- PostgreSQL + Drizzle ORM; Supabase Postgres, Storage, and Realtime with session-routed primary/secondary instances and failover
- OpenAPI + Orval-generated React Query hooks and Zod schemas
- Tailwind CSS, Space Grotesk, DM Mono, Lucide, Wouter
- Kilo's OpenAI-compatible OpenRouter route for assistant answers and natural-language chat scheduling; Pollinations for generated images
- TipTap/Yjs for documents, Yjs for code, Excalidraw for whiteboards, browser-side OCCT/WASM and three.js CAD viewers, chunked private-file uploads
- OpenTelemetry auto-instrumentation traces exported in production

Rust/Cargo 1.85 or newer is required for the API build; it compiles the bundled local converter used for large X_T chat previews.

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth API contract; regenerate typed client hooks and Zod schemas after changes
- `lib/api-client-react` and `lib/api-zod` — generated client hooks and validation schemas; `lib/api-zod/src/settingsCapabilities.ts` defines the settings-assistant capability IDs
- `lib/db/src/schema` — team, account, chat, collaboration, CAD, code, parts, assessment, custom workspace, and settings tables
- `artifacts/api-server/src/routes/auth.ts` and `src/middlewares/adminAuth.ts` — account sessions, team routing, and server-enforced access
- `artifacts/api-server/src/routes/robotics.ts` — chat, scheduled messages, collaborative objects, assistant tools/policies/usage, and image generation
- `artifacts/api-server/src/routes/cad.ts`, `code.ts`, `customWorkspaces.ts`, `parts.ts`, and `storage.ts` — engineering workspaces, custom apps, and private file handling
- `artifacts/api-server/src/routes/teamAssessments.ts` — quizzes/surveys, assignments, submissions, and results
- `artifacts/api-server/src/routes/featureRequests.ts`, `tinyUrls.ts`, `presence.ts`, `broadcasts.ts`, `ftcEvents.ts`, `events.ts`, and `sitemap.ts` — operations, live presence, public FTC data, SSE hints, and sitemap
- `artifacts/api-server/src/lib/partsVendors.ts` — the 15-supplier registry for the parts workspace (feed-sync, sitemap-crawl, and seed-backed vendors); `src/lib/vendorCatalogSeeds.ts` and `*CatalogSeed.ts` register hand-collected catalogs (REV Robotics, Studica, Axon, BWTLink, Offset Robotics, Platypus Robotics), which merge into the shared catalog on every sync and bootstrap the sitemap-crawl vendors' first pass; `src/lib/platypusRoboticsCatalogSeed.ts` holds all 274 Platypus Robotics products (Wix store, `store-products-sitemap.xml` + per-page JSON-LD); `src/lib/ucpCatalog.ts` drives WestCoast Products and Limelight Vision (both publish `/.well-known/ucp`): every sync browses the supplier's UCP catalog API (`/api/ucp/mcp`, `dev.ucp.shopping.catalog.search`, two passes — in-stock and out-of-stock/discontinued) so the synced catalog carries live per-variant price, currency, and `stock_status` (`in_stock`/`backorder`/`out_of_stock`/...). The platform agent profile is served by the API at `/ucp-agent-profile.json` (inline JSON, public), and the deployment learns its public origin from request headers (`x-forwarded-host`/`proto`, persisted to `parts_catalog_sync_state.public_origin`), so catalog sync works on any domain without per-deployment configuration; `products.json` is only a fallback if UCP is unreachable
- `artifacts/api-server/scripts/import-rev-catalog.mjs` — idempotent catalog seed importer (`pnpm run import:rev-catalog [vendorKey]`); run against the secondary database, which holds the shared live catalog
- `artifacts/api-server/src/lib` — `assistantTools`, `assistantPrompts`, `assistantModel`, `assistantToolPolicy`, `assistantUsage`, `assistantSkills`, `assistantGitHub`, `customMcp`, `workspaceScript`, `chatExport`, `chatProductivityAnalysis`, `chatRevisions`, `privateObjectReferences`, `codeCollaboration`, `cadPython`, `instanceFailover`, and `ftcEvents`
- In the web app source, `src/App.tsx` — application shell, settings, account menu, chat, workspace navigation, and routes
- In the web app source, `src/pages` — public/marketing/legal/error pages, `PartsPage`, `CadWorkspacePage`, `CodeWorkspacePage`, `TeamAssessmentsPage`, `CustomWorkspacesPage`, `CustomWorkspaceAppPage`, and `RecurringTasksPage`
- In the web app source, `src/components` — document/sheet/board/calendar/whiteboard editors, CAD and chat file viewers, assistant model/provider/governance/skill/MCP UI, and settings panels
- In the web app source, `src/index.css` — shared light/dark visual system

## Architecture decisions

- Team access uses server-verified accounts and signed sessions, with password and passkey sign-in. Do not add a second authentication provider without an explicit product decision.
- Teams are routed to primary or secondary Supabase instances from their signed session. Keep team data isolation and server-side workspace authorization intact; the server keeps serving when primary is down and secondary is ready.
- Workspace access is configured in Settings and enforced by the server. Filter navigation from those settings; do not hardcode role-based workspace visibility in the UI.
- Scheduled chat and recurring tasks interpret natural-language times with the existing assistant model in the user's local timezone and keep them editable; DST gaps and fall-back have explicit rules.
- Large CAD/chat uploads use signed chunk URLs and 40 MB chunks. Keep the storage instance in the object path so previews, downloads, and deletion read from the bucket that received the upload.
- Collaborative documents, whiteboards, and code must persist changes before broadcasting them to other sessions; SSE carries table-name hints only, never row payloads.
- Imports, uploads, pasted snippets, skill text, and MCP/tool results are untrusted data; AI-facing prompts must preserve that boundary.
- Custom apps are isolated by team, sandboxed with a CSP that forbids network/frames/forms, and run with only the capabilities their published manifest grants; builder output is not publishable until independent critique and verification rounds pass.
- Published assessments assign required work server-side; pause before editing to keep submitted responses immutable.

## Feature checklist

Everything below ships in code. Details live in `README.md`.

- **Teams/access** — isolated silos; team-creation wizard with generated codes; password + passkey sign-in with key/origin metadata; breached-password acknowledgement; failed-attempt and creation rate limits; custom roles and workspace matrix; name rules; access-code rotation; IP blocklist; site-owner team deletion and diagnostics.
- **Dashboard/settings** — numbered workspace cards; bar/pie/line charts; dry-run snapshot restore; 30/366-day workspace analytics; eight searchable settings tabs; ten-card Operations tab; branding (color, logo, up to ten backgrounds with fit/overlay/rotation); settings assistant with signed confirmations; chat slow-mode and multimessage caps; team inbox; parts order limit; CAD icon policy; TinyURLs; feature requests; site stats; reset/refresh.
- **Chat** — team/DM/invite-only channels and deep links; Markdown with sanitized SVG, safe tables, and `<iframe>` embeds; attachments, chunked uploads, voice messages and dictation, local drafts, formatting toolbar and keyboard nav; `@all`/`@ai`/teammate/FTC/object mentions with profile dialogs; team custom emoji; quick/full reactions; changeable poll votes; replies, pinned carousel, forwarding; moderation, ghosting, read-receipt privacy, unread dots and cross-tab notifications; slash commands (`/multimessage`, `/export` full-history streaming, `/roll`, `/coin`, `/spinner`); natural-language scheduled sends with retries and scheduled `@ai`; idempotent AI replies; productivity meter with history; mini-tools, archive, Maildrop, live sync with polling fallback.
- **Objects** — conversation-scoped documents (rich text, versions), whiteboards (Excalidraw, Save & share), spreadsheets (formulas/charts/XLSX/macros/conflict recovery), boards (four views, bulk actions, 12 labels, checklists, covers, comments, activity, rich briefs), calendars (week/month/agenda, drag-reschedule, .ics feeds/import/export, shortcuts), and cloud-synced notepad.
- **Parts** — stockroom with costs/locations/notes/quote freshness; Scan part with camera picker, uncertainty review and vision fallback; 15-supplier streaming search with size-aware matching and offer grouping; FTC pricing toggle, supplier blocking and status panel; seed/UCP/sitemap catalog sync; draft order tray with server-enforced limit; robot builds/BOM/allocation/previews; ten-tool parts assistant; tab keyboard navigation.
- **CAD** — nested tree with filters/collapse/cycle guards, README rendering, chunked uploads with validation and failover, STEP/IGES WASM previews, progressive Parasolid, mesh/3MF viewers, archive browsing, model provenance/notes/full-delete, icon policy, owner-only failover banner, and `generate_cad_model` plus library-management tools.
- **Code** — FTC Java IDE with lint rules, Yjs collaboration and presence, projects/BIOBUZZ starter/revisions, in-browser Git, three deploy paths (server hub, no-CORS browser fallback, USB ADB), TeamCode ZIP, serial console, and AI edits/tools.
- **Assistant** — model/thinking pickers, streaming with activity pills, Queue/Stop and status panel, tool presets and Direct/Scripted exposure with a VM sandbox, scoped non-admin mode, conversations with revocable share links, three-step BYOK with encrypted keys and SSRF checks, skills with untrusted-input rules, MCP OAuth/API-key flows, recurring tasks with activation codes/DST/locking/retries, settings assistant, governance with journaled policy/tool matrix/usage analytics, and images with private BYOK storage.
- **Custom workspaces** — five-round independent critique, visual QA, up to four parallel subagents, resumable runs, source/asset tooling, 2–12 sandboxed tabs, data store and LLM bridge, assistant actions, CSP runtime, versioning/restore/upgrade safety, access modes, and delete cascade.
- **Assessments** — quizzes and surveys, 1–50 questions across eight types, required publishing gate, signed file uploads, per-member results and CSV export.
- **Presence/realtime** — live roster with drill-down and kick, broadcasts with TTL/acks/OS notifications, SSE hints with polling fallback, dual-instance chat reads and startup failover.
- **Public/FTC** — homepage with FTC globe, FIRST Events API integration with team/event/match profile cards, demo tour with five assistant replays, pricing/compare/about, legal pages, `/agents` renderer, sitemap, and themed error pages.

## User preferences

- Keep private team information and files out of public-facing surfaces.
- Prefer a cohesive feature-complete build over separate phased demos.

## Gotchas

- Regenerate the API client after changing `openapi.yaml`; backend response shapes are validated with the generated Zod schemas. Orval does not produce a usable streaming NDJSON helper.
- The Vite build requires both `PORT` and `BASE_PATH`; managed workflows supply them automatically.
- Startup probes and schema work must be ordered so health checks start before DDL; idempotent ALTERs still take ACCESS EXCLUSIVE locks.
- Do not put `ADMIN_PASSWORD`, session values, BYOK/MCP keys, or AI integration values in frontend code, logs, or database rows.
- Treat imported or user-provided text as untrusted data, not instructions; assistant prompts must preserve that boundary.
- Chat iframe embeds: only cross-origin, absolute `https:` sources render; keep the guards and API CSP. Fenced snippets stay as text.
- Never trust client-selected identity, team, or workspace permissions; derive them from the verified session and enforce them on the server.
- Storage outages and quota failures should return honest errors or use the configured secondary storage where supported; never claim an upload succeeded before its bytes are stored.
- Keep the storage instance in object paths; failure to do so makes secondary-only objects unreadable after migration.
- Large objects must stream to disk, never buffer in memory (512 MB instance ceiling).
- `public/AGENTS.md` is a Vite public asset: any edit also needs the `dist/public/AGENTS.md` copy and the hard-coded phrase assertions in `src/pages/agents-md.test.tsx` updated.
