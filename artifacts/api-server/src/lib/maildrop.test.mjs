import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

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

const tables = {
  inboxes: { teamId: "team_id", mailbox: "mailbox", enabled: "enabled", allowedSenders: "allowed_senders" },
  emails: { id: "id", mailbox: "mailbox", messageId: "message_id" },
  messages: { id: "id" },
};
const state = () => ({ inboxes: [], emails: [], messages: [] });
const databases = { primary: createDatabase(), secondary: createDatabase() };
let activeDatabase = databases.primary;

function createDatabase() {
  const rows = state();
  const tableKey = (table) => table === tables.inboxes ? "inboxes" : table === tables.emails ? "emails" : "messages";
  const matches = (row, condition, table) => {
    if (!condition) return true;
    const property = Object.entries(table).find(([, column]) => column === condition.field)?.[0] ?? condition.field;
    return row[property] === condition.value;
  };
  const db = {
    select() {
      return {
        from(table) {
          return {
            where(condition) {
              const result = () => rows[tableKey(table)].filter(row => matches(row, condition, table));
              return {
                limit: async (count) => result().slice(0, count),
                then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
              };
            },
          };
        },
      };
    },
    insert(table) {
      return {
        values(value) {
          const insert = () => {
            const collection = rows[tableKey(table)];
            if (table === tables.emails && collection.some(row => row.mailbox === value.mailbox && row.messageId === value.messageId)) return null;
            if (table === tables.inboxes && (collection.some(row => row.teamId === value.teamId) || collection.some(row => row.mailbox === value.mailbox))) return null;
            const row = { ...value };
            collection.push(row);
            return row;
          };
          const chain = {
            onConflictDoNothing() {
              const row = insert();
              return {
                returning: async (selection) => row
                  ? [selection ? Object.fromEntries(Object.entries(selection).map(([key]) => [key, row[key]])) : row]
                  : [],
                then: (resolve, reject) => Promise.resolve(row).then(resolve, reject),
              };
            },
            async returning(selection) {
              const row = insert();
              return row ? [selection ? Object.fromEntries(Object.entries(selection).map(([key]) => [key, row[key]])) : row] : [];
            },
            async onConflictDoUpdate({ set }) {
              const existing = rows.inboxes.find(row => row.teamId === value.teamId);
              if (existing) Object.assign(existing, set);
              else insert();
            },
          };
          return chain;
        },
      };
    },
    update(table) {
      return {
        set(values) {
          return {
            async where(condition) {
              const row = rows[tableKey(table)].find(item => matches(item, condition, table));
              if (row) Object.assign(row, values);
            },
          };
        },
      };
    },
    async transaction(callback) {
      return callback(db);
    },
    rows,
  };
  return db;
}

const routedDb = {
  select: (...args) => activeDatabase.select(...args),
  insert: (...args) => activeDatabase.insert(...args),
  update: (...args) => activeDatabase.update(...args),
  transaction: (...args) => activeDatabase.transaction(...args),
};

mock.module("drizzle-orm", {
  namedExports: {
    eq: (field, value) => ({ field, value }),
  },
});
mock.module("@workspace/db", {
  namedExports: {
    db: routedDb,
    primaryDb: databases.primary,
    secondaryDb: () => databases.secondary,
    hasSecondary: () => true,
    runWithInstance: (instance, callback) => {
      const previous = activeDatabase;
      activeDatabase = databases[instance];
      const result = callback();
      if (result && typeof result.then === "function") return result.finally(() => { activeDatabase = previous; });
      activeDatabase = previous;
      return result;
    },
    DEFAULT_TEAM_ID: "default",
    maildropInboxesTable: tables.inboxes,
    ingestedEmailsTable: tables.emails,
    interviewChatMessagesTable: tables.messages,
  },
});
mock.module("./realtime.ts", { namedExports: { pushRealtimeHint() {} } });

