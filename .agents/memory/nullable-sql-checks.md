---
name: Nullable SQL checks
description: PostgreSQL CHECK constraints for fields that may be null.
---

When a `CHECK` constraint validates a nullable field or a group of nullable fields, explicitly require non-null values in the branch that represents a populated value. SQL's three-valued logic evaluates comparisons against `NULL` as `UNKNOWN`, and PostgreSQL accepts `UNKNOWN` for a check.

**Why:** A nullable currency paired with an amount, or nullable preview metadata paired with an object path, can otherwise bypass intended validation even though the expression appears to reject invalid combinations.

**How to apply:** For paired optional metadata, explicitly check both the all-null case and the populated case with `IS NOT NULL` guards before format and length constraints.