---
name: Dashboard component test isolation
description: Why dashboard jsdom component tests isolate the whiteboard editor dependency
---

Dashboard component tests should stub the whiteboard editor’s Excalidraw module and stylesheet in the test-only Vite config.

**Why:** The production Excalidraw dependency imports a JSON asset in a way that Vitest’s Node/jsdom runner cannot load, even though the browser build works. The attachment renderer does not depend on the editor, so loading the full app should not make format coverage impossible.

**How to apply:** Keep the stubs scoped to the test config and test-stub directory; do not change the production Vite aliases or whiteboard implementation to accommodate jsdom.