---
name: Supabase pooler host discovery
description: New Supabase projects can live on aws-1-* pooler clusters, and tenant-not-found means the wrong cluster — not bad credentials.
---

Before treating a Supabase DSN as bad credentials, confirm the cluster: pooler hostnames are region- and generation-specific (`aws-0-<region>` for older projects, `aws-1-<region>` for newer ones), and `db.<ref>.supabase.co` may resolve AAAA-only.

**Why:** Wiring a new primary on 2026-11-20 (ref `pipldfsgdwbcmedsaclf`), every `aws-0-*` region returned `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found` — that is a wrong-cluster answer, not a wrong password — while the working host was `aws-1-us-west-2.pooler.supabase.com`, which the user supplied. Separately `db.<ref>.supabase.co` answered AAAA-only through DoH and this sandbox has no IPv6 route, so direct connections failed with a truncated `psql: error:` and no cause.

**How to apply:** Take the host from the dashboard's Connect tab instead of enumerating guesses; connect as `postgres.<ref>` on 6543 and treat ENOTFOUND tenant as "keep looking for the cluster". Check `getent ahosts` (or DoH `A`/`AAAA`) before debugging further, and pin a node with `host=<name> hostaddr=<ip>` when one ELB target looks suspect. Passwords belong in `.env`, never echoed into chat.

- [Supabase pooler host discovery](supabase-pooler-host-discovery.md) — aws-1 vs aws-0 clusters; tenant-not-found means wrong host, and db.<ref> may be IPv6-only.
