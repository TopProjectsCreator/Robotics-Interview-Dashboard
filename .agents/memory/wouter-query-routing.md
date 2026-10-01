---
name: Wouter query routing
description: Keep query-string-driven UI state reactive in Wouter routes.
---

Wouter's `useLocation` exposes only the pathname. Read query-driven state with its dedicated `useSearch` hook; changing search through the Wouter navigation setter updates the URL and keeps browser history reactive.

**Why:** Treating `useLocation` as pathname-plus-query silently loses route state after navigation, even though the browser URL contains the parameter.

**How to apply:** For UI state that must survive reloads or sign-in redirects, encode it in the URL search string, read it with `useSearch`, and update it through Wouter navigation.