---
name: Productivity score window
description: The product's required time range for AI chat productivity assessments.
---

Each productivity assessment must use only messages from the 30-minute review window, not accumulated progress from older chat history. Show the exact review-window start and end with the saved score.

**Why:** The user explicitly clarified that a productivity score must represent 30 minutes rather than progress accumulated over months.

**How to apply:** Filter both the database query and the prepared AI input to the review window, and persist that window's boundaries for the UI.
