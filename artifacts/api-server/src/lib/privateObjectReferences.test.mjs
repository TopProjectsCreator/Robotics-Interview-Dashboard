import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const objectPath = "/objects/preview-12345678";
let importId = 0;

async function checkReferences(t, { robotReferences = [], modelReferences = [], messages = [] } = {}) {
  mock.module("@workspace/db", {
    namedExports: {
      pool: {
        query: async (statement) => {
          if (statement.includes('"parts_robots"')) {
            return { rows: robotReferences, rowCount: robotReferences.length };
          }
          if (statement.includes('"cad_models"')) {
            return { rows: modelReferences, rowCount: modelReferences.length };
          }
          if (statement.includes('"interview_chat_messages"')) {
            return { rows: messages.map((message) => ({ message })), rowCount: messages.length };
          }
          throw new Error(`Unexpected reference query: ${statement}`);
        },
      },
    },
  });
  t.after(() => mock.restoreAll());
  const suffix = ++importId;
  const { isPrivateObjectReferenced } = await import(
    `./privateObjectReferences.ts?test=${suffix}`,
  );
  return isPrivateObjectReferenced(objectPath);
}

test("private object cleanup keeps files referenced by another robot", async (t) => {
  assert.equal(
    await checkReferences(t, { robotReferences: [{ id: "other-robot" }] }),
    true,
  );
});

test("private object cleanup keeps files referenced by a CAD model", async (t) => {
  assert.equal(
    await checkReferences(t, { modelReferences: [{ id: "other-model" }] }),
    true,
  );
});

test("a CAD model still referenced after its own record is removed is kept", async (t) => {
  // A robot preview replaced by a CAD model, or a chat attachment promoted into
  // the library, can share one object path. Both tables must be consulted.
  assert.equal(
    await checkReferences(t, {
      modelReferences: [{ id: "other-model" }],
      robotReferences: [{ id: "other-robot" }],
      messages: [`See /api/storage${objectPath}`],
    }),
    true,
  );
});

test("private object cleanup keeps files referenced by a chat message", async (t) => {
  assert.equal(
    await checkReferences(t, {
      messages: [`See /api/storage${objectPath}`],
    }),
    true,
  );
});

test("private object cleanup allows deletion after all references are cleared", async (t) => {
  assert.equal(await checkReferences(t), false);
});