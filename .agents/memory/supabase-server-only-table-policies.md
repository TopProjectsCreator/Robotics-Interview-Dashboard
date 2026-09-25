---
name: Supabase server-only table policies
description: RLS advisor findings for tables accessed exclusively through the API server.
---

For Supabase tables accessed only through the API server, keep RLS enabled and add a restrictive `FOR ALL` policy for `anon` and `authenticated` with false `USING` and `WITH CHECK`. Do not add permissive client policies just to clear the INFO `rls_enabled_no_policy` finding. Verify the app's database role bypasses RLS or is otherwise explicitly authorized before applying.

**Why:** RLS enabled with no policies already denies ordinary client-role access. Explicit restrictive denies make this intent visible to Supabase's linter without weakening the signed-session/API boundary. Applying DDL across many tables in one transaction can deadlock with live requests; apply each table's DDL separately.

**How to apply:** Confirm the database URL resolves to Supabase and inspect the connection role's RLS privileges. Use the app's schema setup, process tables individually, and verify the policy metadata and API reads afterward.