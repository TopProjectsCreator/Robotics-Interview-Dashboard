import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import { pool } from "@workspace/db";

initRealtime();

// Self-healing schema: additive columns the code depends on are created at
// boot when missing, so a deploy never needs a separate migration step.
async function ensureSchema(): Promise<void> {
  const statements = [
    `alter table "applicants" add column if not exists "flagged" boolean not null default false`,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      logger.error({ err, sql }, "Schema migration failed");
      throw err;
    }
  }
  logger.info("Schema check passed");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  ensureSchema().catch((err) => {
    logger.error({ err }, "Schema migration failed; exiting");
    process.exit(1);
  });
});
