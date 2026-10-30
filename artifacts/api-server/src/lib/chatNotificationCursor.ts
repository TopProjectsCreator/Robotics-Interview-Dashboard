export type ChatNotificationCursor = { createdAt: string; id: string };

export function encodeChatNotificationCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id }), "utf8").toString("base64url");
}

export function decodeChatNotificationCursor(value: string): ChatNotificationCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.createdAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== "string"
    ) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
