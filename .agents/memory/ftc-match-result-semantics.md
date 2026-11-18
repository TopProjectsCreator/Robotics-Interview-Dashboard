---
name: FIRST FTC match result semantics
description: How FIRST's official match payload distinguishes scheduled matchups from posted scores.
---

When displaying FTC match data, treat a match row returned by FIRST as an official published matchup, and use `postResultTime` to decide whether its score fields represent a published result. Zero is a valid final score and must not by itself mean “unscored.” Preserve scheduled matchups while withholding placeholder score values until a result has been posted.

**Why:** Official match records include final-score fields alongside a separate result-posted timestamp; a score of zero can be a genuine result.

**How to apply:** For consumers of the authenticated FTC Events API matches endpoint, map alliance stations from its official `teams` list and derive result state from `postResultTime` plus both final scores.
