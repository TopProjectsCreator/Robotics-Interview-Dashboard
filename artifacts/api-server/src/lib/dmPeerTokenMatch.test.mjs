import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(
  fileURLToPath(new URL("../routes/robotics.ts", import.meta.url)),
  "utf8",
);

// Mirrors the separator-wrapped predicate used by the conversations query.
const SEP = String.fromCharCode(31);
function viewerInPeerKey(viewer, peerKey) {
  return (SEP + peerKey.toLowerCase() + SEP).includes(SEP + viewer.toLowerCase() + SEP);
}

test("viewer label must match a whole peer-key token", () => {
  assert.equal(viewerInPeerKey("Ishaan", `Clinton${SEP}Ishaan`), true);
  assert.equal(viewerInPeerKey("Ishaan", `Ishaan${SEP}Clinton`), true);
  // "Yishaan" contains "ishaan" but is a different person. This phantom match
  // produced an unread "Clinton" DM that no receipt could ever clear.
  assert.equal(viewerInPeerKey("Ishaan", `Clinton${SEP}Yishaan`), false);
  assert.equal(viewerInPeerKey("Ishaan", `Yishaan${SEP}Clinton`), false);
});

test("conversations query uses the exact-token predicate", () => {
  const start = source.indexOf('router.get("/queue/chat/conversations"');
  assert.notEqual(start, -1);
  const query = source.slice(start, start + 2600);
  assert.match(query, /chr\(31\) \|\| lower\(\$1\) \|\| chr\(31\)/);
  assert.doesNotMatch(
    query,
    /position\(lower\(\$1\) in lower\(m\.conversation_peer\)\)/,
    "bare substring matching resurrects the phantom unread DM",
  );
});
