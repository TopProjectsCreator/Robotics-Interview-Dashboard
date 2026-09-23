---
name: Applicant search semantics
description: Durable rules for the applicant roster search language and derived skill filters.
---

`IF <condition> THEN <consequence>` is an implication: applicants that do not match the condition pass, while applicants that do match it must also match the consequence. Derived `skill:` filters must use the same strongest-signal classification shown by the Build/Code/CAD chips, including its tie-breaking behavior.

**Why:** Coordinators need boolean searches to remain predictable, and a search result must agree with the signal visible on each applicant row.

**How to apply:** When extending search qualifiers or signal detection, update the parser/matcher and visible chip logic together, and document any new boolean operator semantics in the search help text.