---
name: Natural-language scheduled chat times
description: User requirement for converting typed schedule phrases into editable local date and time fields.
---

Scheduled chat should accept a natural-language time description and use the existing assistant model to populate local date/time fields; keep those fields editable before scheduling.

**Why:** the user explicitly requested replacing the preset time buttons with AI interpretation.

**How to apply:** Use the configured assistant text model and the browser's IANA timezone when interpreting relative dates; show the interpreted values for review before sending.
