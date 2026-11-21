---
name: Railway deploy and git push workflow
description: Railway CLI auth resets on sandbox restart; git push needs the gh token injected as an extraheader.
---

In this environment, `git push origin main` fails with "Invalid username or token" because git's stored credentials are stale, but `gh` is authenticated with a `repo`-scoped token. Push with a one-shot Authorization header so the token never lands in config or history:

`git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $(printf 'x-access-token:%s' "$(gh auth token)" | base64 -w0)" push origin main`

Railway CLI auth is also not durable across sandbox restarts: `railway whoami` returns Unauthorized after a restart. Re-run `railway login --browserless` (it completes without user interaction here and prints "Signed in as ishaanbans@gmail.com"), then `railway link -p <project> -e production -s <service>` (link also resets), then `railway redeploy --from-source --yes`.

**Why:** During the Supabase migration on 2026-11-20/21 both failures recurred after each restart, costing several retries; neither is a real credential problem.

**How to apply:** Before any push/deploy after a restart, check `gh auth status`, `railway whoami`, and `railway status`; run the two re-auth steps if needed. Railway vars survive restarts — verify values with `railway variable list --json` parsing keys only, never printing secrets.
