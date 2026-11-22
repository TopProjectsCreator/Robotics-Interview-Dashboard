export type GhostableChatMessageState = {
  deletedAt: Date | string | null;
  ghostedAt: Date | string | null;
} | null | undefined;

export type ChatGhostState = "missing" | "not-deleted" | "already-ghosted" | "needs-ghost";
export type ChatGhostTransitionOutcome = "transitioned" | ChatGhostState;

export function chatGhostState(message: GhostableChatMessageState): ChatGhostState {
  if (!message) return "missing";
  if (!message.deletedAt) return "not-deleted";
  if (message.ghostedAt) return "already-ghosted";
  return "needs-ghost";
}

export async function resolveChatGhostTransition(
  transition: () => Promise<boolean>,
  readPersistedState: () => Promise<GhostableChatMessageState>,
): Promise<ChatGhostTransitionOutcome> {
  if (await transition()) return "transitioned";
  return chatGhostState(await readPersistedState());
}
