---
name: AI-built workspaces
description: Product scope for creating arbitrary custom workspaces with AI and using isolated data in the existing Supabase database.
---

AI-generated workspaces must be buildable from scratch and must not depend on fixed workspaces such as Parts being present. Use the app's existing Supabase database with per-team and per-workspace data isolation; do not provision a separate Supabase project for each workspace. Generated apps may request server-managed data and LLM capabilities, but never receive provider credentials.

Custom workspaces should support arbitrary interactive apps, while generated code remains untrusted: run it only in the isolated iframe, deny direct network and parent-page access, and route side effects through authenticated server capabilities scoped to the team and workspace. Do not claim that the iframe can host an OS process or real network service.

Workspace-builder and `/assistant` agent runs must continue on the server after the browser tab closes, and their tool activity must be reviewable when the user returns.

Generated workspace apps must follow the host Robotics dashboard's shared visual style, including its palette, compact typography, card treatment, and light/dark themes; they should not invent a separate brand or duplicate the global navigation.

Before a custom workspace is reported finished or published, an independent critique agent must complete exactly five sequential rounds, each returning exactly 10 ranked actionable flaws with 1–10 scores. A second independent reviewer must verify every required fix; unresolved findings block the next round and publishing.

**Why:** The user explicitly said the assistant should be able to build a Parts-like workspace even if Parts did not exist, and that custom workspaces should share the existing Supabase database.

**Why:** The user explicitly requires workspace-builder and `/assistant` agent runs to keep working after the tab is closed.

**Why:** The user explicitly said generated workspaces must uphold the dashboard's established styling and CSS.

**Why:** The user explicitly requires a ranked ten-flaw critique and implementation loop before workspace builds are declared finished.

**How to apply:** Treat custom workspaces as applications, not entries in the fixed workspace enum. Route every capability through server-side authorization scoped to team, workspace, and caller. Keep agent execution independent of browser lifetime and preserve tool-call activity for later review. Inject the current dashboard theme tokens into the preview and require the assistant and visual QA to use them. Enforce rounds 1–5 sequentially; make findings below 6 eligible in rounds 1–4, alongside findings above 6. Require a separate saved-source verifier to clear each round and invalidate reviews after later source edits.
