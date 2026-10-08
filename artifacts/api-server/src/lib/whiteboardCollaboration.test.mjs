import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import WebSocket from "ws";
import * as Y from "yjs";
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

const sharedBoard = {
  id: "whiteboard-collaboration-test",
  title: "Collaboration test",
  data: JSON.stringify({ elements: [] }),
  createdBy: "interviewer-one",
  conversationScope: "shared",
  conversationPeer: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const directBoard = {
  ...sharedBoard,
  id: "direct-whiteboard-collaboration-test",
  title: "Direct collaboration test",
  conversationScope: "direct",
  conversationPeer: "Alex\u001fJordan",
};

const accounts = [
  { id: "interviewer-one", displayName: "Alex", passwordHash: "configured" },
  { id: "interviewer-two", displayName: "Jordan", passwordHash: "configured" },
  { id: "interviewer-three", displayName: "Casey", passwordHash: "configured" },
];
const whiteboards = [sharedBoard, directBoard];
const updateHandlers = new Map();
const defaultUpdateHandler = async (table, id, values) => {
  if (table === interviewWhiteboardsTable) {
    const row = whiteboards.find((whiteboard) => whiteboard.id === id);
    if (row) Object.assign(row, values);
    return row ? [row] : [];
  }
  throw new Error("Unexpected database update in whiteboard collaboration test");
};

function whereValue(whereClause) {
  return whereClause?.queryChunks?.find((chunk) => chunk.constructor.name === "Param")?.value;
}

function rowsFor(table, whereClause) {
  if (table === revokedSessionsTable) return [];
  if (table === interviewerAccountsTable) {
    const id = whereValue(whereClause);
    return accounts.filter((account) => account.id === id);
  }
  if (table === interviewWhiteboardsTable) {
    const id = whereValue(whereClause);
    return whiteboards.filter((whiteboard) => whiteboard.id === id);
  }
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
      for() {
        return this;
      },
    };
    return query;
  },
  update(table) {
    let values;
    let whereClause;
    const execute = () => Promise.resolve().then(() => {
      const id = whereValue(whereClause);
      return (updateHandlers.get(id) ?? defaultUpdateHandler)(table, id, values);
    });
    return {
      set(nextValues) {
        values = nextValues;
        return this;
      },
      where(clause) {
        whereClause = clause;
        return this;
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
      catch(reject) {
        return execute().catch(reject);
      },
      finally(callback) {
        return execute().finally(callback);
      },
    };
  },
};

function mockDatabase() {
  mock.module("@workspace/db", {
    namedExports: {
      db,
      pool: {},
      interviewerAccountsTable,
      revokedSessionsTable,
      interviewWhiteboardsTable,
    },
  });
}

function watchMessages(socket) {  const messages = [];
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

function watchDocumentMessages(socket) {
  const messages = [];
  const waiters = [];
  const emit = (message) => {
    const index = waiters.findIndex(({ predicate }) => predicate(message));
    if (index < 0) {
      messages.push(message);
      return;
    }
    const [waiter] = waiters.splice(index, 1);
    clearTimeout(waiter.timeout);
    waiter.resolve(message);
  };

  socket.on("message", (raw, isBinary) => {
    if (isBinary) {
      const bytes = new Uint8Array(Buffer.from(raw));
      emit({ type: "binary", kind: bytes[0], update: bytes.subarray(1) });
      return;
    }
    emit(JSON.parse(raw.toString()));
  });
  socket.on("error", (error) => {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
  });

  return {
    has(predicate) {
      return messages.some(predicate);
    },
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
            reject(new Error("Timed out waiting for a document collaboration message"));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
  };
}

function newDocumentRow(id) {
  const doc = new Y.Doc();
  const row = {
    ...sharedBoard,
    id,
    title: "Document persistence test",
    data: JSON.stringify({
      kind: "document",
      elements: [],
      yState: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
    }),
  };
  doc.destroy();
  return row;
}

function textFromDocumentEnvelope(data) {
  const envelope = JSON.parse(data);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(Buffer.from(envelope.yState, "base64")));
  const text = doc.getText("body").toString();
  doc.destroy();
  return text;
}

