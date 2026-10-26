---
name: Streaming large object downloads
description: Large CAD objects must be streamed to disk, never buffered in memory, because the instance has a 512 MB ceiling.
---

Downloading a stored object for conversion used to read the whole body into a `Buffer` and write it to disk in one step. A 166 MB CAD model plus the converter process needed roughly 500 MB in a single process, which is an out-of-memory kill on the 512 MB instance.

The download now requests a signed URL and pipes the response body to the file handle in chunks, so the resident cost stays flat regardless of model size.

**Why:** The failure looked like a converter crash rather than a memory problem, and it only reproduced on the largest files, so it was easy to misattribute to the CAD kernel.

**How to apply:** When moving a stored object to disk, stream it: open the target file, read the response body with a reader, and write each chunk before reading the next. Do not call `response.arrayBuffer()` or `response.blob()` for objects that can exceed tens of megabytes. The same rule applies to the reverse direction when uploading generated previews.
