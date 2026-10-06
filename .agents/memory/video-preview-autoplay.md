---
name: Video preview autoplay
description: Iframe autoplay permissions affect whether the robotics tutorial's music starts automatically.
---

Keep the iframe preview's initial audio state unmuted, but catch autoplay rejection and reflect the muted state in the speaker control. The speaker button must retry playback directly from a user gesture. Keep the non-iframe export path unmuted.

**Why:** Chromium can reject audio autoplay inside an iframe without autoplay delegation. Replit's preview may grant permission while a hand-built test iframe does not; a rejected play or a muted icon alone does not prove audio is advancing.

**How to apply:** When changing preview audio, test both iframe permission states and verify that clicking unmute starts audio whose `currentTime` advances. Separately preserve the unmuted export default.
