const CHAT_ATTACHMENT_URL_PATTERN =
  /\/api\/storage\/objects\/([A-Za-z0-9-]{8,128})(?![A-Za-z0-9-])/g;

export function chatAttachmentObjectIds(message: string): string[] {
  const ids = new Set<string>();
  for (const match of message.matchAll(CHAT_ATTACHMENT_URL_PATTERN)) {
    ids.add(match[1]);
  }
  return [...ids];
}

export async function cleanupChatMessageAttachments(message: string): Promise<boolean> {
  const objectIds = chatAttachmentObjectIds(message);
  let failed = false;

  for (const objectId of objectIds) {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/storage/objects/${encodeURIComponent(objectId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok && response.status !== 404) failed = true;
    } catch {
      failed = true;
    }
  }

  return failed;
}