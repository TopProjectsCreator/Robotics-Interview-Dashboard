import { isAdminRole } from "./roles.ts";

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

export type GhostDeletedChatMessageAuthorizationFailure = {
  status: 403;
  error: string;
};

export function ghostDeletedChatMessageAuthorizationFailure(
  role: string | null | undefined,
): GhostDeletedChatMessageAuthorizationFailure | null {
  if (isAdminRole(role)) return null;
  return {
    status: 403,
    error: "Only coordinators and admins can ghost deleted chat messages.",
  };
}