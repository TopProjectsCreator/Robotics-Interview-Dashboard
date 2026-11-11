---
name: Productivity score window
description: The product's required time range for AI chat productivity assessments.
---

Each productivity assessment must score only messages from the 30-minute review window, not accumulated progress from older chat history. Older messages may be included as separate context, filling the remaining model input budget after score-window messages. Show the exact review-window start and end with the saved score.

**Why:** The user explicitly clarified that scores cover 30 minutes, while older chat should provide reference context without affecting the grade.

**How to apply:** Keep score-window and older-context messages separate in database queries and model input. Prioritize all available score-window messages, then use remaining context budget for older messages; tell the model never to grade or report historical context as current activity.
