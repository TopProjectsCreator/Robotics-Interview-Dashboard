---
name: TipTap no-op updates
description: Guard autosave state against editor initialization events that report unchanged content
---

TipTap may call `onUpdate` during editor initialization after application state has already been marked hydrated. Do not treat every callback as a user edit: compare the emitted HTML with the last-saved HTML, and only mark the document dirty when they differ. When tests mutate the editor DOM directly, allow the mutation observer to process the change before dispatching the input event.

**Why:** An initialization callback with unchanged HTML can arrive after hydration and falsely block remote updates or trigger a save indicator.

**How to apply:** Use this guard in TipTap editors with autosave or dirty-state protection; component tests that edit `innerHTML` should flush one event-loop turn before firing `input`.
