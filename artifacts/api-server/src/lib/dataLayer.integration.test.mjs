import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { createRequire, registerHooks } from "node:module";
import test, { mock } from "node:test";
import { eq, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { chatRevisionMigration } from "./chatRevisionMigration.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.(ts|js|mjs)$/.test(specifier)) {
        try { return nextResolve(`${specifier}.ts`, context); }
        catch { return nextResolve(`${specifier}/index.ts`, context); }
      }
      throw error;
    }
  },
});

// Route-local query builders are exercised verbatim against an isolated
// PostgreSQL cluster, without importing the server or any application secrets.
function routeFunction(file, name, bindings) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1);
  const end = source.indexOf("\n}\n", start) + 2;
  const require = createRequire(import.meta.url);
  const { transpileModule } = require("typescript");
  const code = transpileModule(`return (${source.slice(start, end)});`, {
    compilerOptions: { target: 99, module: 99 },
  }).outputText;
  return new Function(...Object.keys(bindings), code)(...Object.values(bindings));
}

test("data-layer queries preserve behavior with bounded reads", {
  skip: process.env.RUN_DATA_LAYER_DB_TEST !== "1",
}, async t => {
  const directory = mkdtempSync(join(tmpdir(), "robotics-data-layer-"));
  let pool;
  let started = false;
  t.after(async () => {
    await pool?.end();
    if (started) execFileSync("pg_ctl", ["-D", join(directory, "db"), "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(directory, { recursive: true, force: true });
  });
  execFileSync("initdb", ["-D", join(directory, "db"), "-A", "trust", "--no-locale", "-E", "UTF8"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", join(directory, "db"), "-l", join(directory, "postgres.log"),
    "-o", `-F -k ${directory} -h ''`, "-w", "start"], { stdio: "pipe" });
  started = true;
  const requireDb = createRequire(new URL("../../../../lib/db/package.json", import.meta.url));
  const { Pool } = requireDb("pg");
  pool = new Pool({ host: directory, user: userInfo().username, database: "postgres", port: 5432, max: 3 });
  const schema = await import("../../../../lib/db/src/schema/index.ts");
  const queries = [];
  const db = drizzle(pool, { logger: { logQuery(query) { queries.push(query); } } });
  mock.module("@workspace/db", { namedExports: {
    ...schema, db, pool, primaryDb: db, secondaryDb: () => db,
    DEFAULT_TEAM_ID: "default", normalizeTeamName: value => value,
  } });
  mock.module("./teams", { namedExports: {
    teamFilter: (field, teamId) => teamId === "default" ? or(eq(field, teamId), isNull(field)) : eq(field, teamId),
  } });
  process.env.DISABLE_DEMO_SEED = "true";
  const { getApplicants, getQueueState, getDashboardSummary } = await import("./roboticsData.ts");
  const { chatRevision } = await import("./chatRevisions.ts");
  const { assistantMessageCounts } = await import("./assistantMessageCounts.ts");
  const dialect = new PgDialect();
  const literal = value => `'${String(value).replaceAll("'", "''")}'`;
  async function createTable(table) {
    const config = getTableConfig(table);
    const columns = config.columns.map(column => {
      let result = `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`;
      if (column.default !== undefined) {
        const value = column.default;
        result += " default " + (
          value?.queryChunks ? dialect.sqlToQuery(value).sql :
          typeof value === "number" || typeof value === "boolean" ? String(value) :
          typeof value === "string" ? literal(value) : `${literal(JSON.stringify(value))}::jsonb`
        );
      }
      return result;
    });
    await pool.query(`create table "${config.name}" (${columns.join(", ")})`);
  }
  for (const table of [
    schema.applicantsTable, schema.interviewQueueTable, schema.interviewerAccountsTable,
    schema.teamAssessmentsTable, schema.teamAssessmentAssignmentsTable, schema.teamAssessmentSubmissionsTable,
    schema.assistantConversationsTable, schema.assistantMessagesTable,
    schema.interviewChatMessagesTable, schema.chatMessageReadsTable, schema.chatMessageReactionsTable,
    schema.chatPollsTable, schema.chatPollVotesTable, schema.chatChannelsTable, schema.chatChannelMembersTable,
  ]) await createTable(table);
  await pool.query(`create unique index assignments_unique on team_assessment_assignments (assessment_id, interviewer_id)`);
  for (const table of ["chat_message_reads", "chat_message_reactions", "chat_polls", "chat_poll_votes"]) {
    await pool.query(`alter table ${table} add foreign key (message_id) references interview_chat_messages (id) on delete cascade`);
  }
  const reconcile = routeFunction("../routes/teamAssessments.ts", "reconcileAssessmentAssignments", { db, sql });
  await t.test("assessment reconciliation is set-based, idempotent, tenant-safe, and covers late joiners", async () => {
    await pool.query(`insert into interviewer_accounts (id, team_id, display_name, normalized_name) values
      ('legacy', null, 'Legacy', 'legacy'), ('member', 'default', 'Member', 'member'),
      ('other-member', 'other', 'Other', 'other-member')`);
    await pool.query(`insert into team_assessments (id, team_id, title, kind, status, created_by) values
      ('a', 'default', 'A', 'quiz', 'published', 'member'),
      ('b', 'default', 'B', 'quiz', 'published', 'member'),
      ('draft', 'default', 'Draft', 'quiz', 'draft', 'member'),
      ('other', 'other', 'Other', 'quiz', 'published', 'other-member')`);
    const before = queries.length;
    await reconcile("default");
    assert.equal(queries.length - before, 1);
    assert.equal((await pool.query("select count(*)::int as n from team_assessment_assignments")).rows[0].n, 4);
    await reconcile("default");
    assert.equal((await pool.query("select count(*)::int as n from team_assessment_assignments")).rows[0].n, 4);
    await pool.query(`insert into interviewer_accounts (id, team_id, display_name, normalized_name) values ('late', 'default', 'Late', 'late')`);
    await pool.query(`insert into team_assessment_submissions (id, team_id, assessment_id, interviewer_id, answers)
      values ('done', 'default', 'a', 'late', '{}')`);
    await reconcile("default", { interviewerId: "late" });
    assert.deepEqual((await pool.query(`select assessment_id from team_assessment_assignments where interviewer_id = 'late'`)).rows, [{ assessment_id: "b" }]);
    await reconcile("default");
    assert.equal((await pool.query(`select count(*)::int as n from team_assessment_assignments where interviewer_id = 'late'`)).rows[0].n, 2);
    await Promise.all([reconcile("default"), reconcile("default")]);
    assert.equal((await pool.query("select count(*)::int as n from team_assessment_assignments")).rows[0].n, 6);
  });

  await t.test("assistant message counts are SQL aggregates restricted to the authorized conversation page", async () => {
    await db.insert(schema.assistantConversationsTable).values([
      { id: "visible", teamId: "default", ownerId: "member", title: "Visible" },
      { id: "hidden", teamId: "default", ownerId: "other-member", title: "Private" },
      { id: "other-team", teamId: "other", ownerId: "member", title: "Other team" },
    ]);
    await db.insert(schema.assistantMessagesTable).values([
      ...Array.from({ length: 5 }, (_, i) => ({ id: `visible-${i}`, teamId: "default", conversationId: "visible", question: "Q", answer: "A" })),
      { id: "legacy-visible", teamId: null, conversationId: "visible", question: "Q", answer: "A" },
      { id: "private", teamId: "default", conversationId: "hidden", question: "Q", answer: "A" },
      { id: "other", teamId: "other", conversationId: "other-team", question: "Q", answer: "A" },
      { id: "orphan", teamId: "default", conversationId: null, question: "Q", answer: "A" },
    ]);
    const before = queries.length;
    assert.deepEqual(await assistantMessageCounts("default", ["visible"]), new Map([["visible", 6]]));
    assert.deepEqual(await assistantMessageCounts("default", []), new Map());
    const aggregateQuery = queries.slice(before).find(query => query.includes("assistant_messages"));
    assert.match(aggregateQuery, /count\(\*\)::int/i);
    assert.match(aggregateQuery, /group by/i);
    assert.match(aggregateQuery, /conversation_id.*in/i);
    assert.doesNotMatch(aggregateQuery, /select "id".*from "assistant_messages"/i);
    assert.deepEqual(await assistantMessageCounts("default", ["hidden"]), new Map([["hidden", 1]]));
    assert.deepEqual(await assistantMessageCounts("other", ["visible"]), new Map());
  });

  await t.test("queue fetches only two slots per interviewer, preserves labels, and aggregates all statuses", async () => {
    await db.insert(schema.interviewQueueTable).values({ id: 1, teamId: "default", interviewerLabels: '["One","Two"]' });
    await db.insert(schema.applicantsTable).values(Array.from({ length: 40 }, (_, i) => ({
      id: `app-${i}`, teamId: i === 0 ? null : "default", name: `Applicant ${i}`, grade: i % 2 ? "Grade 6th" : "7th",
      aiScore: i === 0 ? -1 : i % 101, aiRecommendation: i % 2 ? "Yes" : "No",
      interviewStatus: i < 10 ? "completed" : "queued", queuePosition: i,
      interviewer: i === 10 ? "Two" : "", transcript: "large transcript", aiSummary: "large summary",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    })));
    await db.insert(schema.applicantsTable).values({ id: "other", teamId: "other", name: "Hidden" });
    const before = queries.length;
    const queue = await getQueueState("default");
    assert.equal(queue.completedCount, 10);
    assert.equal(queue.remainingCount, 30);
    assert.deepEqual(queue.currentApplicants.map(a => a.id), ["app-10", "app-11"]);
    assert.deepEqual(queue.nextApplicants.map(a => a.id), ["app-12", "app-13"]);
    assert.deepEqual(queue.currentApplicants.map(a => a.interviewer), ["Two", "One"]);
    const pageQuery = queries.slice(before).find(q => q.includes('"queue_position"') && q.includes("limit"));
    assert.ok(pageQuery);
    assert.doesNotMatch(pageQuery, /transcript|ai_summary|attachments|photo_url/);
    assert.equal((await pool.query(`select interviewer from applicants where id = 'app-10'`)).rows[0].interviewer, "Two");
    const again = await getQueueState("default");
    assert.deepEqual(again.currentApplicants.map(a => a.interviewer), ["Two", "One"]);
    const empty = await getQueueState("empty");
    assert.equal(empty.completedCount + empty.remainingCount, 0);
    assert.deepEqual(empty.currentApplicants, []);
  });

  await t.test("SQL dashboard summaries equal the former roster calculations, including empty teams", async () => {
    const rows = (await pool.query(`select * from applicants where team_id = 'default' or team_id is null`)).rows;
    const summary = await getDashboardSummary("default");
    assert.equal(summary.total, rows.length);
    assert.equal(summary.reviewed, rows.filter(a => a.interview_status !== "queued").length);
    assert.equal(summary.invalid, 1);
    const valid = rows.filter(a => a.ai_score >= 0);
    assert.equal(summary.averageScore, Math.round(valid.reduce((s, a) => s + a.ai_score, 0) / valid.length * 10) / 10);
    assert.deepEqual(summary.scoreBuckets.map(b => b.value), [20, 19, 0, 0, 0]);
    assert.deepEqual(summary.interviewProgress, { completed: 10, remaining: 30 });
    const group = (field, name) => {
      const expected = {};
      for (const row of rows) expected[row[field]] = (expected[row[field]] ?? 0) + 1;
      assert.deepEqual(Object.fromEntries(summary[name].map(g => [g.label, g.value])), expected);
    };
    group("grade", "grades");
    group("ai_recommendation", "recommendations");
    group("commit_10_hours", "commitments");
    const empty = await getDashboardSummary("empty");
    assert.equal(empty.total, 0);
    assert.equal(empty.averageScore, 0);
    assert.deepEqual(empty.grades, []);
    assert.deepEqual(empty.scoreBuckets.map(b => b.value), [0, 0, 0, 0, 0]);
  });

  await t.test("ordinary filters run in SQL without changing normalized grades or transcript search", async () => {
    const before = queries.length;
    const rows = await getApplicants({ grade: "6", recommendation: "Yes", interviewStatus: "queued" }, "default");
    assert.equal(rows.length, 15);
    assert.ok(rows.every(a => a.grade === "Grade 6th" && a.aiRecommendation === "Yes"));
    const query = queries.slice(before).find(q => q.includes('"applicants"'));
    assert.match(query, /regexp_replace/);
    assert.match(query, /"ai_recommendation" =/);
    assert.match(query, /"interview_status" =/);
    assert.doesNotMatch(query, /"transcript"/);
    const found = await getApplicants({ search: "large transcript" }, "default");
    assert.equal(found.length, 40);
  });

  await t.test("chat revisions survive repeated installs and cover every mutation, rollback, deletion, and reader", async () => {
    for (const statement of chatRevisionMigration) await pool.query(statement);
    for (const statement of chatRevisionMigration) await pool.query(statement);
    const initial = await chatRevision("default", undefined, pool);
    const otherInitial = await chatRevision("other", undefined, pool);
    await pool.query(`insert into interview_chat_messages (id, author, message) values ('msg', 'Author', 'Hello')`);
    let previous = await chatRevision("default", undefined, pool);
    assert.notEqual(previous, initial);
    assert.equal(await chatRevision("other", undefined, pool), otherInitial);
    const mutations = [
      `update interview_chat_messages set message = 'Edited', edited_at = now() where id = 'msg'`,
      `insert into chat_message_reactions (id, message_id, emoji, author) values ('reaction', 'msg', 'yes', 'Author')`,
      `delete from chat_message_reactions where id = 'reaction'`,
      `insert into chat_polls (message_id, question, options, created_by) values ('msg', 'Q?', '[]', 'Author')`,
      `insert into chat_poll_votes (id, message_id, option_index, voter) values ('vote', 'msg', 0, 'Author')`,
      `delete from chat_poll_votes where id = 'vote'`,
      `update interview_chat_messages set ghosted_at = now() where id = 'msg'`,
      `update interview_chat_messages set ghosted_at = null, deleted_at = now() where id = 'msg'`,
    ];
    for (const mutation of mutations) {
      await pool.query(mutation);
      const next = await chatRevision("default", undefined, pool);
      assert.notEqual(next, previous, mutation);
      previous = next;
    }
    const readerOne = await chatRevision("default", "one", pool);
    const readerTwo = await chatRevision("default", "two", pool);
    await pool.query(`insert into chat_message_reads (id, message_id, reader_id, reader_name) values ('read', 'msg', 'one', 'One')`);
    assert.notEqual(await chatRevision("default", undefined, pool), previous);
    assert.notEqual(await chatRevision("default", "one", pool), readerOne);
    assert.equal(await chatRevision("default", "two", pool), readerTwo);
    const client = await pool.connect();
    const committed = await chatRevision("default", undefined, pool);
    try {
      await client.query("begin");
      await client.query(`update interview_chat_messages set message = 'Not committed' where id = 'msg'`);
      assert.equal(await chatRevision("default", undefined, pool), committed, "other connections must not see an uncommitted revision");
      await client.query("rollback");
    } finally { client.release(); }
    assert.equal(await chatRevision("default", undefined, pool), committed);
    await pool.query(`delete from interview_chat_messages where id = 'msg'`);
    assert.notEqual(await chatRevision("default", undefined, pool), committed);
    assert.equal((await pool.query("select count(*)::int as n from chat_message_reads")).rows[0].n, 0);
    const constantTimeSql = readFileSync(new URL("./chatRevisions.ts", import.meta.url), "utf8");
    assert.doesNotMatch(constantTimeSql, /count\(\*\)|max\(|join interview_chat_messages/i);
  });

  await t.test("parts enrich only the selected page while retaining shared and legacy visibility", async () => {
    await pool.query(`create table parts_catalog_items (
      id text primary key, team_id text, vendor_key text, name text, sku text, category text, description text,
      product_url text, image_url text, supplier_price numeric, ftc_team_price numeric, supplier_price_currency text,
      stock_status text, created_at timestamptz default now(), updated_at timestamptz default now());
      create table parts_inventory (part_id text, team_id text, quantity_owned int, storage_location text,
        inventory_notes text, unit_cost numeric, cost_currency text);
      create table parts_robots (id text, team_id text, name text);
      create table parts_robot_allocations (part_id text, robot_id text, quantity int)`);
    await pool.query(`insert into parts_catalog_items (id, team_id, vendor_key, name, updated_at) values
      ('a', null, 'rev', 'Alpha', '2026-01-01'), ('b', null, 'rev', 'Beta', '2026-01-01'),
      ('c', 'default', 'rev', 'Charlie', '2026-01-01'), ('hidden', 'other', 'rev', 'Hidden', '2026-01-02');
      insert into parts_inventory (part_id, team_id, quantity_owned) values ('a', null, 8), ('c', 'default', 7), ('b', 'other', 99);
      insert into parts_robots values ('r1', null, 'Robot A'), ('r2', 'default', 'Robot B'), ('r3', 'other', 'Hidden');
      insert into parts_robot_allocations values ('a', 'r2', 2), ('a', 'r1', 1), ('a', 'r3', 99)`);
    const { teamSqlCondition } = await import("./teamSqlCondition.ts");
    let actualSql;
    const queryCatalogRows = routeFunction("../routes/parts.ts", "queryCatalogRows", {
      pool: { query: (query, params) => { actualSql = query; return pool.query(query, params); } },
      DEFAULT_TEAM_ID: "default", teamSqlCondition,
    });
    const filter = `where (c.team_id = $1 or c.team_id is null) and c.vendor_key <> $2`;
    const first = await queryCatalogRows(filter, ["default", "blocked"], 1, 0, "default");
    assert.equal(first[0].id, "a");
    assert.equal(first[0].quantityOwned, 8);
    assert.equal(first[0].quantityAssigned, 3);
    assert.deepEqual(first[0].allocations.map(a => a.robotName), ["Robot A", "Robot B"]);
    assert.match(actualSql, /catalog_page as materialized/);
    assert.ok(actualSql.indexOf("limit") < actualSql.indexOf('left join "parts_inventory"'));
    const second = await queryCatalogRows(filter, ["default", "blocked"], 1, 1, "default");
    assert.equal(second[0].id, "b");
    assert.equal(second[0].quantityAssigned, 0);
    assert.equal(second[0].quantityOwned, 0);
    assert.deepEqual(second[0].allocations, []);
    const inventoryOnly = await queryCatalogRows(`${filter} and exists (
      select 1 from parts_inventory i where i.part_id = c.id and (i.team_id = $1 or ($1 = 'default' and i.team_id is null)))`,
      ["default", "blocked"], 10, 0, "default");
    assert.deepEqual(inventoryOnly.map(a => a.id), ["a", "c"]);
    // Recreate the previous query from exactly the same projection/joins.
    const previousSql = actualSql.replace(/with catalog_page as materialized \([\s\S]*?\)\s*select/, "select")
      .replace('join catalog_page page on page."id" = c."id"', "")
      .replace(/group by c\."id"/, `${filter} and exists (
        select 1 from parts_inventory i where i.part_id = c.id and (i.team_id = $1 or ($1 = 'default' and i.team_id is null)))
        group by c."id"`) + " limit $4 offset $5";
    assert.deepEqual(inventoryOnly, (await pool.query(previousSql, ["default", "blocked", "default", 10, 0])).rows);
  });
});