async function waitForCondition(predicate, timeoutMs = 3_000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for a document database write");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function expectRejectedBeforeUpgrade(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const messages = [];
    socket.on("message", (raw) => messages.push(raw.toString()));
    socket.on("open", () => {
      socket.terminate();
      reject(new Error("Expected the whiteboard connection to be rejected before upgrade"));
    });
    socket.on("unexpected-response", (_request, response) => {
      response.resume();
      resolve({ statusCode: response.statusCode, messages });
    });
    socket.on("error", reject);
  });
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
  const collaborationUrl = (whiteboard, session) => {
    const url = new URL(`ws://127.0.0.1:${address.port}/api/whiteboards/${whiteboard.id}/collab`);
    url.searchParams.set("access_token", session);
    return url;
  };

  const first = new WebSocket(collaborationUrl(sharedBoard, createInterviewerSession("interviewer-one")));
  sockets.push(first);
  const firstMessages = watchMessages(first);
  await once(first, "open");
  const firstSnapshot = await firstMessages.waitFor((message) => message.type === "snapshot");
  assert.equal(firstSnapshot.participants, 1);

  const firstPresence = firstMessages.waitFor(
    (message) => message.type === "presence" && message.participants === 2,
  );
  const second = new WebSocket(collaborationUrl(sharedBoard, createInterviewerSession("interviewer-two")));
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

  const directFirst = new WebSocket(collaborationUrl(directBoard, createInterviewerSession("interviewer-one")));
  sockets.push(directFirst);
  const directFirstMessages = watchMessages(directFirst);
  await once(directFirst, "open");
  const directFirstSnapshot = await directFirstMessages.waitFor((message) => message.type === "snapshot");
  assert.equal(directFirstSnapshot.participants, 1);

  const directPresence = directFirstMessages.waitFor(
    (message) => message.type === "presence" && message.participants === 2,
  );
  const directSecond = new WebSocket(collaborationUrl(directBoard, createInterviewerSession("interviewer-two")));
  sockets.push(directSecond);
  const directSecondMessages = watchMessages(directSecond);
  await once(directSecond, "open");
  const [directSecondSnapshot, twoDirectParticipants] = await Promise.all([
    directSecondMessages.waitFor((message) => message.type === "snapshot"),
    directPresence,
  ]);
  assert.equal(directSecondSnapshot.participants, 2);
  assert.ok(twoDirectParticipants.collaborators.some(({ displayName }) => displayName === "Jordan"));

  const directCursorDelivery = directFirstMessages.waitFor(
    (message) => message.type === "cursor" && message.displayName === "Jordan",
  );
  directSecond.send(JSON.stringify({
    type: "cursor",
    cursor: { x: 48, y: 96, visible: true, selectedElementIds: ["private-shape"] },
  }));
  const deliveredDirectCursor = await directCursorDelivery;
  assert.equal(deliveredDirectCursor.x, 48);
  assert.equal(deliveredDirectCursor.y, 96);
  assert.deepEqual(deliveredDirectCursor.selectedElementIds, ["private-shape"]);

  const rejectedOutsider = await expectRejectedBeforeUpgrade(
    collaborationUrl(directBoard, createInterviewerSession("interviewer-three")),
  );
  assert.equal(rejectedOutsider.statusCode, 403);
  assert.deepEqual(rejectedOutsider.messages, [], "a direct-room outsider must receive no presence data");
});

