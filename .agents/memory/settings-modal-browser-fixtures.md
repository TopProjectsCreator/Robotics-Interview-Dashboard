---
name: Settings modal browser fixtures
description: Authenticated dashboard browser-test data for shared settings
---

When browser-testing the Settings modal, use contract-shaped mocked responses for data used by shared shell components and any settings sections that remain mounted while hidden. A generic `{}` response can crash a different tab before the test reaches the section it is trying to verify. If only a narrow subset of operations is needed, use a non-admin test session with only the permission needed to open Settings; admin sessions mount more team-wide settings.

**Why:** The modal includes hidden settings content and shared shell queries, so responses for the selected tab alone may not be enough to keep the real UI mounted.

**How to apply:** Stub all network requests in the browser test, return valid empty-list and settings objects for mounted consumers, and assert that the layout test performs no team-data mutations.
