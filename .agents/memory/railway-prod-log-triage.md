---
name: Railway prod log triage workflow
description: Diagnose prod failures from Railway logs before changing code; heartbeat errors can be logged as "failed" while the HTTP response is still 200.
---

To find prod bugs, pull `railway logs --since 6h` (re-auth with `railway login --browserless` + user device approval when `whoami` says Unauthorized; `railway link -p <project> -e production -s <service>` after each auth). Condense with `grep -aoE '"message":"[^"]{10,200}' | sort | uniq -c | sort -rn` and `"method":"[A-Z]+","url":"[^"]+"} res={"statusCode":[0-9]+` for non-2xx endpoints.

**Why:** On 2026-11-22, 6h of prod logs showed only two failures: a DB type error logged at INFO as "Workspace usage tracking failed" (heartbeat still returned 200) and repeated FTC search 502s. Scanning only HTTP status codes would have missed the heartbeat bug entirely.

**How to apply:** Treat logged "… failed" lines as failures even when the request's statusCode is 2xx. Check both error messages and non-2xx responses. Self-healing warnings (e.g. Supabase realtime relay transport failure with "polling fallback") are not code bugs.
