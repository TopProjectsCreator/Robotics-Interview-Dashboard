---
name: SimpleWebAuthn client contract
description: Async browser capability checks and wrapped WebAuthn options used by the dashboard
---

`browserSupportsPasskeys()` from `@simplewebauthn/browser` returns a promise; await it before deciding whether to show passkey actions, and treat a rejected capability check as unsupported. The dashboard API wraps ceremony options as `{ publicKey: ... }`, while `startRegistration()` and `startAuthentication()` need the inner options object.

**Why:** A real-browser ceremony exposed a malformed options handoff, and unsupported browsers appeared supported when the async result was treated as a boolean.

**How to apply:** When upgrading or changing the SimpleWebAuthn client, verify the package's runtime signatures and exercise both registration and authentication in a browser with a virtual authenticator.
