---
name: Parts source coverage
description: Evidence and completeness rules for the robotics parts supplier catalog.
---

Treat keyless search results as discovery, not as an exhaustive vendor catalog. For the parts dashboard, verified unauthenticated official product feeds were found for Andymark, Ferra, Optii, SWYFT Robotics, and Melonbotics. Public sitemaps are candidate URL lists, not proof of a complete sellable catalog; observed sitemaps can include general pages and service content. McMaster-Carr has a large public sitemap index, but URL discovery does not establish public SKU pricing or remove its approved-customer API requirement. The goBILDA API found during research was an independent third-party wrapper, not an official feed. Some machining suppliers sell configurable fabrication services rather than standard SKU inventories.

**Why:** The user requires catalog sourcing from public sources without relying on a user-provided CSV, and explicitly wants coverage claims tied to evidence. Search snippets, unofficial APIs, or stale third-party datasets can omit or misidentify products.

**How to apply:** Add a vendor to full-feed sync only after verifying an official vendor-controlled unauthenticated source and a reliable pagination end. Preserve each sellable variant's SKU or stable vendor identifier. Otherwise keep that supplier searchable, label its catalog coverage as unavailable or partial, and state the limitation plainly.