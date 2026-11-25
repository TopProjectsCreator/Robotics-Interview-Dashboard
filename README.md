# Robotics Dashboard

Private, multi-tenant software for robotics teams. One login and one isolated team silo bring team chat, collaborative documents, parts and inventory, a CAD library, an FTC code workspace, an AI assistant, and AI-built custom apps together in a single browser-based workspace.

Built by Team 23442 (the Wolverines) — Ishaan Bansal. Free for FTC teams: one plan, $0, no card.

## Features

### Teams, accounts, and access control

- **Isolated team silos** — each team has its own access code, accounts, branding, data, and storage; cross-team reads return nothing. Session → team mapping happens at sign-in; clients never pick a team.
- **Team creation** at `/auth?createTeam=1` — 1–80-character name, 4–128-character access code, normalized-name and code uniqueness checks (including legacy codes), first coordinator created and signed in, and fresh per-team settings/workspace-visibility rows seeded. A public endpoint suggests random codes.
- **Sign-in** — team access code → account → password or passkey (WebAuthn fingerprint/face/PIN). Passkeys list label, added date, last-used date, and origin, can be removed, and work on mirror sites; password sign-in always remains available. Rate limits: 10 failed password/code attempts per IP per minute and 5 team creations per IP per minute.
- **Breached-password policy** — 1–2 known breaches warn, ≥3 are blocked, and acceptance requires four separate risk dialogs plus typing `I UNDERSTAND THIS PASSWORD IS COMPROMISED`; if screening is unavailable the gate is skipped. Applies to admin password changes, new accounts, and sign-in setup.
- **Roles** — built-ins Team member, Treasurer, and Admin, plus custom roles (names ≤60 characters) built from categorized permission checkboxes with a “Clear permissions” action. Deleting a role returns its users to their built-in role; admin account/role/workspace/site-owner powers are never delegable; an account cannot change its own role; one role per person.
- **Workspace access matrix** — per-person × per-workspace toggles saved server-side, re-synced when accounts change so another admin's save is not reverted; unknown keys are discarded.
- **Name rules** — up to 50 rules (Contains / Starts with / Ends with / Matches exactly, text ≤40 characters) applied only to new accounts and renames, never existing names.
- **Access-code rotation** — 4–128 characters, current code never displayed, existing sessions stay signed in, rotations serialized across API instances with a Postgres advisory lock and checked for uniqueness.
- **Network blocklist** — exact IPv4/IPv6 addresses with an optional 120-character reason; blocks team code, password, passkey, and new-account requests at the next sign-in, scoped to that team, with blocker name and timestamp.
- **Site-owner operations** — permanent team deletion (all owned rows in one transaction, default team protected, per-table counts logged), feature-request inbox, site statistics, and an admin diagnostic intake that rate-limits reports.

### Dashboard, settings, and preferences

