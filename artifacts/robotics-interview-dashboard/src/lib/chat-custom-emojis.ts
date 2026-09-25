export function getTeamEmojiStorageUrl(shortcode: string, emojiPaths: ReadonlyMap<string, string>): string | null {
  const name = shortcode.match(/^:([a-z0-9_]{2,32}):$/i)?.[1];
  if (!name) return null;
  const objectPath = emojiPaths.get(name.toLowerCase());
  const objectId = objectPath?.match(/^\/objects\/([a-z0-9_-]+)$/i)?.[1];
  if (!objectId) return null;
  return `/api/storage/objects/${encodeURIComponent(objectId)}`;
}

export function addTeamEmojiMarkdown(message: string, emojiPaths: ReadonlyMap<string, string>): string {
  return message.replace(/(```[\s\S]*?```|`[^`\n]*`)|:([a-z0-9_]{2,32}):/gi, (token, code, shortcode: string | undefined) => {
    if (code || !shortcode) return token;
    const imageUrl = getTeamEmojiStorageUrl(`:${shortcode}:`, emojiPaths);
    return imageUrl ? `![emoji:${shortcode}](${imageUrl})` : token;
  });
}