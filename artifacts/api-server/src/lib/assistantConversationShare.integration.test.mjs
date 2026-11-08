import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

const integrationEnabled = process.env.RUN_ASSISTANT_SHARE_DB_TEST === "1";

test("assistant shares expose only authorized transcripts and stop resolving after revoke or deletion", {
  skip: !integrationEnabled,
}, async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for this integration test");
  const databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
  assert.equal(
    databaseHost.includes("supabase"),
    false,
    "Refusing to write integration fixtures to the Supabase application database; use the isolated development database",
  );

  const [{ default: app }, { pool }, { createInterviewerSession }] = await Promise.all([
    import("../app.ts"),
    import("@workspace/db"),
    import("../middlewares/adminAuth.ts"),
  ]);
  const suffix = randomUUID().replaceAll("-", "");
  const teamId = `assistant-share-team-${suffix}`;
  const otherTeamId = `assistant-share-other-team-${suffix}`;
  const ownerId = `assistant-share-owner-${suffix}`;
  const sameTeamOtherId = `assistant-share-other-owner-${suffix}`;
  const otherTeamUserId = `assistant-share-other-team-user-${suffix}`;
  const conversationId = `assistant-share-conversation-${suffix}`;
  const otherConversationId = `assistant-share-other-conversation-${suffix}`;
  const messageId = `assistant-share-message-${suffix}`;
  const unrelatedMessageId = `assistant-share-unrelated-${suffix}`;
  const server = app.listen(0, "127.0.0.1");
  let shareToken;
  let deletedConversationToken;

  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const ownerSession = createInterviewerSession(ownerId);
    const sameTeamSession = createInterviewerSession(sameTeamOtherId);
    const otherTeamSession = createInterviewerSession(otherTeamUserId);

    await pool.query(
      `create table if not exists "assistant_conversation_shares" (
         "conversation_id" text primary key references "assistant_conversations"("id") on delete cascade,
         "token" text not null unique,
         "created_by_account_id" text not null,
         "created_at" timestamptz not null default now()
       )`,
    );
    await pool.query(
      `insert into "interviewer_accounts" ("id", "display_name", "normalized_name", "password_hash", "team_id", "role")
       values ($1, 'Share owner', $1, 'configured', $2, 'interviewer'),
              ($3, 'Same team user', $3, 'configured', $2, 'interviewer'),
              ($4, 'Other team user', $4, 'configured', $5, 'interviewer')`,
      [ownerId, teamId, sameTeamOtherId, otherTeamUserId, otherTeamId],
    );
    await pool.query(
      `insert into "assistant_conversations" ("id", "team_id", "owner_id", "title")
       values ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        conversationId, teamId, ownerId, `Private title ${suffix}`,
        otherConversationId, otherTeamId, otherTeamUserId, `Other team title ${suffix}`,
      ],
    );
    await pool.query(
      `insert into "assistant_messages" ("id", "team_id", "conversation_id", "question", "answer", "applicant_ids", "activities")
       values ($1, $2, $3, 'What should we build?', 'Start with a compact drivetrain.', '["applicant-secret"]', '[{"tool":"private-tool-secret"}]'),
              ($4, $5, $6, 'Other team prompt secret', 'Other team answer secret', '[]', '[]')`,
      [messageId, teamId, conversationId, unrelatedMessageId, otherTeamId, otherConversationId],
    );

    const request = async (path, { method = "GET", session, body } = {}) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(session ? { authorization: `Bearer ${session}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let responseBody = null;
      try {
        responseBody = text ? JSON.parse(text) : null;
      } catch {
        responseBody = text;
      }
      return { response, body: responseBody, text };
    };

    const beforeShare = await request(`/assistant/conversations/${conversationId}/share`, { session: ownerSession });
    assert.equal(beforeShare.response.status, 200);
    assert.deepEqual(beforeShare.body, { active: false, token: null });

    const unauthorizedRead = await request(`/assistant/conversations/${conversationId}/share`, { session: sameTeamSession });
    assert.equal(unauthorizedRead.response.status, 404);
    const crossTeamRead = await request(`/assistant/conversations/${conversationId}/share`, { session: otherTeamSession });
    assert.equal(crossTeamRead.response.status, 404);
    const anonymousCreate = await request(`/assistant/conversations/${conversationId}/share`, { method: "POST" });
    assert.equal(anonymousCreate.response.status, 401);

    const created = await request(`/assistant/conversations/${conversationId}/share`, { method: "POST", session: ownerSession });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.active, true);
    assert.match(created.body.token, /^[A-Za-z0-9_-]{43}$/);
    shareToken = created.body.token;

    const inspection = await request(`/assistant/conversations/${conversationId}/share`, { session: ownerSession });
    assert.deepEqual(inspection.body, created.body);
    const unauthorizedCreate = await request(`/assistant/conversations/${conversationId}/share`, { method: "POST", session: sameTeamSession });
    assert.equal(unauthorizedCreate.response.status, 404);
    const crossTeamCreate = await request(`/assistant/conversations/${conversationId}/share`, { method: "POST", session: otherTeamSession });
    assert.equal(crossTeamCreate.response.status, 404);

    const publicRead = await request(`/assistant/public-shares/${shareToken}`);
    assert.equal(publicRead.response.status, 200);
    assert.deepEqual(publicRead.body, {
      heading: "Shared assistant conversation",
      messages: [{ question: "What should we build?", answer: "Start with a compact drivetrain." }],
    });
    for (const secret of [
      conversationId, ownerId, teamId, `Private title ${suffix}`,
      "applicant-secret", "private-tool-secret", "Other team prompt secret",
      "Other team answer secret",
    ]) {
      assert.equal(publicRead.text.includes(secret), false, `public response leaked ${secret}`);
    }

    const invalidToken = await request(`/assistant/public-shares/${"x".repeat(43)}`);
    assert.equal(invalidToken.response.status, 404);
    const revoked = await request(`/assistant/conversations/${conversationId}/share`, {
      method: "DELETE",
      session: ownerSession,
    });
    assert.equal(revoked.response.status, 204);
    const revokedRead = await request(`/assistant/public-shares/${shareToken}`);
    assert.equal(revokedRead.response.status, 404);

    const secondShare = await request(`/assistant/conversations/${conversationId}/share`, {
      method: "POST",
      session: ownerSession,
    });
    assert.equal(secondShare.response.status, 201);
    deletedConversationToken = secondShare.body.token;
    const deleted = await request(`/assistant/conversations/${conversationId}`, {
      method: "DELETE",
      session: ownerSession,
    });
    assert.equal(deleted.response.status, 204);
    const deletedRead = await request(`/assistant/public-shares/${deletedConversationToken}`);
    assert.equal(deletedRead.response.status, 404);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await pool.query(`delete from "assistant_messages" where "id" = any($1::text[])`, [[messageId, unrelatedMessageId]]);
    await pool.query(`delete from "assistant_conversation_shares" where "conversation_id" = any($1::text[])`, [[conversationId, otherConversationId]]);
    await pool.query(`delete from "assistant_conversations" where "id" = any($1::text[])`, [[conversationId, otherConversationId]]);
    await pool.query(`delete from "interviewer_accounts" where "id" = any($1::text[])`, [[ownerId, sameTeamOtherId, otherTeamUserId]]);
    await pool.end();
  }
});