test("acknowledges a Yjs edit only after persistence and reloads it from saved state", { concurrency: false }, async (t) => {
  const document = newDocumentRow("document-persistence-success-test");
  whiteboards.push(document);
  let writeStartedResolve;
  let secondWriteStartedResolve;
  let releaseWrite;
  let releaseSecondWrite;
  let writeCount = 0;
  const writeStarted = new Promise((resolve) => { writeStartedResolve = resolve; });
  const secondWriteStarted = new Promise((resolve) => { secondWriteStartedResolve = resolve; });
  updateHandlers.set(document.id, async (table, id, values) => {
    assert.equal(table, interviewWhiteboardsTable);
    assert.equal(id, document.id);
    writeCount += 1;
    if (writeCount <= 2) {
      await new Promise((resolve) => {
        const release = () => {
          Object.assign(document, values);
          resolve();
        };
        if (writeCount === 1) {
          releaseWrite = release;
          writeStartedResolve();
        } else {
          releaseSecondWrite = release;
          secondWriteStartedResolve();
        }
      });
      return [document];
    }
    Object.assign(document, values);
    return [document];
  });

  mockDatabase();
  const [{ createInterviewerSession }, { setupDocumentCollaboration }] = await Promise.all([
    import("../middlewares/adminAuth.ts"),
    import("./documentCollaboration.ts"),
  ]);
  const server = createServer();
  const sockets = [];
  setupDocumentCollaboration(server);
  t.after(async () => {
    updateHandlers.delete(document.id);
    for (const socket of sockets) socket.terminate();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    const index = whiteboards.indexOf(document);
    if (index >= 0) whiteboards.splice(index, 1);
    mock.restoreAll();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = new URL(
    `ws://127.0.0.1:${address.port}/api/whiteboards/${document.id}/document-collab`,
  );
  url.searchParams.set("access_token", createInterviewerSession("interviewer-one"));
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages = watchDocumentMessages(socket);
  await once(socket, "open");
  await messages.waitFor((message) => message.type === "meta");
  const initial = await messages.waitFor((message) => message.type === "binary" && message.kind === 1);

  const edit = new Y.Doc();
  Y.applyUpdate(edit, initial.update);
  edit.getText("body").insert(0, "This document edit survived reload.");
  socket.send(Buffer.concat([Buffer.from([1]), Buffer.from(Y.encodeStateAsUpdate(edit))]));

  await writeStarted;
  edit.getText("body").insert(edit.getText("body").length, " A newer edit must persist too.");
  socket.send(Buffer.concat([Buffer.from([1]), Buffer.from(Y.encodeStateAsUpdate(edit))]));
  edit.destroy();
  await new Promise((resolve) => setTimeout(resolve, 220));
  assert.equal(writeCount, 1, "later document writes must wait for the earlier write to finish");
  assert.equal(
    messages.has((message) => message.type === "saved"),
    false,
    "the server must not acknowledge either edit while the database write is pending",
  );

  assert.equal(typeof releaseWrite, "function");
  releaseWrite();
  await secondWriteStarted;
  assert.equal(
    messages.has((message) => message.type === "saved"),
    false,
    "saving an older document revision must not acknowledge a newer unsaved edit",
  );
  assert.equal(typeof releaseSecondWrite, "function");
  releaseSecondWrite();
  await messages.waitFor((message) => message.type === "saved");
  assert.equal(
    textFromDocumentEnvelope(document.data),
    "This document edit survived reload. A newer edit must persist too.",
  );

  socket.close();
  await once(socket, "close");
  await waitForCondition(() => writeCount >= 2);

  const reloaded = new WebSocket(url);
  sockets.push(reloaded);
  const reloadMessages = watchDocumentMessages(reloaded);
  await once(reloaded, "open");
  await reloadMessages.waitFor((message) => message.type === "meta");
  const savedSnapshot = await reloadMessages.waitFor(
    (message) => message.type === "binary" && message.kind === 1,
  );
  const freshDoc = new Y.Doc();
  Y.applyUpdate(freshDoc, savedSnapshot.update);
  assert.equal(
    freshDoc.getText("body").toString(),
    "This document edit survived reload. A newer edit must persist too.",
  );
  freshDoc.destroy();
  reloaded.close();
  await once(reloaded, "close");
  await waitForCondition(() => writeCount >= 3);
});

test("reports document persistence failures without sending a saved acknowledgement", { concurrency: false }, async (t) => {
  const document = newDocumentRow("document-persistence-failure-test");
  whiteboards.push(document);
  const originalData = document.data;
  let writeCount = 0;
  updateHandlers.set(document.id, async () => {
    writeCount += 1;
    throw new Error("test database write failure");
  });

  mockDatabase();
  const [{ createInterviewerSession }, { setupDocumentCollaboration }] = await Promise.all([
    import("../middlewares/adminAuth.ts"),
    import("./documentCollaboration.ts"),
  ]);
  const server = createServer();
  const sockets = [];
  setupDocumentCollaboration(server);
  t.after(async () => {
    updateHandlers.delete(document.id);
    for (const socket of sockets) socket.terminate();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    const index = whiteboards.indexOf(document);
    if (index >= 0) whiteboards.splice(index, 1);
    mock.restoreAll();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = new URL(
    `ws://127.0.0.1:${address.port}/api/whiteboards/${document.id}/document-collab`,
  );
  url.searchParams.set("access_token", createInterviewerSession("interviewer-one"));
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages = watchDocumentMessages(socket);
  await once(socket, "open");
  await messages.waitFor((message) => message.type === "meta");
  const initial = await messages.waitFor((message) => message.type === "binary" && message.kind === 1);

  const edit = new Y.Doc();
  Y.applyUpdate(edit, initial.update);
  edit.getText("body").insert(0, "This edit must not be marked saved.");
  socket.send(Buffer.concat([Buffer.from([1]), Buffer.from(Y.encodeStateAsUpdate(edit))]));
  edit.destroy();

  const failure = await messages.waitFor((message) => message.type === "error");
  assert.match(failure.message, /could not be saved/i);
  assert.equal(messages.has((message) => message.type === "saved"), false);
  assert.equal(document.data, originalData, "failed writes must leave the stored document unchanged");
  socket.close();
  await once(socket, "close");
  await waitForCondition(() => writeCount >= 2);
});