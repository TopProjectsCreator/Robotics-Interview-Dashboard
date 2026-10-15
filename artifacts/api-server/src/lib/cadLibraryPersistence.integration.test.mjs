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

const integrationEnabled =
  process.env.RUN_CAD_PERSISTENCE_DB_TEST === "1" && process.env.DATABASE_URL;

/**
 * Exercises the CAD library against a real database. The behaviour most worth
 * proving here is what a mocked `pool` cannot: that a folder really nests
 * arbitrarily deep, that the sibling-name index rejects a duplicate the same way
 * a missing translation would, and that the self-referencing foreign keys
 * cascade when a bot is removed.
 */
test(
  "CAD bots, nested folders, and models persist and reorganise across reloads",
  { skip: !integrationEnabled },
  async () => {
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
    const interviewerId = `cad-check-${suffix}`;
    const session = createInterviewerSession(interviewerId);
    const server = app.listen(0, "127.0.0.1");

    try {
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}/api`;

      // This test account must be able to see the CAD workspace, which is
      // coordinator-only by default.
      await pool.query(
        `insert into "interviewer_accounts"
           ("id", "display_name", "normalized_name", "password_hash", "role")
         values ($1, $2, $3, 'configured', 'coordinator')`,
        [interviewerId, "CAD persistence integration", interviewerId],
      );

      const request = async (path, { method = "GET", body } = {}) => {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            authorization: `Bearer ${session}`,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        const parsed = text ? JSON.parse(text) : null;
        return { status: response.status, body: parsed };
      };

      const unauthorized = await fetch(`${baseUrl}/cad/library`);
      assert.equal(unauthorized.status, 401, "the CAD library must require a session");

      const botName = `CAD check ${suffix}`;
      const createdBot = await request("/cad/bots", {
        method: "POST",
        body: { name: botName },
      });
      assert.equal(createdBot.status, 201);
      const botId = createdBot.body.id;

      // A second bot with the same name must be refused by the unique index.
      const duplicateBot = await request("/cad/bots", {
        method: "POST",
        body: { name: botName.toLowerCase() },
      });
      assert.equal(duplicateBot.status, 409, "bot names must be unique case-insensitively");

      // Three levels of nesting, which is the shape the tree UI has to render.
      const intake = await request("/cad/folders", {
        method: "POST",
        body: { botId, name: "Intake" },
      });
      assert.equal(intake.status, 201);
      assert.equal(intake.body.parentId, null, "a top-level folder has no parent");

      const chassis = await request("/cad/folders", {
        method: "POST",
        body: { botId, parentId: intake.body.id, name: "Chassis" },
      });
      assert.equal(chassis.status, 201);
      assert.equal(chassis.body.parentId, intake.body.id);

      const wheels = await request("/cad/folders", {
        method: "POST",
        body: { botId, parentId: chassis.body.id, name: "Wheels" },
      });
      assert.equal(wheels.status, 201);

      // The same name is fine in a different parent and not fine beside itself.
      const siblingSameName = await request("/cad/folders", {
        method: "POST",
        body: { botId, parentId: chassis.body.id, name: "Wheels" },
      });
      assert.equal(siblingSameName.status, 409, "sibling folders must have unique names");

      const otherBranch = await request("/cad/folders", {
        method: "POST",
        body: { botId, parentId: intake.body.id, name: "Wheels" },
      });
      assert.equal(otherBranch.status, 201, "the same name under a different parent is fine");

      // A folder may not be moved inside its own descendant.
      const cycle = await request(`/cad/folders/${intake.body.id}`, {
        method: "PATCH",
        body: { parentId: wheels.body.id },
      });
      assert.equal(cycle.status, 400);
      assert.match(cycle.body.error, /own subfolders/);

      // A subfolder cannot be created under another bot's folder.
      const otherBot = await request("/cad/bots", {
        method: "POST",
        body: { name: `CAD other ${suffix}` },
      });
      const crossBot = await request("/cad/folders", {
        method: "POST",
        body: { botId: otherBot.body.id, parentId: intake.body.id, name: "Nested" },
      });
      assert.equal(crossBot.status, 400);
      assert.match(crossBot.body.error, /different bot/);

      const objectPath = `/objects/${suffix.slice(0, 32)}`;
      const model = await request("/cad/models", {
        method: "POST",
        body: {
          name: "Wheel hub",
          fileName: "wheel-hub.3mf",
          contentType: "model/3mf",
          objectPath,
          sizeBytes: 4096,
          botId,
          folderId: wheels.body.id,
        },
      });
      assert.equal(model.status, 201);
      assert.equal(model.body.botId, botId);
      assert.equal(model.body.folderId, wheels.body.id);

      // A mismatched bot/folder pair is refused rather than silently reassigning.
      const mismatched = await request(`/cad/models/${model.body.id}`, {
        method: "PATCH",
        body: { botId: otherBot.body.id, folderId: wheels.body.id },
      });
      assert.equal(mismatched.status, 400);

      // Dragging the model to Unfiled clears both pointers.
      const unfiled = await request(`/cad/models/${model.body.id}`, {
        method: "PATCH",
        body: { botId: null, folderId: null },
      });
      assert.equal(unfiled.status, 200);
      assert.equal(unfiled.body.botId, null);
      assert.equal(unfiled.body.folderId, null);

      // Fresh reads prove the tree was rebuilt from committed rows.
      const library = await request("/cad/library");
      assert.equal(library.status, 200);
      const returnedBot = library.body.bots.find(({ id }) => id === botId);
      assert.ok(returnedBot, "the bot should survive a reload");
      assert.equal(returnedBot.name, botName);

      const returnedFolders = library.body.folders.filter(({ botId: id }) => id === botId);
      assert.equal(returnedFolders.length, 4, "Intake, Chassis, Wheels and the second Wheels");
      const returnedChassis = returnedFolders.find(({ id }) => id === chassis.body.id);
      assert.equal(returnedChassis.parentId, intake.body.id, "nesting must persist");
      const returnedWheels = returnedFolders.find(({ id }) => id === wheels.body.id);
      assert.equal(returnedWheels.parentId, chassis.body.id, "deep nesting must persist");

      const returnedModel = library.body.models.find(({ id }) => id === model.body.id);
      assert.equal(returnedModel.botId, null);
      assert.equal(returnedModel.folderId, null);
      assert.equal(returnedModel.fileName, "wheel-hub.3mf");

      // Deleting a folder unfiles its models rather than destroying them.
      const deletedFolder = await request(`/cad/folders/${wheels.body.id}`, {
        method: "DELETE",
      });
      assert.equal(deletedFolder.status, 204);
      const modelsAfter = await request("/cad/models");
      assert.ok(
        modelsAfter.body.items.some(({ id }) => id === model.body.id),
        "a model must survive its folder being deleted",
      );

      // Deleting the bot cascades its folders away entirely.
      const deletedBot = await request(`/cad/bots?botId=${botId}`, { method: "DELETE" });
      assert.equal(deletedBot.status, 204);
      const remainingFolders = await pool.query(
        `select "id" from "cad_folders" where "bot_id" = $1`,
        [botId],
      );
      assert.equal(remainingFolders.rowCount, 0, "folders must cascade with their bot");
    } finally {
      if (server.listening) {
        await new Promise((resolve) => server.close(resolve));
      }
      await pool.query(`delete from "cad_bots" where "id" like $1`, [`CAD check ${suffix}`]);
      await pool.query(`delete from "cad_bots" where "id" like $1`, [`CAD other ${suffix}`]);
      await pool.query(
        `delete from "cad_folders" where "bot_id" in (
           select "id" from "cad_bots" where "name" like $1 or "name" like $2
         )`,
        [`CAD check ${suffix}`, `CAD other ${suffix}`],
      );
      await pool.query(
        `delete from "cad_models" where "file_name" = $1`,
        ["wheel-hub.3mf"],
      );
      await pool.query(`delete from "interviewer_accounts" where "id" = $1`, [interviewerId]);
      await pool.end();
    }
  },
);