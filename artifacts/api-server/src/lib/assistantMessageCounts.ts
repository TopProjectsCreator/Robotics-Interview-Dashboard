import { and, inArray, sql } from "drizzle-orm";
import { assistantMessagesTable, db } from "@workspace/db";
import { teamFilter } from "./teams";

export async function assistantMessageCounts(teamId: string, conversationIds: string[]): Promise<Map<string, number>> {
  if (!conversationIds.length) return new Map();
  const rows = await db.select({
    conversationId: assistantMessagesTable.conversationId,
    count: sql<number>`count(*)::int`,
  }).from(assistantMessagesTable).where(and(
    teamFilter(assistantMessagesTable.teamId, teamId),
    inArray(assistantMessagesTable.conversationId, conversationIds),
  )).groupBy(assistantMessagesTable.conversationId);
  return new Map(rows.map(row => [row.conversationId!, row.count]));
}
