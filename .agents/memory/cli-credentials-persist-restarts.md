---
name: Persist Railway and Supabase CLI creds across sandbox restarts
description: CLI auth lives in /home/runner (wiped on restart); keep copies in gitignored .dev-secrets/ and auto-restore from start-servers.sh.
---

Sandbox restarts wipe `/home/runner/.railway`, `/home/runner/.supabase-*`, and `/home/runner/.local/bin`, so `railway whoami` returns Unauthorized and both Supabase profiles disappear. The workspace itself survives.

**Why:** on 2026-11-24 the two Supabase PATs (team `ishaanbans`, personal `roboticsatplms`) and the Railway config had to be re-created from scratch via browserless login every session. `/home/runner/.bashrc` is a read-only nix symlink, so it cannot be used as a hook; `start-servers.sh` is a tracked workspace file and runs on every local start.

**How to apply:** stored copies live in `.dev-secrets/cli-creds/` (gitignored by `.gitignore` line 91) with `railway/config.json` and one folder per Supabase account (`access-token`, `<acct>.yaml`, `profile`). `.dev-secrets/cli-creds/restore.sh` restores only missing auth files and installs real wrapper scripts (not symlinks!) into `/home/runner/workspace/.config/npm/node_global/bin`, which is on PATH and survives restarts. `start-servers.sh` calls it at startup. After a fresh login, refresh the stored copies. Never commit `.dev-secrets/`.