- **Dashboard** — numbered cards relative to the viewer's visible workspaces, custom-app cards, a coordinator “Create workspace” action, and explicit empty/error/retry states.
- **Charts and analytics** — bar, pie, and line charts over workspace data with a refresh action and a one-time migration of older browser-local charts into the shared server list.
- **Snapshots with dry-run restore** — preview of added/removed/changed/unchanged entries and label/chart changes, current state saved first so a restore is undoable, gated by `snapshots.manage` plus the typed phrase `I understand`.
- **Workspace usage dashboard** — trailing 30 UTC days by default (up to 366), total active time/visits/distinct sessions, a daily active-time bar chart, and a workspace ranking with Built-in/Custom labels; team aggregates only, no person/IP/content detail.
- **Settings shell** — eight searchable tabbed sections (Profile, Appearance, AI, Team, Branding, Chat, CAD, Operations) with a “Find a setting” filter and full keyboard navigation; permission-gated tabs appear only for authorized accounts.
- **Operations tab** — ten cards: Readiness (team assessments), Intake (default sort), Sync (instant updates and 3/10/30-second refresh), Alerts (browser notifications), Team pulse (presence), Broadcast, Parts desk (order limit), Access safety (IP blocklist), Event links (TinyURL), and Recovery (refresh all / reset all).
- **Branding** — primary color, logo ≤2 MB, up to ten PNG/JPEG/WebP backgrounds ≤8 MB each with Cover/Tile fit, a 0–80% dark overlay in steps of 5, wall-clock rotation in seconds/minutes/hours up to 24 hours (so all screens switch together), a “First” badge when rotation is off, native file drops, and per-item reset buttons. Team default Light/Dark theme can be Recommended or Locked.
- **Settings Assistant** — coordinator-only, privacy-labelled lane streaming SSE with read / propose / update capabilities over 16 settings (never API keys); sensitive changes such as the team inbox require an HMAC-signed token with a 10-minute TTL and an exact `confirm <token>` reply. Last 20 turns are sent as context.
- **Chat settings** — slow mode Off/5s/10s/30s/1m for shared and invite-only channels (DMs never slowed, send button counts down), and a team-wide `/multimessage` cap of 0/5/10/25/50/100, both enforced server-side.
- **Team inbox** — inbound email → team chat with an encrypted, editable/removable Maildrop key, copyable forwarding address, up to 50 approved senders (domain rules cover subdomains), a manual “Check now” sync reporting posted count/reason, and a note that Maildrop may ignore the saved key.
- **Parts order limit** — caps the sum of line quantities in a draft order (1–1,000,000; blank means unlimited), enforced on every add.
- **CAD icon policy** — per-team enabled icon set; existing bots keep their icon, at least one icon must remain enabled, and “Restore all icons” resets the catalog.
- **TinyURLs** — up to 200 links per team with aliases 1–64 characters (lowercased, pasted full URLs reduced to the alias), targets ≤2048 characters upgraded to https, globally unique aliases, click counts, and copy/open/delete actions. `/t/<alias>` uses a `noindex` shell for invalid links and a 302 with `Cache-Control: no-store`; only real GETs increment clicks.
- **Feature requests and site stats** — “Suggest an app adjustment” with a 1–2,000-character message; authors edit/delete their own, only the site owner marks Done/Reopen; owner inbox shows team names and a per-team people/requests/open-requests breakdown.
- **Reset and recovery** — “Refresh all data” invalidates the whole query cache; “Reset all settings” itemizes exactly what changes (device defaults plus authorized team defaults) and never touches branding images, name rules, inbox, roles, workspace access, governance, or scheduling settings.
- Personal preferences cover theme, row density, reduced motion, default sort, refresh interval, and browser notifications; the account menu offers Settings, Notepad, and End session, with logout everywhere and cross-tab session expiry.

### Chat (`/chat`)

**Conversations and composer**

- Shared team channel, 1:1 DMs, and invite-only channels created by admins with case-insensitive per-team unique names, emoji icons, and member invites; admins see all channels while membership stays honest; deletion removes messages, reactions, reads, poll data, and productivity snapshots.
- Deep links `?peer=` / `?channel=` select conversations, are validated after roster load, and fall back to the team channel when a channel is revoked.
- Markdown with headings, lists, blockquotes, horizontal rules, fenced/inline code, sanitized SVG (20 KB cap, no scripts/styles/links), `<details>`, and tables with CSV (comma and semicolon) and Excel downloads.
- 4,000-character cap, three attachments, HEIC → JPEG, drag-and-drop onto the composer, clipboard image/video paste with generated names, and per-file “Preparing/Uploading N%” status.
- Formatting toolbar (bold/italic/code) that wraps the selection and restores the caret; Enter submits, Shift+Enter adds a newline, Escape closes pickers, and arrows/Enter/Tab navigate slash, channel, and mention suggestions with on-screen-keyboard-aware scrolling.
- Drafts persist per (account, conversation) in localStorage and restore on switch; large files use 40 MB chunks with progress, large Parasolid uploads use a 10-minute signed URL, and failed uploads are cleaned up.
- Voice messages recorded as Opus WebM and separate continuous/interim Web Speech dictation appended to the draft.

**Mentions and embeds**

