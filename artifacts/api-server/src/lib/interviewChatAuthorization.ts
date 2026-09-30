export type AssistantChatPostAuthorizationFailure = {
  status: 403;
  error: string;
};

export function assistantChatPostAuthorizationFailure(
  author: string,
  conversationAuthor: string | null | undefined,
  signedInInterviewerLabel: string,
): AssistantChatPostAuthorizationFailure | null {
  if (
    author.trim() === "AI assistant" &&
    conversationAuthor?.trim().toLocaleLowerCase() !== signedInInterviewerLabel.toLocaleLowerCase()
  ) {
    return {
      status: 403,
      error: "Assistant messages must be tied to the signed-in interviewer.",
    };
  }
  return null;
}