---
name: Pool transaction client
description: BEGIN and COMMIT must run on one checked-out client; pool.query sends each statement to a different connection.
---

Any handler that needs a real transaction must call `pool.connect()`, run `BEGIN`, all statements, and `COMMIT`/`ROLLBACK` on that single client, and release it in a `finally`.

Calling `pool.query("BEGIN")` and then `pool.query("COMMIT")` around the statements does not work: a `Pool` hands out a different client per query, so `BEGIN` and `COMMIT` land on different connections. The statements between them autocommit one by one, and the `COMMIT` has nothing to commit.

**Why:** The team-deletion handler wrapped its deletes in `pool.query("BEGIN")` … `pool.query("COMMIT")`. It looked transactional and was not — a failure halfway through left the team's data partially deleted with no rollback, and the `COMMIT` was a no-op on an unrelated connection.

**How to apply:** Use `pool.connect()` and drive every statement of the transaction through the returned client. Wrap the inner work in its own `try`/`catch` so a failure issues `ROLLBACK` on that same client before it is released.
