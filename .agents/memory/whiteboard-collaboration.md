---
name: Whiteboard collaboration
description: Transport and security constraints for live interviewer whiteboard editing.
---

Live whiteboard editing uses a server-authenticated WebSocket room scoped by whiteboard access. The browser may pass the existing signed interviewer session as a short-lived `access_token` query fallback because the WebSocket constructor cannot set an Authorization header; the server must validate the same session, revocation, account setup, and conversation permissions as the JSON API. Collaboration merges Excalidraw elements by ID and version so independent concurrent edits survive instead of replacing the whole scene.

**Why:** The dashboard can be embedded, and cookie-only WebSocket authentication is unreliable when third-party cookies are blocked. Reusing the existing signed session preserves the interviewer identity boundary without adding a second credential system.

**How to apply:** Keep the WebSocket path explicitly listed in the API artifact service paths so proxy upgrades reach the API. Persist merged scenes server-side with a bounded debounce, broadcast updates only to authorized room members, and keep reconnect hydration from the database. Treat same-element simultaneous edits as last-writer-wins; add a CRDT or per-user cursor/presence layer if true Miro/Google Docs parity is required.

Enforce board-specific authorization before completing a WebSocket upgrade, not only before sending the initial snapshot. A rejected connection must never join the room or receive collaboration messages.

**Why:** Cursor labels, selected element IDs, and presence counts are private room data even when scene data is not sent.

**How to apply:** Resolve the board and verify the signed-in interviewer is a member before accepting the upgrade; test rejected clients receive no collaboration payload.

When other collaborative data shares the whiteboard storage channel, avoid subscribing the whole table to high-frequency database change events. Send targeted local realtime hints and keep a bounded authenticated polling fallback so clients on other API processes still converge.

**Why:** Drawing-scene persistence can emit frequent row updates; broad subscriptions would cause unrelated collaborative views to refetch repeatedly.

**How to apply:** Invalidate only the relevant workspace queries on a hint, and keep periodic reads while a board is open unless the database changefeed can filter and throttle updates safely.

FortuneSheet's React `Workbook` calls its `onChange` prop from an effect that depends on both workbook data and the callback identity. Keep that prop stable across parent renders, and make workbook normalization idempotent before updating React state.

**Why:** An inline callback can trigger `onChange` after every parent render; if the handler sets parent state even when the workbook is unchanged, it creates a maximum-update-depth loop.

**How to apply:** When using FortuneSheet, pass a stable callback wrapper that reads the latest handler from a ref, and skip state updates for unchanged normalized workbook data.