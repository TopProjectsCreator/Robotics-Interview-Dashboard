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

const integrationEnabled = process.env.RUN_PARTS_PERSISTENCE_DB_TEST === "1";

test(
  "saved costs, quotes, and robot preview removal persist without changing allocations",
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
    const interviewerId = `parts-cost-check-${suffix}`;
    const robotId = `parts-cost-check-robot-${suffix}`;
    const partId = `parts-cost-check-part-${suffix}`;
    const sourceUrl = `https://www.andymark.com/products/${partId}`;
    const server = app.listen(0, "127.0.0.1");

    try {
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}/api`;
      const session = createInterviewerSession(interviewerId);

      await pool.query(
        `insert into "interviewer_accounts"
           ("id", "display_name", "normalized_name", "password_hash")
         values ($1, $2, $3, $4)`,
        [interviewerId, "Parts persistence integration", interviewerId, "configured"],
      );
      await pool.query(
        `insert into "parts_robots" ("id", "name") values ($1, $2)`,
        [robotId, `Persistence check ${suffix}`],
      );
      await pool.query(
        `insert into "parts_catalog_items"
           ("id", "vendor_key", "external_key", "name", "sku", "product_url",
            "unit_cost", "cost_currency")
         values ($1, 'andymark', $2, $3, $4, $5, 1.25, 'USD')`,
        [partId, partId, `Persistence part ${suffix}`, `TEST-${suffix}`, sourceUrl],
      );
      await pool.query(
        `insert into "parts_inventory" ("part_id", "quantity_owned") values ($1, 2)`,
        [partId],
      );
      await pool.query(
        `insert into "parts_robot_allocations" ("id", "robot_id", "part_id", "quantity")
         values ($1, $2, $3, 1)`,
        [`parts-cost-check-allocation-${suffix}`, robotId, partId],
      );

      const request = async (path, { method = "GET", body, authenticated = true } = {}) => {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            ...(authenticated ? { authorization: `Bearer ${session}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const responseBody = await response.json();
        assert.ok(
          response.ok,
          `${method} ${path} returned ${response.status}: ${JSON.stringify(responseBody)}`,
        );
        return responseBody;
      };

      const unauthorized = await fetch(
        `${baseUrl}/parts/robots/${robotId}/details`,
      );
      assert.equal(unauthorized.status, 401, "robot details must require an interviewer session");

      const updatedCost = await request(`/parts/catalog/${partId}/cost`, {
        method: "PATCH",
        body: { unitCost: 4.25, costCurrency: "USD" },
      });
      assert.equal(updatedCost.unitCost, 4.25);
      assert.equal(updatedCost.costCurrency, "USD");

      const savedQuote = await request(`/parts/catalog/${partId}/price-snapshots`, {
        method: "POST",
        body: {
          unitPrice: 8.75,
          currency: "CAD",
          sourceUrl,
          isStartingAt: true,
        },
      });
      assert.equal(savedQuote.partId, partId);
      assert.equal(savedQuote.unitPrice, 8.75);
      assert.equal(savedQuote.currency, "CAD");
      assert.equal(savedQuote.sourceUrl, sourceUrl);
      assert.ok(Number.isFinite(Date.parse(savedQuote.capturedAt)));

      const savedDatabaseValues = await pool.query(
        `select "unit_cost" as "unitCost", "cost_currency" as "costCurrency"
         from "parts_catalog_items" where "id" = $1`,
        [partId],
      );
      assert.equal(Number(savedDatabaseValues.rows[0].unitCost), 4.25);
      assert.equal(savedDatabaseValues.rows[0].costCurrency, "USD");

      // This new authenticated request is the reload boundary: the handler must
      // rebuild both values from committed database rows, not mutation state.
      const details = await request(`/parts/robots/${robotId}/details`);
      const part = details.parts.find(({ partId: returnedPartId }) => returnedPartId === partId);
      assert.ok(part, "the allocated part should be present in the fresh robot details");
      assert.equal(part.quantity, 1);
      assert.equal(part.unitCost, 4.25);
      assert.equal(part.costCurrency, "USD");
      assert.equal(part.lineTotal, 4.25);
      assert.equal(part.priceSnapshots.length, 1);
      assert.equal(part.priceSnapshots[0].id, savedQuote.id);
      assert.equal(part.priceSnapshots[0].unitPrice, 8.75);
      assert.equal(part.priceSnapshots[0].currency, "CAD");
      assert.equal(part.priceSnapshots[0].sourceUrl, sourceUrl);
      assert.equal(part.priceSnapshots[0].capturedAt, savedQuote.capturedAt);

      const previewObjectPath = `/objects/${suffix.slice(0, 32)}`;
      await request(`/parts/robots/${robotId}/preview`, {
        method: "PATCH",
        body: {
          objectPath: previewObjectPath,
          fileName: "scout.png",
          contentType: "image/png",
        },
      });
      const removedRobot = await request(`/parts/robots/${robotId}/preview`, {
        method: "DELETE",
      });
      assert.equal(removedRobot.id, robotId);
      assert.equal(removedRobot.preview, null);

      // A fresh details request simulates a reload and proves that only the
      // preview metadata changed: the robot and its allocation remain.
      const reloadedDetails = await request(`/parts/robots/${robotId}/details`);
      assert.equal(reloadedDetails.robot.id, robotId);
      assert.equal(reloadedDetails.robot.preview, null);
      assert.equal(reloadedDetails.parts.length, 1);
      assert.equal(reloadedDetails.parts[0].partId, partId);
      assert.equal(reloadedDetails.parts[0].quantity, 1);
    } finally {
      if (server.listening) {
        await new Promise((resolve) => server.close(resolve));
      }
      await pool.query(`delete from "parts_robots" where "id" = $1`, [robotId]);
      await pool.query(`delete from "parts_catalog_items" where "id" = $1`, [partId]);
      await pool.query(`delete from "interviewer_accounts" where "id" = $1`, [interviewerId]);
      await pool.end();
    }
  },
);