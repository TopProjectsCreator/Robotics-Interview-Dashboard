---
name: Shared query keys and retry options
description: Observers that share a query key but disagree on retry make the query retry forever and never surface isError.
---

Several components read the same resource with the same React Query key. `useGetApplicant` is called from the applicant list, the applicant drawer, and the interview queue card, and all three use `getGetApplicantQueryKey(id)`.

React Query keeps one query per key and merges the options of every mounted observer. When one observer omits `retry` it inherits the client default (a retry function), and when another passes `retry: false`, the query's effective retry behaviour depends on which observer updated last. The result is a query that keeps fetching: `fetchFailureCount` climbs, but `status` stays `pending` and `isError` never becomes `true`, so no `useEffect` watching `isError` ever runs.

**Why:** The applicant drawer relied on `selectedApplicant.isError` to detect a deleted applicant and close the drawer. The 400/404 never surfaced as an error state, the drawer stayed open, and the URL kept its `applicantId` — which read like a routing bug but was a query-options conflict.

**How to apply:** Do not depend on `isError` for a query key that more than one component observes unless every observer agrees on `retry`. When a shared key must fail fast, pass `retry: false` from all of its observers. When you need to know that a fetch failed, read `fetchFailureCount` and the cached query state, not only `isError`.
