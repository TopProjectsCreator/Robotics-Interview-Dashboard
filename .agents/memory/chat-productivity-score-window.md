---
name: Productivity score window
description: The product's required time range for AI chat productivity assessments.
---

Automatic productivity assessments score only messages from the 30-minute review window. A user may request a one-time assessment for the last hour, 1, 3, or 5 days, week, or 30 days; that selected period is scored. Older messages may be included as separate context, filling the remaining model input budget after scored messages. Show the exact assessed interval. On-demand reports are not retained.

**Why:** The user first clarified that automatic scores must cover 30 minutes, then chose raw-message re-scoring for selectable time ranges. In both cases, older messages outside the selected period are context only.

**How to apply:** Keep scored-window and older-context messages separate in database queries and model input. Prioritize all messages inside the chosen range, then use remaining context budget for older messages; tell the model never to grade or report context as activity from the selected range. Keep scheduled reviews at 30 minutes and do not persist on-demand results.