- `@all`, `@ai`, teammate mentions that open a DM, and reference-only object and FTC mentions; one picker at a time (`/` > `@` > `#`), with `#` guarded against URL fragments; duplicate names get a short ID suffix.
- Object mention tokens open the linked document, whiteboard, board, spreadsheet, or calendar; FTC tokens open a stable profile dialog with team fields, season events, matchups with red/blue alliance scores, attending teams, official links, dialog history, and auto-refresh.
- Full emoji picker with search and categories; admins upload team emoji (`:shortcode:`, 2–32 lowercase characters, PNG/JPEG/GIF/WebP ≤512 KB, drag-drop), with magic-byte and uniqueness validation; shortcodes expand in markdown outside code.
- Sandboxed `<iframe>` embeds only from absolute cross-origin HTTPS URLs with no credentials; localhost/IP/same-origin blocked, dimensions clamped, collapse/restore and open-in-new-tab controls, and fenced snippets left as text.

**Messages and moderation**

- Hover quick reactions (👍/😂/🙏) plus a full picker; exactly one Unicode grapheme or team shortcode per reaction, toggled per author, with count and author tooltips.
- Polls with 2–8 options, changeable votes, percentage bars, your-vote checkmark, and vote counts.
- Reply previews with parent snippet and “Replying to …” badges, a pinned-message carousel with prev/next, jump-and-flash, and unpin, and forwarding to the team channel, any teammate DM, or any accessible channel with attribution and a 4,000-character truncation.
- Message menu: copy AI answer, react, reply, forward, pin, edit/delete (own messages or coordinators and `chat.moderate` roles), and admin ghosting that removes a deleted marker, detaches replies, and is idempotent.
- Deleting blanks text, clears reactions/reads/polls/pins, and removes every stored object reference including secondary-instance chunks and generated images.
- Read receipts: authors and admins see the full reader list, others only their own; times show date/year when they differ from the send day.
- Unread red dots in the conversation picker and favicon, treated read at ≥20% visibility; cross-tab notifications use Web Locks to elect one poller (8-second cursor feed), localStorage claims, active-view records, and deeplink clicks.

**Commands, scheduling, and AI in chat**

- `/multimessage [{delayMs}] <count> <message>` with an optional delay that posts copies in the background with “Posted N of M…” progress; `/export [{last}] [csv|md|txt] [file|clipboard]` streams the full retained history in 500-row batches straight to disk with UTC timestamps, `[message deleted]` placeholders, edited markers, and activity summaries; `/roll` (NdM±modifier), `/coin [count]`, and `/spinner [options]` animate 3D/2D results.
- A slash picker with shared registry, usage strings, “Admins” tags, and keyboard/mouse selection.
- Scheduled sends interpret natural language in the viewer's IANA timezone, enforce a 1-minute minimum and 1-year maximum, carry attachments/polls/replies, retry up to five times with `FOR UPDATE SKIP LOCKED`, bypass slow mode, validate membership at delivery, and surface failed sends for dismissal/recreation.
- Scheduled messages containing `@ai` also post an AI answer with activity pills; AI failure never undoes delivery.
- `@ai` reads up to 100 recent messages plus five file attachments as untrusted context, honors per-device disabled tools and tool-exposure mode, and saves retries idempotently (same answer and activities, no re-ask, 409 on key reuse; answers capped at 50,000 characters).
- Optional AI productivity meter: automatic 30-minute reviews, admin toggle with an explicit AI-processing acknowledgement, one-time 1h/1d/3d/5d/7d/30d reviews, custom admin guidance, and a 7/30/90-day history with average, best day, peak, bar chart, and trend line. DMs, attachments, reactions, polls, and deleted messages are excluded.
- Inline mini-tools (quiz, checklist, counter), chat archive, Maildrop email → chat, and live sync with polling fallback.

### Documents, sheets, boards, calendars, and notepad

