export function addTeamEmojiMarkdown(message: string, emojiPaths: ReadonlyMap<string, string>): string {
  return message.replace(/(```[\s\S]*?```|`[^`\n]*`)|:([a-z0-9_]{2,32}):/gi, (token, code, shortcode: string | undefined) => {
    if (code || !shortcode) return token;
    const objectPath = emojiPaths.get(shortcode.toLowerCase());
    const objectId = objectPath?.match(/^\/objects\/([a-z0-9_-]+)$/i)?.[1];
    if (!objectId) return token;
    return `![emoji:${shortcode}](/api/storage/objects/${encodeURIComponent(objectId)})`;
  });
}