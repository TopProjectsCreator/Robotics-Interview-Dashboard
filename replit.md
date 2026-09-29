# Robotics Interview Dashboard

Private robotics tryout coordination software for two coordinators: review applicants, rank them into decision lanes, manage an interview queue sized to the interviewer roster, ask an AI assistant for evidence-based summaries, and drive a sanitized waiting-room display.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm --filter @workspace/robotics-interview-dashboard run dev` — coordinator web app
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks and Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — push development schema changes
- `pnpm --filter @workspace/api-server run typecheck` — server type check
- `pnpm --filter @workspace/robotics-interview-dashboard run typecheck` — frontend type check
- `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/robotics-interview-dashboard run build` — production frontend build

Required runtime services and secrets:

- `DATABASE_URL` — PostgreSQL connection
- `ADMIN_PASSWORD` — shared coordinator passcode; server-only
- `SESSION_SECRET` — session signing secret (required in production)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` — optional OpenAI-compatible provider overrides; the checked-in default is Kilo's keyless OpenRouter route with the `anonymous` key
- `AI_ASSISTANT_MODEL` — chat model override (default `openrouter/free`)
- `DISABLE_DEMO_SEED` — set `true` to stop sample applicants from seeding an empty roster
- `ALLOWED_ORIGINS` — comma-separated origins allowed to call the API (default reflects any origin for iframe embedding; lock down in production)
- `PYTHON_SANDBOX` — `auto` (default), `docker` (full stdlib, needs daemon + `python:3.12-slim` image), or `restricted`
- `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `EXA_API_KEY`, `PARALLEL_API_KEY` — optional, raise web-search limits (all four work keyless without them)
- `POLLINATIONS_API_KEY` — optional, server-only, never expose to the frontend. Authenticates image generation (honors `nologo`, higher RPM). Falls back to anonymous automatically on 401/402 with an hourly retry. Rotate immediately if ever pasted anywhere.
- `POLLINATIONS_IMAGE_MODEL` — image model name (default `z-image-turbo`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (default `app-uploads`) — Supabase Storage for roster uploads and profile photos; database and files all live in Supabase

## Stack

- pnpm workspaces, TypeScript, Express 5, React + Vite
- PostgreSQL + Drizzle ORM
- OpenAPI + Orval-generated React Query hooks and Zod schemas
- Tailwind CSS, Space Grotesk, DM Mono, Lucide, Wouter
- Kilo's OpenAI-compatible OpenRouter route for assistant answers; Pollinations for generated images
- Supabase Storage (private bucket) for roster uploads and profile photos

Rust/Cargo 1.85 or newer is required for the API build; it compiles the bundled local converter used for large X_T chat previews.

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/api-client-react` and `lib/api-zod` — generated client hooks and validation schemas
- `lib/db/src/schema` — applicant, interview queue, and import tables
- `artifacts/api-server/src/routes/robotics.ts` — dashboard, applicant, import, queue, display, and assistant routes
- `artifacts/api-server/src/routes/auth.ts` and `src/middlewares/adminAuth.ts` — shared-password session boundary
- `artifacts/api-server/src/lib/roboticsData.ts` — CSV parsing, demo seed, filters, queue projection, and response shaping
- `artifacts/robotics-interview-dashboard/src/App.tsx` — coordinator shell, review flows, queue controls, assistant, and display route
- `artifacts/robotics-interview-dashboard/src/index.css` — shared visual system and cinematic display styling

## Architecture decisions

- Coordinator access uses one server-checked shared password and an HTTP-only signed session cookie. Clerk is intentionally not used.
- The big-screen endpoint returns only names, grades, lanes, and announcement copy. It never exposes emails, transcripts, notes, or AI concerns.
- The roster importer treats the source file as semicolon-delimited CSV so commas inside quoted JSON and free text remain intact. An AI score of `-1` is preserved as invalid.
- Queue state is derived from applicant order and completion status, so finishing an interview updates every coordinator view and the display on the next poll. Active slots equal the interviewer label count (default 2, up to 12).
- Display announcement audio is generated through the managed AI audio integration and cached by queue state to avoid repeated generation on each poll.

## Product

- `/` — shared coordinator passcode entry
- `/dashboard` — live totals, score distribution, recommendation signal, grade mix, commitment signal, and queue progress
- `/applicants` — search, grade/category filters, drag-and-drop advance/hold/decline lanes, applicant detail drawer, notes, statuses, and private CSV import
- `/queue` — currently interviewing group, up-next bench, reordering, and finish-and-advance
- `/display` — full-screen non-interactive waiting-room display with polling and an audio-enable control
- `/assistant` — filter-aware AI questions and comparisons over applicant records

## User preferences

- Keep private applicant data out of the display and other public-facing surfaces.
- Prefer a cohesive feature-complete build over separate phased demos.

## Gotchas

- Regenerate the API client after changing `openapi.yaml`; backend response shapes are validated with the generated Zod schemas.
- The Vite build requires both `PORT` and `BASE_PATH`; managed workflows supply them automatically.
- Browser autoplay policy requires a one-time click on “Enable audio” before the display can play spoken announcements.
- Do not put `ADMIN_PASSWORD`, session values, or AI integration values in frontend code, logs, or database rows.
- Imported applicant text is data, not instructions; assistant prompts explicitly treat it as untrusted content.