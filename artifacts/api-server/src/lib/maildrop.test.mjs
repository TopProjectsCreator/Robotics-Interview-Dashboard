import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

// The source files import siblings without an extension; teach node how to
// resolve those the same way the other tests in this folder do.
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

process.env.MAILDROP_MAILBOX = "team-inbox";
process.env.MAILDROP_ALLOWED_SENDERS = "coach@wolverines.org";

const calls = [];
function graphqlResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// The module under test imports @workspace/db, which resolves through a
// directory import that plain node cannot load; stub it like the other
// tests do. Only the GraphQL client and the sender rule are exercised here.
mock.module("@workspace/db", {
  namedExports: {
    db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }), insert: () => ({ values: () => ({ onConflictDoNothing: async () => {} }) }) },
    ingestedEmailsTable: { id: "id", mailbox: "mailbox", messageId: "message_id" },
    interviewChatMessagesTable: { id: "id" },
  },
});
mock.module("./realtime.ts", { namedExports: { pushRealtimeHint() {} } });

const { listMailboxMessages, fetchMailboxMessage, senderAllowed, maildropConfigured } = await import(
  `./maildrop.ts?test=${Date.now()}`
);

test("the mailbox listing is fetched with a GraphQL POST and mapped", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return graphqlResponse({
      data: {
        inbox: [
          { id: "m1", headerfrom: "Coach <coach@wolverines.org>", subject: "Practice moved", date: "2026-10-20T10:00:00.000Z" },
        { id: "m2", headerfrom: "Other <other@example.com>", subject: "Hello", date: null },
      ],
      },
    });
  };
  try {
    const messages = await listMailboxMessages("team-inbox");
    assert.equal(messages.length, 2);
    assert.equal(messages[0].id, "m1");
    assert.equal(messages[0].from, "Coach <coach@wolverines.org>");
    assert.equal(messages[1].date, null);
    const call = calls[0];
    assert.equal(call.url, "https://api.maildrop.cc/graphql");
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers["Content-Type"], "application/json");
    const body = JSON.parse(call.init.body);
    assert.match(body.query, /inbox\(mailbox: \$mailbox\)/);
    assert.equal(body.variables.mailbox, "team-inbox");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("a message body is read from the plain text part", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    graphqlResponse({
      data: {
        message: {
          id: "m1",
          headerfrom: "Coach <coach@wolverines.org>",
          subject: "Practice moved",
          date: "2026-10-20T10:00:00.000Z",
          data: "Bring the robot charged.",
          html: "<p>Bring the robot charged.</p>",
        },
      },
    });
  try {
    const message = await fetchMailboxMessage("team-inbox", "m1");
    assert.equal(message.body, "Bring the robot charged.");
    assert.equal(message.subject, "Practice moved");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("an html-only email is reduced to readable text", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    graphqlResponse({
      data: {
        message: {
          id: "m2",
          headerfrom: "Coach <coach@wolverines.org>",
          subject: "Hi",
          date: null,
          data: "",
          html: "<style>p{color:red}</style><p>Hello &amp; welcome</p><br/>See you",
        },
      },
    });
  try {
    const message = await fetchMailboxMessage("team-inbox", "m2");
    assert.match(message.body, /Hello & welcome/);
    assert.doesNotMatch(message.body, /color:red/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("a GraphQL error is reported instead of silently ignored", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => graphqlResponse({ errors: [{ message: "mailbox not found" }] });
  try {
    await assert.rejects(() => listMailboxMessages("team-inbox"), /mailbox not found/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("only allow-listed senders are accepted", () => {
  assert.equal(senderAllowed("Coach <coach@wolverines.org>"), true);
  assert.equal(senderAllowed("coach@wolverines.org"), true);
  assert.equal(senderAllowed("stranger@example.com"), false);
  assert.equal(senderAllowed("Coach <coach@evil.com>"), false);
});

test("the integration stays inert until it is configured", () => {
  assert.equal(maildropConfigured(), true, "configured with a mailbox and an allow list");
  const previous = process.env.MAILDROP_ALLOWED_SENDERS;
  process.env.MAILDROP_ALLOWED_SENDERS = "";
  assert.equal(maildropConfigured(), false, "no allow list means nothing is posted");
  process.env.MAILDROP_ALLOWED_SENDERS = previous;
});
