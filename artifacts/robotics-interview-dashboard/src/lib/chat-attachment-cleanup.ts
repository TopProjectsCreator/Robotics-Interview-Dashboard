// Matches user uploads (/objects/<id>), AI-generated images
// (/objects/generated/<id>), external CAD models (/objects/ext/<id>) and
// chunked uploads (/objects/chunk/<id>, or /objects/chunk/secondary/<id>
// when the file was failed over to the secondary bucket).
//
// The storage instance segment has to be matched explicitly. Without it the
// generic id group swallowed the literal "secondary" and the delete request
// went to /objects/chunk/secondary, which the server answers with 404 -- so
// deleting a chat message silently left the object in storage forever.
const CHAT_ATTACHMENT_URL_PATTERN =
  /\/api\/storage\/objects\/(?:(generated|ext)\/([A-Za-z0-9-]{8,128})|chunk\/(?:(primary|secondary)\/)?([A-Za-z0-9-]{8,128})|([A-Za-z0-9-]{8,128}))(?![A-Za-z0-9-])/g;

export function chatAttachmentObjectIds(message: string): string[] {
  const ids = new Set<string>();
  for (const match of message.matchAll(CHAT_ATTACHMENT_URL_PATTERN)) {
    const [, generatedOrExt, generatedOrExtId, instance, chunkId, plainId] = match;
    if (generatedOrExt) {
      ids.add(`${generatedOrExt}/${generatedOrExtId}`);
      continue;
    }
    if (chunkId) {
      ids.add(`chunk/${instance ? `${instance}/` : ""}${chunkId}`);
      continue;
    }
    if (plainId) ids.add(plainId);
  }
  return [...ids];
}

export async function cleanupChatMessageAttachments(message: string): Promise<boolean> {
  const objectIds = chatAttachmentObjectIds(message);
  let failed = false;

  for (const objectId of objectIds) {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/storage/objects/${objectId.split("/").map(encodeURIComponent).join("/")}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok && response.status !== 404) failed = true;
    } catch {
      failed = true;
    }
  }

  return failed;
}