- Chat `+` creates documents, whiteboards, boards, spreadsheets, and calendars as `[[kind:id]]` cards scoped to the same conversation, with spreadsheet deep links preserving a return path.
- **Documents** — rich text with H1–H3, bold/italic/underline/strike, lists, four alignments, undo/redo, live collaborator avatars, connection status, autosave/save-error status, and version history.
- **Whiteboards** — shared Excalidraw with remote cursors, connection status, view mode, “Save changes” vs “Save & share” (posts a chat card), and team storage instead of native export.
- **Spreadsheets** — multi-sheet workbooks with a formula bar, tabs, toolbar, XLSX/CSV import (8 MB) and export, right-click row/column insert/delete/sort/filter, charts from a selection (column/line, first row series, first column categories), macros that record only cell value/formula edits (never arbitrary code), ~5-second autosave, conflict recovery that downloads local changes or loads the server version, and retryable save errors.
- **Boards** — Board/Table/List/Timeline views, search, priority and assignee filters, sorting, multi-select with bulk move/delete and one-card-per-line add, up to 12 colored labels, assignees, start/due dates, 100 checklist items, web references, image/color covers, file attachments, comments, and an activity log.
- **Board briefs** — rich text with `@` teammate mentions, Tiptap toolbar, sanitized HTML, 12,000-character cap, and plain-text serialization when unformatted; board cards show card counts and completed/total subtasks, calendars show the next upcoming event.
- **Calendars** — Week/Month/Agenda views, drag-to-reschedule with overlap warnings, upcoming-events banner, search, assignee/color filters, keyboard shortcuts (`T`, arrows, `N`, `/`, `Esc`), up to 50 subscribed `.ics` feeds, drag-drop or pasted ICS import, preserved local edits, and an export feed link.
- **Notepad** — private rich-text note in the account menu with toolbar, 650 ms debounced queued saves, legacy localStorage migration, remote-save conflict protection, close-flush, and error/retry states.

### Parts (`/parts`, `/parts/assistant`)

