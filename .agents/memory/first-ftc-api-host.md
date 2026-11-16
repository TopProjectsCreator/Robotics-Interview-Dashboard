---
name: FIRST FTC API host
description: Correct origin for authenticated FTC Events API requests.
---

Use `https://ftc-api.firstinspires.org/v2.0` for FTC Events API endpoints. The similarly named `ftc-events.firstinspires.org` host returned HTTP 401 with valid configured credentials, while `ftc-api.firstinspires.org` accepted them.

**Why:** The wrong host made FTC team and event mentions appear unavailable even though the credentials were configured correctly.

**How to apply:** When adding or debugging FTC Events API calls, verify the host against a real authenticated request rather than relying on the hostname wording.
