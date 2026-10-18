---
name: App-level MCP connections
description: Distinguishes an application's own MCP client from Replit Agent's integration catalog.
---

When adding MCP support inside a product, use the product's own MCP client, hosted endpoint, and user-authorization flow. Replit Agent's integration catalog controls tools available to the coding agent; it is not a prerequisite for the app to connect to a third-party MCP server.

MCP protected-resource metadata may be advertised as a path-specific `resource_metadata` URL in `WWW-Authenticate`, not at the server origin root. For authorization issuers with a path prefix, try the RFC 8414 well-known URL with that path appended. Support both Streamable HTTP JSON/SSE responses and legacy SSE's GET event stream plus POST message endpoint.

**Why:** The Onshape FeatureScript MCP is an app-facing service with its own hosted endpoint and OAuth flow. A Supabase Edge MCP endpoint likewise advertises path-specific resource metadata; root-only discovery incorrectly reports that OAuth metadata is missing.

**How to apply:** For an in-app assistant integration, research the provider's public MCP docs and OAuth metadata, then connect the app backend to the provider directly. Keep the user's provider token server-side and scoped to the signed-in app account.