const {
  fetchMailboxMessage,
  forwardingAddress,
  getTeamMailboxSettings,
  ingestMailboxIntoChat,
  isValidSenderAddress,
  listMailboxMessages,
  maildropConfigured,
  migrateLegacyDefaultMailbox,
  pollTeamMailboxesOnce,
  saveTeamMailboxSettings,
  senderAllowed,
} = await import(`./maildrop.ts?test=${Date.now()}`);

const graphqlCalls = [];
function graphqlResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function clearDatabase(database) {
  database.rows.inboxes.length = 0;
  database.rows.emails.length = 0;
  database.rows.messages.length = 0;
}

test("the mailbox listing uses the Maildrop GraphQL API", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    graphqlCalls.push({ url, init });
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
    const call = graphqlCalls.at(-1);
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
  globalThis.fetch = async () => graphqlResponse({
    data: { message: {
      id: "m1", headerfrom: "Coach <coach@wolverines.org>", subject: "Practice moved",
      date: "2026-10-20T10:00:00.000Z", data: "Bring the robot charged.",
      html: "<p>Bring the robot charged.</p>",
    } },
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
  globalThis.fetch = async () => graphqlResponse({
    data: { message: {
      id: "m2", headerfrom: "Coach <coach@wolverines.org>", subject: "Hi", date: null,
      data: "", html: "<style>p{color:red}</style><p>Hello &amp; welcome</p><br/>See you",
    } },
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

test("approved senders must match the exact email address", () => {
  assert.equal(senderAllowed("Coach <coach@wolverines.org>", ["coach@wolverines.org"]), true);
  assert.equal(senderAllowed("coach@wolverines.org", ["coach@wolverines.org"]), true);
  assert.equal(senderAllowed("coach@wolverines.org.attacker.net", ["coach@wolverines.org"]), false);
  assert.equal(senderAllowed("Coach <coach@evil.com>", ["coach@wolverines.org"]), false);
  assert.equal(senderAllowed("Coach <coach@wolverines.org>", ["wolverines.org"]), true);
  assert.equal(senderAllowed("Coach <coach@robotics.wolverines.org>", ["wolverines.org"]), true);
  assert.equal(senderAllowed("Coach <coach@wolverines.org.attacker.net>", ["wolverines.org"]), false);
  assert.equal(isValidSenderAddress("coach@wolverines.org"), true);
  assert.equal(isValidSenderAddress("not-an-email"), false);
});

test("each team gets a durable independent mailbox configuration", async () => {
  clearDatabase(databases.primary);
  clearDatabase(databases.secondary);
  const first = await saveTeamMailboxSettings("team-a", true, ["coach@wolverines.org"]);
  const second = await saveTeamMailboxSettings("team-b", false, ["mentor@example.com"]);
  assert.notEqual(first.mailbox, second.mailbox);
  assert.equal(forwardingAddress(first.mailbox), `${first.mailbox}@maildrop.cc`);
  assert.deepEqual(await getTeamMailboxSettings("team-a"), first);
  assert.deepEqual(await getTeamMailboxSettings("team-b"), second);
  assert.equal((await getTeamMailboxSettings("team-a")).enabled, true);
  assert.equal((await getTeamMailboxSettings("team-b")).enabled, false);
  const restarted = await import(`./maildrop.ts?restart=${Date.now()}`);
  assert.deepEqual(await restarted.getTeamMailboxSettings("team-a"), first);
  activeDatabase = databases.secondary;
  assert.equal((await getTeamMailboxSettings("team-a")).mailbox, null);
  activeDatabase = databases.primary;
  await assert.rejects(() => saveTeamMailboxSettings("team-a", true, ["invalid"]), /valid email addresses or domains/);
  await assert.rejects(() => saveTeamMailboxSettings("team-a", true, []), /at least one/);
});

test("the default-team environment inbox migrates without losing its mailbox or allow-list", async () => {
  clearDatabase(databases.primary);
  const previousMailbox = process.env.MAILDROP_MAILBOX;
  const previousSenders = process.env.MAILDROP_ALLOWED_SENDERS;
  process.env.MAILDROP_MAILBOX = "legacy-team-inbox";
  process.env.MAILDROP_ALLOWED_SENDERS = "Coach@Wolverines.org,wolverines.org";
  try {
    assert.equal(maildropConfigured(), true);
    await migrateLegacyDefaultMailbox();
    const saved = await getTeamMailboxSettings("default");
    assert.equal(saved.mailbox, "legacy-team-inbox");
    assert.deepEqual(saved.allowedSenders, ["coach@wolverines.org", "wolverines.org"]);
    assert.equal(saved.enabled, true);
    assert.equal(saved.legacy, false);
    await saveTeamMailboxSettings("default", false, ["coach@wolverines.org", "wolverines.org"]);
    await migrateLegacyDefaultMailbox();
    assert.equal((await getTeamMailboxSettings("default")).enabled, false);
  } finally {
    process.env.MAILDROP_MAILBOX = previousMailbox;
    process.env.MAILDROP_ALLOWED_SENDERS = previousSenders;
  }
});

test("manual ingestion and polling post allowed mail only to its team's own chat", async () => {
  clearDatabase(databases.primary);
  clearDatabase(databases.secondary);
  const previousFetch = globalThis.fetch;
  const mailboxMessages = {
    "team-a-mailbox": [
      { id: "same-message-id", headerfrom: "Coach <coach@team-a.example>", subject: "A approved", date: null },
      { id: "blocked-message", headerfrom: "stranger@example.net", subject: "A blocked", date: null },
    ],
    "team-b-mailbox": [
      { id: "same-message-id", headerfrom: "Mentor <mentor@team-b.example>", subject: "B approved", date: null },
    ],
  };
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    const mailbox = request.variables.mailbox;
    if (request.query.includes("inbox(")) {
      return graphqlResponse({ data: { inbox: mailboxMessages[mailbox] ?? [] } });
    }
    const summary = mailboxMessages[mailbox]?.find(item => item.id === request.variables.id);
    return graphqlResponse({ data: { message: summary ? {
      ...summary, data: `Body for ${mailbox}`, html: "",
    } : null } });
  };
  try {
    await saveTeamMailboxSettings("team-a", true, ["coach@team-a.example"]);
    await saveTeamMailboxSettings("team-b", true, ["mentor@team-b.example"]);
    databases.primary.rows.inboxes.find(row => row.teamId === "team-a").mailbox = "team-a-mailbox";
    databases.secondary.rows.inboxes.push({
      teamId: "team-b", mailbox: "team-b-mailbox", enabled: true, allowedSenders: ["mentor@team-b.example"],
    });
    activeDatabase = databases.primary;
    const manual = await ingestMailboxIntoChat("team-a");
    assert.deepEqual(manual, { posted: 1, skipped: 1 });
    assert.equal(databases.primary.rows.messages.length, 1);
    assert.equal(databases.primary.rows.messages[0].teamId, "team-a");
    assert.equal(databases.primary.rows.messages[0].conversationScope, "shared");
    assert.equal(databases.primary.rows.emails.find(row => row.messageId === "blocked-message").postedMessageId, null);

    // A second manual check cannot duplicate accepted chat messages.
    const duplicate = await ingestMailboxIntoChat("team-a");
    assert.deepEqual(duplicate, { posted: 0, skipped: 2 });
    assert.equal(databases.primary.rows.messages.length, 1);

    await pollTeamMailboxesOnce();
    assert.equal(databases.secondary.rows.messages.length, 1);
    assert.equal(databases.secondary.rows.messages[0].teamId, "team-b");
    assert.equal(databases.primary.rows.messages.length, 1);
    assert.equal(databases.secondary.rows.emails[0].mailbox, "team-b-mailbox");
  } finally {
    globalThis.fetch = previousFetch;
    activeDatabase = databases.primary;
  }
});
