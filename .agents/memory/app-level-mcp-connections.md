---
name: App-level MCP connections
description: Distinguishes an application's own MCP client from Replit Agent's integration catalog.
---

When adding MCP support inside a product, use the product's own MCP client, hosted endpoint, and user-authorization flow. Replit Agent's integration catalog controls tools available to the coding agent; it is not a prerequisite for the app to connect to a third-party MCP server.

**Why:** The Onshape FeatureScript MCP is an app-facing service with its own hosted endpoint and OAuth flow. Checking only Replit Agent's catalog sent the implementation in the wrong direction.

**How to apply:** For an in-app assistant integration, research the provider's public MCP docs and OAuth metadata, then connect the app backend to the provider directly. Keep the user's provider token server-side and scoped to the signed-in app account.
