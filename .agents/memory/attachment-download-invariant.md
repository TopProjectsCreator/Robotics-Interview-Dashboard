---
name: Attachment download invariant
description: Product requirement for keeping original files downloadable beside every inline preview.
---

Every file preview in chat and workspace views must keep a visible download action for the original file. Previewing a file must not replace the ability to download it.

**Why:** The user explicitly requested that files remain downloadable even when a preview is available.

**How to apply:** Link to the original fetched Blob, not a converted preview, for images, documents, spreadsheets, audio/video, calendar files, CAD models, archives, and extracted archive members. Keep the download action visible beside the preview.
