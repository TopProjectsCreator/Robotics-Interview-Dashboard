---
name: Applicant drawer close rule
description: The applicant drawer closes on a server 400/404 or a miss in the unfiltered roster, but never because a filter narrowed the list.
---

The applicant drawer is opened from the `applicantId` query parameter. It must close itself — and clear that parameter — when the applicant no longer exists, but it must **not** close just because the applicant is missing from the visible roster.

The roster list is filtered by search, category, and grade. An applicant leaving that list usually means the filters changed or the applicant was moved to another decision lane, not that the record was deleted. Closing on that signal threw away unsaved interview notes whenever a coordinator narrowed a search while a detail drawer was open.

**Why:** The original rule closed the drawer whenever the roster loaded without the applicant, which made narrowing a search destructive. The corrected rule only treats the roster as authoritative when no filter is active, and otherwise relies on the server: a 400 or 404 on the applicant request means the record is gone.

**How to apply:** Close on `selected === ""`, on a 400/404 from the applicant request, or on a miss in the **unfiltered** roster (`params.search`, `params.category`, and `params.grade` all empty). Because the shared-key retry conflict can keep `isError` from surfacing, the unfiltered-roster path is the one that reliably fires — see `react-query-shared-key-retry.md`.
