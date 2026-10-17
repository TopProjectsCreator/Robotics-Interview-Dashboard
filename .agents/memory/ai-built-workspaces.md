---
name: AI-built workspaces
description: Product scope for creating arbitrary custom workspaces with AI and using isolated data in the existing Supabase database.
---

AI-generated workspaces must be buildable from scratch and must not depend on fixed workspaces such as Parts being present. Use the app's existing Supabase database with per-team and per-workspace data isolation; do not provision a separate Supabase project for each workspace. Generated apps may request server-managed data and LLM capabilities, but never receive provider credentials.

Custom workspaces should support arbitrary interactive apps, while generated code remains untrusted: run it only in the isolated iframe, deny direct network and parent-page access, and route side effects through authenticated server capabilities scoped to the team and workspace. Do not claim that the iframe can host an OS process or real network service.

**Why:** The user explicitly said the assistant should be able to build a Parts-like workspace even if Parts did not exist, and that custom workspaces should share the existing Supabase database.

**How to apply:** Treat custom workspaces as applications, not entries in the fixed workspace enum. Route every capability through server-side authorization scoped to team, workspace, and caller.
