---
name: App-level MCP connections
description: Distinguishes an application's own MCP client from Replit Agent's integration catalog.
---

When adding MCP support inside a product, use the product's own MCP client, hosted endpoint, and user-authorization flow. Replit Agent's integration catalog controls tools available to the coding agent; it is not a prerequisite for the app to connect to a third-party MCP server.

MCP protected-resource metadata may be advertised as a path-specific `resource_metadata` URL in `WWW-Authenticate`, not at the server origin root. For authorization issuers with a path prefix, try the RFC 8414 well-known URL with that path appended. Support both Streamable HTTP JSON/SSE responses and legacy SSE's GET event stream plus POST message endpoint.

Every connection status, OAuth state, discovery, and tool-execution path must use the signed-in account and active team. For non-coordinators, expose only MCP tools; keep other assistant actions and team data behind their existing permissions. Keep member conversation history private as well.

**Why:** The Onshape FeatureScript MCP and custom MCP servers are app-facing services with their own hosted endpoints and OAuth flows. A Supabase Edge MCP endpoint can advertise path-specific resource metadata; root-only discovery incorrectly reports missing OAuth metadata. Team-wide access must not share credentials or unlock unrelated coordinator capabilities.

**How to apply:** For an in-app assistant integration, connect through the provider's MCP endpoint and OAuth metadata. Derive account and team IDs from the signed-in session for every status, connect, callback, discovery, and execution path. Keep provider tokens server-side and scope assistant tool catalogs to the caller's own connections.
