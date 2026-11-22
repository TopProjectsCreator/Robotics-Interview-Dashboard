---
name: Chat conversation custom dropdown
description: The chat workspace conversation picker is a hand-built listbox; unread conversations use a red indicator instead of "New —" text.
---

The chat workspace conversation picker (`components/ChatConversationDropdown.tsx`) is a custom React listbox — no native `<select>` and no UI-library select. Unread conversations show a red label plus a red dot; they never show a literal "New — " prefix.

**Why:** Native `<select>` options cannot be styled per option, so unread state had been encoded as text in the option label. The user asked for a dropdown built in our own code with the read/unread state shown in red instead.

**How to apply:** Keep the trigger test id `select-chat-conversation`, its `data-value` attribute (browser tests used to call `inputValue()` on the native select), and option test ids `chat-conversation-option-<value>` (`channel:<id>`, `direct:<peer>`, `team`). Tests must open the menu and click an option instead of calling `fireEvent.change` on a native select; preserve keyboard navigation, outside-click dismissal, and the red unread styling when editing this picker.
