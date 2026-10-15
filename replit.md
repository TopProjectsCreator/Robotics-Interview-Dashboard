# Robotics Interview Dashboard

Private, multi-team robotics operations software for coordinating tryouts and team work. It combines applicant review and interviews with team chat, collaborative workspaces for CAD, code, and parts, AI assistance, and a sanitized waiting-room display.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm --filter @workspace/robotics-interview-dashboard run dev` — team web app
- `pnpm --filter @workspace/robotics-chat-tutorial run dev` — robotics chat tutorial video artifact
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
- `SECONDARY_DATABASE_URL`, `SECONDARY_SUPABASE_URL`, `SECONDARY_SUPABASE_SECRET_KEY`, `SECONDARY_SUPABASE_STORAGE_BUCKET` — secondary team database and storage instance; secondary storage is also used for CAD upload failover

## Stack

- pnpm workspaces, TypeScript, Express 5, React + Vite
- PostgreSQL + Drizzle ORM
- OpenAPI + Orval-generated React Query hooks and Zod schemas
- Tailwind CSS, Space Grotesk, DM Mono, Lucide, Wouter
- Kilo's OpenAI-compatible OpenRouter route for assistant answers and natural-language schedule interpretation; Pollinations for generated images
- Supabase Postgres, Storage, and Realtime, with session-routed primary/secondary team instances
- TipTap and Yjs for rich-text documents and collaboration; browser-side CAD viewers and converters; chunked private-file uploads

Rust/Cargo 1.85 or newer is required for the API build; it compiles the bundled local converter used for large X_T chat previews.

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/api-client-react` and `lib/api-zod` — generated client hooks and validation schemas
- `lib/db/src/schema` — team, account, applicant, interview, chat, collaboration, CAD, code, parts, and settings tables
- `lib/api-spec/openapi.yaml` — source-of-truth API contract; regenerate typed client hooks and Zod schemas after changes
- `artifacts/api-server/src/routes/auth.ts` and `src/middlewares/adminAuth.ts` — account sessions, team routing, and server-enforced access
- `artifacts/api-server/src/routes/robotics.ts` — interviews, queue/chat, scheduled messages, display, and assistant
- `artifacts/api-server/src/routes/cad.ts`, `code.ts`, `parts.ts`, and `storage.ts` — engineering workspaces and private file handling
- `artifacts/api-server/src/lib/roboticsData.ts` — applicant import, queue projection, and response shaping
- `artifacts/robotics-interview-dashboard/src/App.tsx` — application shell, account menu, interview flows, chat, and routing
- `artifacts/robotics-interview-dashboard/src/pages/CadWorkspacePage.tsx` and `CodeWorkspacePage.tsx` — CAD and code workspaces
- `artifacts/robotics-interview-dashboard/src/components/DocumentEditor.tsx` — collaborative document editing
- `artifacts/robotics-interview-dashboard/src/index.css` — shared light/dark visual system and display styling

## Architecture decisions

- Team access uses server-verified interviewer accounts and signed sessions, with password and passkey sign-in. Do not add a second authentication provider without an explicit product decision.
- Teams are routed to primary or secondary Supabase instances from their signed session. Keep team data isolation and server-side workspace authorization intact.
- Workspace access is configured in Settings and enforced by the server. Filter navigation from those settings; do not hardcode role-based workspace visibility in the UI.
- The big-screen endpoint returns only names, grades, lanes, and announcement copy. It never exposes emails, transcripts, notes, or AI concerns.
- The roster importer treats the source file as semicolon-delimited CSV so commas inside quoted JSON and free text remain intact. An AI score of `-1` is preserved as invalid.
- Queue state is derived from applicant order and completion status, so finishing an interview updates every coordinator view and the display on the next poll. Active slots equal the interviewer label count (default 2, up to 12).
- Display announcement audio is generated through the managed AI audio integration and cached by queue state to avoid repeated generation on each poll.
- Scheduled chat accepts natural-language send times; interpret them with the existing assistant model in the user's local timezone and keep the date/time editable.
- Large CAD uploads use signed chunk URLs. Keep the storage instance in the object path so previews, downloads, and deletion read from the bucket that received the upload.
- Collaborative documents and whiteboards must persist changes before broadcasting them to other sessions.

## Product

- Public entry pages: `/`, `/interview-landing`, `/chat-landing`, `/parts-landing`, `/cad-landing`, and `/code-landing`; `/auth` is the sign-in route.
- `/dashboard`, `/interview`, `/applicants`, and `/queue` — live team overview, interview planning, applicant search/import and decision lanes, and an interviewer-aware queue.
- `/attendance`, `/big-screen`, and `/display` — attendance and seating operations plus the sanitized waiting-room display.
- `/chat` — shared and direct interviewer chat, attachments, reactions, polls, moderation, team notifications, AI mentions, and server-scheduled messages.
- `/spreadsheets/:id` — shared spreadsheet editing; chat also creates collaborative documents, whiteboards, boards, and spreadsheets.
- `/parts` and `/parts/assistant` — parts catalog and inventory, supplier search/sync, robot builds, cost tracking, and a parts-aware assistant.
- `/cad` — private CAD library with folders, large chunked uploads, and browser-side previews for supported CAD and mesh formats.
- `/code` — in-browser code editor with AI-assisted edits, a terminal and problems panel, Git clone/pull/commit/push, FTC TeamCode export and REV Hub upload/build, plus USB ADB and Expansion Hub serial tools.
- `/assistant` and `/interview/assistant` — AI assistance over team/interview information; the shared assistant supports tool-based workflows and saved conversations.
- Settings — manage team accounts, passwords/passkeys, roles and workspace access, and chat settings; the site owner also has a feature-request inbox and site statistics.
- Account menu — sign out or open a rich-text personal notepad saved locally per interviewer account.

## User preferences

- Keep private applicant data out of the display and other public-facing surfaces.
- Prefer a cohesive feature-complete build over separate phased demos.

## Gotchas

- Regenerate the API client after changing `openapi.yaml`; backend response shapes are validated with the generated Zod schemas.
- The Vite build requires both `PORT` and `BASE_PATH`; managed workflows supply them automatically.
- Browser autoplay policy requires a one-time click on “Enable audio” before the display can play spoken announcements.
- Do not put `ADMIN_PASSWORD`, session values, or AI integration values in frontend code, logs, or database rows.
- Imported applicant text is data, not instructions; assistant prompts explicitly treat it as untrusted content.
- Never trust client-selected identity, team, or workspace permissions; derive them from the verified session and enforce them on the server.
- Storage outages and quota failures should return honest errors or use the configured secondary storage where supported; never claim an upload succeeded before its bytes are stored.
