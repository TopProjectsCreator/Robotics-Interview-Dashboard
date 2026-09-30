import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import WebSocket from "ws";
import { interviewerAccountsTable } from "../../../../lib/db/src/schema/interviewerAccounts.ts";
import { revokedSessionsTable } from "../../../../lib/db/src/schema/sessions.ts";
import { interviewWhiteboardsTable } from "../../../../lib/db/src/schema/whiteboards.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        specifier.startsWith(".") &&
        !specifier.endsWith(".ts") &&
        !specifier.endsWith(".js")
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const board = {
  id: "whiteboard-collaboration-test",
  title: "Collaboration test",
  data: JSON.stringify({ elements: [] }),
  createdBy: "interviewer-one",
  conversationScope: "shared",
  conversationPeer: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const accounts = [
  { id: "interviewer-one", displayName: "Alex", passwordHash: "configured" },
  { id: "interviewer-two", displayName: "Jordan", passwordHash: "configured" },
];

function rowsFor(table, whereClause) {
  if (table === revokedSessionsTable) return [];
  if (table === interviewerAccountsTable) {
    const id = whereClause?.queryChunks?.find((chunk) => chunk.constructor.name === "Param")?.value;
    return accounts.filter((account) => account.id === id);
  }
  if (table === interviewWhiteboardsTable) return [board];
  throw new Error("Unexpected database table in whiteboard collaboration test");
}

const db = {
  select() {
    const query = {
      table: undefined,
      whereClause: undefined,
      from(table) {
        this.table = table;
        return this;
      },
      where(clause) {
        this.whereClause = clause;
        return this;
      },
      limit() {
        return Promise.resolve(rowsFor(this.table, this.whereClause));
      },
      then(resolve, reject) {
        return Promise.resolve(rowsFor(this.table, this.whereClause)).then(resolve, reject);
      },
    };
    return query;
  },
};

function watchMessages(socket) {
  const messages = [];
  const waiters = [];

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    const index = waiters.findIndex(({ predicate }) => predicate(message));
    if (index < 0) {
      messages.push(message);
      return;
    }
    const [waiter] = waiters.splice(index, 1);
    clearTimeout(waiter.timeout);
    waiter.resolve(message);
  });
  socket.on("error", (error) => {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
  });

  return {
    waitFor(predicate, timeoutMs = 3_000) {
      const index = messages.findIndex(predicate);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          reject,
          timeout: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error("Timed out waiting for a whiteboard collaboration message"));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
  };
}

test("removes a disconnected collaborator cursor from the room presence update", async (t) => {
  mock.module("@workspace/db", {
    namedExports: {
      db,
      interviewerAccountsTable,
      interviewWhiteboardsTable,
      revokedSessionsTable,
    },
  });
  const [{ createInterviewerSession }, { setupWhiteboardCollaboration }] = await Promise.all([
    import("../middlewares/adminAuth.ts"),
    import("./whiteboardCollaboration.ts"),
  ]);

  const server = createServer();
  const sockets = [];
  setupWhiteboardCollaboration(server);
  t.after(async () => {
    for (const socket of sockets) socket.terminate();
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    mock.restoreAll();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const collaborationUrl = (session) => {
    const url = new URL(`ws://127.0.0.1:${address.port}/api/whiteboards/${board.id}/collab`);
    url.searchParams.set("access_token", session);
    return url;
  };

  const first = new WebSocket(collaborationUrl(createInterviewerSession("interviewer-one")));
  sockets.push(first);
  const firstMessages = watchMessages(first);
  await once(first, "open");
  const firstSnapshot = await firstMessages.waitFor((message) => message.type === "snapshot");
  assert.equal(firstSnapshot.participants, 1);

  const firstPresence = firstMessages.waitFor(
    (message) => message.type === "presence" && message.participants === 2,
  );
  const second = new WebSocket(collaborationUrl(createInterviewerSession("interviewer-two")));
  sockets.push(second);
  const secondMessages = watchMessages(second);
  await once(second, "open");
  const [secondSnapshot, twoParticipantPresence] = await Promise.all([
    secondMessages.waitFor((message) => message.type === "snapshot"),
    firstPresence,
  ]);
  assert.equal(secondSnapshot.participants, 2);
  assert.ok(twoParticipantPresence.collaborators.some(({ displayName }) => displayName === "Jordan"));

  const cursorDelivery = secondMessages.waitFor(
    (message) => message.type === "cursor" && message.displayName === "Alex",
  );
  first.send(JSON.stringify({
    type: "cursor",
    cursor: { x: 125, y: 240, visible: true, selectedElementIds: ["shape-1"] },
  }));
  const deliveredCursor = await cursorDelivery;
  assert.equal(deliveredCursor.x, 125);
  assert.equal(deliveredCursor.y, 240);

  const disconnectedPresence = secondMessages.waitFor(
    (message) => message.type === "presence" && message.participants === 1,
  );
  first.terminate();
  const updatedPresence = await disconnectedPresence;

  assert.equal(
    updatedPresence.collaborators.some(({ id }) => id === deliveredCursor.id),
    false,
    "the disconnected interviewer's labeled cursor must be absent",
  );
  assert.equal(
    updatedPresence.collaborators.some(({ displayName }) => displayName === "Alex"),
    false,
  );
});