- **Stockroom** — quantities, locations, saved unit cost and currency, free-text inventory notes, editable image URL, location datalist, quote/price history with stale and “starting-at” flags, search by name/SKU, supplier filter, 100-row incremental loading, and totals for catalog items, owned, assigned, and available units. Stock cannot be set below allocated units.
- **Scan part** — camera-device picker, Space/Enter capture, three-tier JPEG downscale under 3 MiB, conservative visual suggestion with uncertainty reason, editable fields, manual supplier and quantity, and a manual-entry fallback; the vision model has an alternate free-model fallback and treats markings as data, not instructions.
- **Find parts** — streaming supplier search across 15 vendors (AndyMark, goBILDA, REV Robotics, ServoCity, Studica, Swyft, WestCoast Products, Platypus Robotics, Limelight Vision, Ferra, Optii, Offset Robotics, Axon Robotics, Melonbotics, BWTLink), with size-aware matching (`8 mm`/`M8`), offer grouping by SKU/title with cheapest-in-stock badge, alternate-offer links, out-of-stock dimming, saved-stock dedup, 100-item paging, and a team FTC-pricing toggle that affects only goBILDA prices.
- **Supplier status** — per-vendor official-source links, last-checked time, item counts, blocked badges, and search-only vs feed-required states; admins or `parts.manage` can block a supplier for the team. Search-provider failures are reported as partial vs unavailable with saved-stock fallback.
- **Catalog data** — hand-collected seeds (REV Robotics, Studica, Axon, BWTLink, Offset Robotics, and Platypus Robotics' 274-product Wix catalog), UCP sync for WestCoast Products and Limelight Vision with live per-variant price/currency/stock status, supplier-page verification (HTTPS + vendor-owned host, JSON-LD/OpenGraph metadata, <2 MB HTML cap), and a bounded background sitemap crawler with restart-safe progress and discontinued marking. Public seed rows are shared across teams; manual rows and all costs, locations, notes, and allocations are team-private.
- **Draft order tray** — localStorage-persisted with quantity steppers and per-currency subtotals, a “no purchase placed” disclaimer, and a server-enforced cap on summed line quantities.
- **Robot builds** — create/rename/delete builds, allocate stock with per-part saved costs and quotes (blank clears cost), line totals, unpriced-part counts, totals by currency, BOM editing, and multi-format preview upload/download with cleanup.
- **Parts assistant** — ten tools covering supplier search, catalog/stock/robot listing, robot create and rename, inventory-details read/update, catalog-item create, stock update, and allocation.
- Tabs support arrow-key/Home/End navigation.

### CAD (`/cad`)

- **Library** — bot → folder → model tree with arbitrary nesting, alphabetical sort, name/file-name filter, collapsible branches, nested counts, drag-and-drop with self/descendant/cross-bot cycle guards, Unfiled inbox, breadcrumbs, and README.md rendering (headings, code, tables, quotes, lists, safe links, 1 MiB/100k-char caps).
- **Uploads** — multi-file click/drag, per-file progress, 40 MB chunks, server validation of GLB/STL/3MF/OBJ/PLY signatures and declared type, a 200 MB single-upload cap that forces chunking, and automatic backup-storage failover with a site-owner-only status banner.
- **Previews** — STEP/IGES/BREP via client-side OCCT WASM (triangle guards, mesh colors, trackpad pan), progressive server-side Parasolid conversion with restart recovery and zoom-loaded GLB tiles, mesh/3MF with triangle caps and per-vertex colors, images/video/audio/PDF/Office/archives through the shared viewer, archive extraction on click with per-entry download, and original-file download.
- **Model management** — format badges, uploader and size provenance, folder hints, notes, rename/move/delete with full chunk-manifest cleanup, bot deletion cleaning all files, folder deletion only unfiling models, and realtime hints with a 15-second polling backstop.
- **Generation and assistant tools** — `generate_cad_model` runs cadquery in a network-less sandbox, exports STL (or STEP on request) to `/out` with an automatic download link (up to 8 files, 32 MB total), and assistant tools list library metadata, create bots/folders, and update model notes without exposing object paths.

### Code (`/code`)

- **FTC Java IDE** — line numbers, token-colored syntax, cursor line/column, `Tab` as four spaces, per-file tabs, filterable/collapsible explorer, Problems panel, and FTC-aware lint rules (Java 8 illegal constructs, public-type filename, missing `@TeleOp/@Autonomous/@Utility`, SDK AprilTag subtypes; capped at 100 problems).
- **Live collaboration** — Yjs + awareness over authenticated WebSockets, color-coded peer avatars, reconnect backoff, debounced persistence with final flush, REST saves folded into open rooms, `code.view`/`code.edit` enforcement, and a 15-second heartbeat roster with 2-minute expiry.
- **Projects and files** — create/delete projects, BIOBUZZ starter (TeleOp + Auto, Java 8 source, JDK 21 toolchain), path safety checks (no `..`, 255 characters, 500 KB content), and 100 newest revision checkpoints with author/message (no diff/restore endpoint).
- **Git** — in-browser isomorphic-git over LightningFS with shallow clone depth 50, configurable CORS proxy, browser-only PAT in localStorage, status and log views, and auto-init on first commit.
- **Deploy** — server-side hub upload returning compiler logs into Problems (180-second timeout), a browser-direct no-CORS fallback that sends up to 60 Java files and triggers a build without reading errors, and USB ADB with a persisted RSA key, build markers, and logs. TeamCode ZIP includes the FtcRobotController layout plus generated deployment instructions.
- **Serial console** — open/close, arbitrary line send, 300-line log, 115200 8N1, shared with deploy logs.
- **AI edits** — context includes project name, SDK/JDK/Java level, first 12,000 characters of the open file, and the file list; Replace file, Insert, and Replace lines a–b; assistant tools can list/create projects and list/read/create/write files.

### AI assistant (`/assistant`, `/parts/assistant`, `/assistant/scheduled-tasks`)

- **Model picker** — free-model catalog by default (`minimax/minimax-m3.1-flash:free` via Kilo's keyless OpenAI-compatible route), searchable models with context length, modality/tool/reasoning badges, a thinking-level picker (Auto/low/medium/high), per-browser model memory, and exact model IDs for compatible endpoints.
- **Prompt controls** — streaming answers with tool-call tags stripped and live activity pills (expandable Input/Result JSON), an MCP continuation banner, Queue/Stop composer behavior, a 100-run prompt status panel with distinct “Interrupted” state, copy buttons, starter suggestions, CSV/TSV/XLSX chat attachments, and Onshape expiry recovery with “Retry original request”.
- **Tools** — chat channels (list/history/post/create-with-invite-all), documents/boards/sheets/whiteboards/calendars (including calendar events and iCal feeds), parts (verified supplier pages, inventory, cost/quote history, allocation), CAD library and generation, code projects/files, custom workspaces, images, web search with provider fallback and site filters, sandboxed Python, mini-tools, and a two-step SVG review gate that requires `confirm=true` before posting markup.
- **Tool governance UI** — “Enable all” and “Read-only” presets, group checkboxes with enabled/total counts, a gear badge when tools are disabled, dynamic tools from custom apps/MCP/Onshape, and aliases so disabling one tool name disables its partner. Non-coordinators get a scoped mode with only connected MCP and automation tools.
- **Tool-exposure modes** — Direct exposes all tools except the script gateway; Scripted exposes only `execute_workspace_tools`, a `node:vm` sandbox (8k characters, 50 calls, 120 seconds, no fs/network/eval, 30k result cap).
- **Conversations** — list with relative time and exchange count, inline rename, deletion that aborts running prompts and cancels queued ones, and unlisted `noindex`/`nofollow`/`noarchive` share links that rotate the token and send `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- **BYOK providers** — three-step wizard with searchable provider/model catalogs (models.dev cache with 15-minute TTL and stale fallback), separate OpenAI Responses API support, exact model IDs, public-HTTPS endpoint validation with DNS checks, AES-256-GCM encrypted keys, show/hide and replacement/removal flows, model capability assertions, and a team provider that overrides model policy.
- **Skills** — admin-defined team skills with name/description/instructions/allowlisted actions, enable/pause/edit/delete with explicit confirmation, exact-name or keyword relevance matching (max three linked repos), untrusted skill text, and a read-only GitHub tree/read tool with call/byte caps and citations.
- **MCP** — Onshape and custom servers with OAuth dynamic registration + PKCE, 401 API-key challenges, encrypted per-account tokens, connection cards with disconnect, duplicate-tool disambiguation, and coordinator-gated continuation with reconnect/retry banners.
- **Recurring tasks** — draft plus 8-character activation code confirmed in a later turn, IANA timezone with DST handling, daily/weekly cadence and next-run preview, destination channel (immutable when editing), `FOR UPDATE SKIP LOCKED` claiming with idempotency keys, retries only on 429/503 before side effects, run history with output/errors, and statuses active/paused/running/succeeded/failed/cancelled/interrupted.
- **Settings Assistant** — coordinator-only settings lane described above with HMAC confirmation for sensitive changes.
- **Governance** — journaled model policy (default, lock, allow/block list) with a 50-entry history and unavailable-model warnings, a role tool matrix (Admins, Legacy admins, Treasurers, Team members, custom roles), blocked integrations with impact counts, usage analytics (prompts, requests, tokens, per-user table, top-eight tools, date ranges up to 366 days, separate productivity-review metrics), and source labels interactive/queued/scheduled.
- **Images** — two sizes (512/1024), team BYOK provider images stored privately with no provider URL exposed, keyless Pollinations fallback with a seed and `z-image-turbo` default, and a follow-up vision turn that shows the generated image back to the model.

### Custom workspaces (`/custom-workspaces`)

- **Builder** — describe an app and let the builder produce a sandboxed mini-app with 2–12 sidebar tabs; exactly five sequential critique rounds, each returning ten ranked flaws, with fixes verified by independent reviewer agents before advancing.
- **Visual QA and subagents** — headless-browser previews across desktop/tablet/mobile and light/dark that report findings, JS exceptions, failed assets, and CSP blocks; up to four parallel specialized subagents (accessibility, security, functionality, responsive design, implementation plan, custom) with foreground/background modes and result collection.
- **Run control** — queued/running/waiting-for-answer/completed/paused/cancelled/failed/interrupted states, pause/stop with confirmation and wait-for-settle, resumable interrupted builds with up to three automatic resume attempts, and a separate builder model picker.
- **Source and assets** — paged reads, create-never-overwrites, JS syntax checks, single-anchor patches, protected `index.html`, version snapshots before destructive edits, automatic icon generation with retry backoff, and prompt rules that forbid generic placeholder assets and invented records.
- **Capabilities and data** — isolated JSONB record store (16 KB records, latest 500, audit logs, paginated queries) and a managed LLM bridge (2,000-character prompt, 800 tokens, per-workspace rate limit); only published, accessible workspaces expose their tools.
- **Assistant actions** — define named `cw_*` tools with list/get/create/update/delete operations, primitive JSON schemas, record-ID mapping, and read/write badges; disabled by default until enabled and saved.
- **Runtime sandbox** — CSP forbids network/frames/forms, dashboard theme tokens are injected, and a frozen `window.workspaceAPI` exposes data and LLM calls with promise IDs, 15-second timeouts, and tab-change events.
- **Lifecycle** — drafts, Everyone/Owner-only/Selected access, publishing, version history (latest 50, preview and undoable restore), sidebar-tab editor with optimistic concurrency, safe source-hash-guarded upgrades, deletion cascade with active-run cancellation, rate limits on generate/publish/revise, and initial-request visibility limited to managers.

### Team assessments

- Quizzes (graded, one point per correct choice) and ungraded surveys, with 1–50 questions of single/multiple choice, long answer, Likert, drag-to-rank, file upload, slider, or theme-style-picker types, four style presets, and a live member-experience preview.
- Publishing assigns the assessment to every current team account as required work; a required gate blocks non-coordinators from the shell until submission, coordinators are exempt, and the return path is preserved.
- File answers use signed URLs with 5 MB per file / 10 MB per response caps, allowed document/image types, native drops, upload rollback, and abandoned-upload cleanup.
- Results show completion count/rate, per-question answer distributions, per-member scores and timestamps, individual answers admin-only, and CSV export.
- Editing a published assessment requires pausing it first, which makes it read-only once responses exist; republishing keeps questions unchanged.

### Presence, broadcasts, and realtime

- “Live now” roster with a 2-minute online window, per-page visits and seconds, first/last seen, notification permission per session, up to 10 distinct IPs with online flags, and offline members with last-seen times.
- Kick targets a user ID (never a raw IP), cannot target yourself, and revokes all that person's sessions for 12 hours within the team.
- Broadcasts to the whole team or one person with messages ≤500 chars, audio-test/engine/reset/say commands, a TTL from 5 minutes to 7 days (UI default 60 minutes), per-session acknowledgements, new broadcasts on first load treated as seen, and OS notifications with window focus on click.
- SSE `/api/events` requires a session and sends only table-name hints (never row payloads); the UI refetches authenticated JSON and polls as a fallback. Mutations in parts, CAD, and code broadcast hints with polling backstops.
- Startup keeps serving when the primary database is down and the secondary is ready; chat reads span both instances.

### Public surfaces and FTC data

- Homepage with “Start your team — free” and “Have a team code? Sign in” entry points, workspace previews, focused landing-page cards, and footer links to `/agents`, privacy, and terms.
- Interactive FTC season globe with zoom in/out/reset, pinch zoom, rotate/pause/play, continuous vertical rotation, co-located marker offsets, details panel and point list, reduced-motion support, renderer fallback/retry, high-zoom tiles, and attribution.
- Authenticated FIRST Events API integration with a 12-second timeout and cached team/event/match data; `@` FTC mentions open team and event profile cards with attending teams, official matches, red/blue alliance scores, result status, winner, series, and tournament level, with navigation between profiles.
- `/demo` — read-only seeded tour with `?view=` for chat/assistant/parts/code/cad and two sample custom apps, a 2026–27 season badge, four teammates, channel switching, parts filters, Java file tabs, and five read-only assistant replays with tool traces.
- `/pricing` and `/compare` with dynamic meta tags and mobile nav; `/compare` shows a worked-area matrix with sourced Robolyst references reviewed NOV 17, 2026. `/about` has a 5-second photo carousel with manual controls and reduced-motion support.
- `/privacy` and `/terms` — 12 and 13 sections naming processors, COPPA consent, CCPA/CPRA “do not sell/share”, retention and snapshot policies, signed HTTP-only cookies, AI training/human-review/location caveats, and a $0 liability cap; effective November 15, 2026.
- `/agents` renders the canonical Markdown briefing with a generated table of contents, copy, and download. `/sitemap.xml` and `/api/sitemap.xml` serve a cached frontend-route sitemap. `/error/:code` pages carry per-code art, the attempted path, quick links, and Retry/Go back; `CrashFallback` hides raw exception messages.

## Routes

| Route | Access | What it is |
| --- | --- | --- |
| `/` · `/demo` | public | Front door with FTC globe; read-only seeded tour. |
| `/pricing` · `/compare` | public | $0 pricing; capability comparison. |
| `/about` · `/privacy` · `/terms` | public | Team story; legal and AI disclosure. |
| `/chat-landing` · `/parts-landing` · `/cad-landing` · `/code-landing` | public | Focused product pages. |
| `/AGENTS.md` · `/agents` · `/agents.md` | public | Machine-readable and rendered product briefing. |
| `/auth` | public | Sign-in; `?createTeam=1` starts team creation. |
| `/assistant/share/:token` | public token | Read-only shared assistant transcript. |
| `/error/:code` · `/sitemap.xml` | public | Themed error pages; frontend sitemap. |
| `/dashboard` | signed in | Workspace cards, analytics, charts, snapshots. |
| `/chat` | signed in · chat | Channels, DMs, attachments, `@ai`, scheduled sends. |
| `/spreadsheets/:id` | signed in | Full-screen collaborative workbook. |
| `/parts` · `/parts/assistant` | signed in · parts | Stockroom, suppliers, builds; parts assistant. |
| `/cad` · `/code` | signed in | CAD library; FTC Java IDE and deploy. |
| `/assistant` · `/assistant/scheduled-tasks` | signed in | Assistant; recurring tasks. |
| `/team-assessments` | signed in | Quizzes, surveys, and required team-readiness checks. |
| `/custom-workspaces` · `/custom-workspaces/:id[/:tabId]` | signed in | Builder; published sandboxed app. |

Unauthenticated visits to signed-in routes redirect to `/auth?returnTo=<current>`; accounts without permission redirect to their first visible workspace, else `/dashboard`.

## Run locally

Requirements: Node/pnpm, PostgreSQL, and Rust/Cargo 1.85+ (the API compiles a bundled native converter for large CAD previews). Docker is optional for local CAD generation.

```sh
pnpm install
pnpm --filter @workspace/api-server run dev          # API server
# From the dashboard web app package directory:
pnpm run dev                                          # team web app
pnpm --filter @workspace/robotics-chat-tutorial run dev  # tutorial video artifact
```

```sh
pnpm --filter @workspace/api-spec run codegen   # regenerate hooks and Zod schemas from OpenAPI
pnpm --filter @workspace/api-server run typecheck
# From the web app package directory:
pnpm run typecheck
PORT=5173 BASE_PATH=/ pnpm run build
pnpm lint
```

Schema changes belong in the API's idempotent startup migrations. Do not run `drizzle-kit push` against the configured Supabase databases: its snapshot omits runtime-managed tables and columns and proposes destructive drops. `PORT` and `BASE_PATH` are both required for the Vite production build. See `replit.md` for the full environment reference, CAD worker deployment, and operational gotchas.

## Stack

- pnpm workspaces, TypeScript, Express 5, React + Vite
- PostgreSQL + Drizzle ORM; Supabase Postgres, Storage, and Realtime with session-routed primary/secondary instances and failover
- OpenAPI + Orval-generated React Query hooks and Zod schemas
- Tailwind CSS, Space Grotesk, DM Mono, Lucide, Wouter
- Kilo's OpenAI-compatible OpenRouter route for assistant answers and natural-language scheduling; Pollinations for generated images
- TipTap/Yjs for documents, Yjs for code, Excalidraw for whiteboards, browser-side OCCT/WASM and three.js CAD viewers, chunked private-file uploads
- OpenTelemetry auto-instrumentation traces in production

## Repository layout

- `lib/api-spec/openapi.yaml` — source-of-truth API contract; regenerate the client after changing it.
- `lib/api-client-react`, `lib/api-zod` — generated hooks and validation schemas.
- `lib/db/src/schema` — team, account, chat, collaboration, CAD, code, parts, assessment, custom workspace, and settings tables.
- `artifacts/api-server/src/routes` — auth, chat/assistant, CAD, code, parts, custom workspaces, storage, assessments, tiny URLs, feature requests, presence, broadcasts, FTC events, and sitemap.
- `artifacts/api-server/src/lib` — supplier registry, assistant tools/policies, chat export/productivity, catalog sync, and instance failover.
- Dashboard web app `src/App.tsx`, `src/pages`, `src/components`, `src/lib` — shell, routing, workspaces, editors, and helpers.

Additional operational context: `replit.md`.
