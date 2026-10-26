/**
 * Always-on abuse guards for the team chat.
 *
 * These are NOT the optional slow mode (a per-team setting an admin can
 * turn off). They are the floor that keeps the shared channel usable no
 * matter how a team configures it:
 *
 * - a hard posting rate limit per ACCOUNT (not per IP: the caller's address
 *   is spoofable, so keying on it would not stop anyone),
 * - duplicate-message suppression, which is what actually kills the
 *   "same sentence over and over" spam,
 * - a tight limit on @ai triggers, because each one costs an AI call,
 * - display-name validation, so an account cannot be registered as
 *   "someone@example.com" and pass itself off as a person,
 * - a per-address cap on account creation.
 */

const POST_WINDOW_MS = 10_000;
const POST_MAX_PER_WINDOW = 6;
const POST_MIN_SPACING_MS = 1_200;
const DUPLICATE_WINDOW_MS = 60_000;
const AI_MENTION_WINDOW_MS = 30_000;
const AI_MENTIONS_PER_WINDOW = 2;
const ACCOUNT_CREATION_WINDOW_MS = 60 * 60 * 1000;
const ACCOUNT_CREATIONS_PER_WINDOW = 10;

type Counter = { count: number; resetAt: number };
type LastPost = { at: number; text: string };

const postCounters = new Map<string, Counter>();
const lastPosts = new Map<string, LastPost>();
const aiMentionCounters = new Map<string, Counter>();
const accountCreationCounters = new Map<string, Counter>();

function bump(map: Map<string, Counter>, key: string, windowMs: number, limit: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Drops expired entries so the maps cannot grow without bound. */
function sweep(): void {
  const now = Date.now();
  for (const [key, counter] of postCounters) if (counter.resetAt <= now) postCounters.delete(key);
  for (const [key, counter] of aiMentionCounters) if (counter.resetAt <= now) aiMentionCounters.delete(key);
  for (const [key, counter] of accountCreationCounters) if (counter.resetAt <= now) accountCreationCounters.delete(key);
  for (const [key, post] of lastPosts) if (post.at + DUPLICATE_WINDOW_MS <= now) lastPosts.delete(key);
}

let lastSweepAt = 0;
function maybeSweep(): void {
  const now = Date.now();
  if (now - lastSweepAt < 60_000) return;
  lastSweepAt = now;
  sweep();
}

export type SpamVerdict = { allowed: true } | { allowed: false; error: string; retryAfter: number };

/**
 * The hard floor for posting: a burst cap plus a minimum spacing between
 * messages. Applies to every conversation (shared and direct).
 */
export function checkPostAllowed(accountId: string): SpamVerdict {
  maybeSweep();
  const rate = bump(postCounters, accountId, POST_WINDOW_MS, POST_MAX_PER_WINDOW);
  if (!rate.allowed) {
    return {
      allowed: false,
      error: "You are sending messages too quickly. Take a breath and try again.",
      retryAfter: rate.retryAfter,
    };
  }
  const previous = lastPosts.get(accountId);
  if (previous && Date.now() - previous.at < POST_MIN_SPACING_MS) {
    return {
      allowed: false,
      error: "Slow down a moment before sending again.",
      retryAfter: Math.max(1, Math.ceil((POST_MIN_SPACING_MS - (Date.now() - previous.at)) / 1000)),
    };
  }
  return { allowed: true };
}

/** Records the text just posted so an identical follow-up can be rejected. */
export function recordPost(accountId: string, text: string): void {
  lastPosts.set(accountId, { at: Date.now(), text: normalizeSpamText(text) });
}

/**
 * Rejects a message that repeats the author's own previous message. Repeated
 * identical posts are the most common spam shape and this stops them
 * without touching normal conversation.
 */
export function checkDuplicatePost(accountId: string, text: string): SpamVerdict {
  maybeSweep();
  const previous = lastPosts.get(accountId);
  if (!previous) return { allowed: true };
  const now = Date.now();
  if (now - previous.at > DUPLICATE_WINDOW_MS) return { allowed: true };
  if (previous.text !== normalizeSpamText(text)) return { allowed: true };
  return {
    allowed: false,
    error: "That is the same message you just sent.",
    retryAfter: Math.max(1, Math.ceil((DUPLICATE_WINDOW_MS - (now - previous.at)) / 1000)),
  };
}

/** Each @ai trigger costs an AI call, so it gets its own tighter budget. */
export function checkAiMentionAllowed(accountId: string, message: string): SpamVerdict {
  if (!/@ai\b/i.test(message)) return { allowed: true };
  maybeSweep();
  const verdict = bump(aiMentionCounters, accountId, AI_MENTION_WINDOW_MS, AI_MENTIONS_PER_WINDOW);
  if (!verdict.allowed) {
    return {
      allowed: false,
      error: "The assistant is being asked too often. Try again in a moment.",
      retryAfter: verdict.retryAfter,
    };
  }
  return { allowed: true };
}

/** Caps how many accounts can be created from one address in an hour. */
export function checkAccountCreationAllowed(address: string): SpamVerdict {
  maybeSweep();
  const verdict = bump(accountCreationCounters, address, ACCOUNT_CREATION_WINDOW_MS, ACCOUNT_CREATIONS_PER_WINDOW);
  if (!verdict.allowed) {
    return {
      allowed: false,
      error: "Too many accounts were created from this network. Try again later.",
      retryAfter: verdict.retryAfter,
    };
  }
  return { allowed: true };
}

function normalizeSpamText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * A person's display name should look like a name. Rejects email addresses,
 * links, and domain-like strings so an account cannot be created that
 * impersonates a person or a service.
 */
export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "A name is required.";
  if (trimmed.length > 40) return "Names are up to 40 characters.";
  if (trimmed.includes("@")) return "Use your name, not an email address.";
  if (/https?:\/\//i.test(trimmed)) return "Use your name, not a link.";
  if (/\b[\w-]+\.(com|net|org|io|co|app|dev|me|xyz)\b/i.test(trimmed)) {
    return "Use your name, not a website address.";
  }
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) return "Use your name, not an email address.";
  return null;
}
