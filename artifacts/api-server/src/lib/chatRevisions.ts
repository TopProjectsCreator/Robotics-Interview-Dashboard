// Team content revisions deliberately invalidate all team threads. This trades
// some extra changed-response loads for fixed-size, history-independent checks.
// Sidebar reads are viewer-specific; thread receipts are visible to everyone.
export async function chatRevision(
  teamId: string,
  viewerId: string | undefined,
  pool: {
    query: (query: string, parameters: unknown[]) => Promise<{
      rows: Array<{ revision_key: string; revision: string }>;
    }>;
  },
): Promise<string> {
  const readKey = viewerId ? `reader:${viewerId}` : "reads";
  const { rows } = await pool.query(
    `select revision_key, revision::text from chat_revisions
      where team_id = $1 and revision_key = any($2::text[])`,
    [teamId, ["content", readKey]],
  );
  const revisions = new Map(rows.map(row => [row.revision_key, row.revision]));
  return JSON.stringify(["chat-revision-v1", teamId, viewerId ?? null,
    revisions.get("content") ?? "0", revisions.get(readKey) ?? "0"]);
}
