---
name: Whiteboard collaboration
description: Transport and security constraints for live interviewer whiteboard editing.
---

Live whiteboard editing uses a server-authenticated WebSocket room scoped by whiteboard access. The browser may pass the existing signed interviewer session as a short-lived `access_token` query fallback because the WebSocket constructor cannot set an Authorization header; the server must validate the same session, revocation, account setup, and conversation permissions as the JSON API. Collaboration merges Excalidraw elements by ID and version so independent concurrent edits survive instead of replacing the whole scene.

**Why:** The dashboard can be embedded, and cookie-only WebSocket authentication is unreliable when third-party cookies are blocked. Reusing the existing signed session preserves the interviewer identity boundary without adding a second credential system.

**How to apply:** Keep the WebSocket path explicitly listed in the API artifact service paths so proxy upgrades reach the API. Persist merged scenes server-side with a bounded debounce, broadcast updates only to authorized room members, and keep reconnect hydration from the database. Treat same-element simultaneous edits as last-writer-wins; add a CRDT or per-user cursor/presence layer if true Miro/Google Docs parity is required.