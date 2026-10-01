const CHAT_ATTACHMENT_OBJECT_PATH = /^\/objects\/([A-Za-z0-9-]{8,128})$/;

export function messageReferencesChatAttachment(message: string, objectPath: string): boolean {
  const objectId = CHAT_ATTACHMENT_OBJECT_PATH.exec(objectPath)?.[1];
  if (!objectId) return false;

  return message.includes(`/api/storage/objects/${objectId}`)
    && new RegExp(`/api/storage/objects/${objectId}(?![A-Za-z0-9-])`).test(message);
}

export function isChatAttachmentReferenced(
  objectPath: string,
  messages: readonly string[],
): boolean {
  return messages.some((message) => messageReferencesChatAttachment(message, objectPath));
}