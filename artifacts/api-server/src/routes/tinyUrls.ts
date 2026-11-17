import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, tinyUrlsTable } from "@workspace/db";
import {
  CreateTinyUrlBody,
  CreateTinyUrlResponse,
  DeleteTinyUrlParams,
  ListTinyUrlsResponse,
} from "@workspace/api-zod";
import {
  authenticatedInterviewerId,
  requireCoordinator,
  requestTeamId,
} from "../middlewares/adminAuth";
import { accountNamesById } from "./presence";
import { teamFilter } from "../lib/teams";
import {
  isValidTinyUrlAlias,
  normalizeTinyUrlAlias,
  normalizeTinyUrlTarget,
  tinyUrlPath,
  TINY_URL_TEAM_LIMIT,
} from "../lib/tinyUrls";

const router: IRouter = Router();

type TinyUrlRow = typeof tinyUrlsTable.$inferSelect;

function tinyUrlResponse(row: TinyUrlRow, createdByName: string | null = null) {
  return {
    id: row.id,
    alias: row.alias,
    path: tinyUrlPath(row.alias),
    targetUrl: row.targetUrl,
    clickCount: row.clickCount,
    createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  // node-postgres puts the SQLSTATE on the error; drizzle wraps it as the
  // cause of a DrizzleQueryError — unwrap either shape (and nesting).
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const invalidAliasMessage = "Aliases use letters, numbers, hyphens, and underscores; they start with a letter or number and run 1–64 characters. Try adding it again.";
const invalidTargetMessage = "Enter a full web address like https://team.example.com/signup. Only http and https links are supported.";

router.get("/tiny-urls", requireCoordinator, async (req, res): Promise<void> => {
  try {
    const teamId = await requestTeamId(req);
    const rows = await db
      .select()
      .from(tinyUrlsTable)
      .where(teamFilter(tinyUrlsTable.teamId, teamId))
      .orderBy(desc(tinyUrlsTable.createdAt))
      .limit(TINY_URL_TEAM_LIMIT);
    const creatorIds = [...new Set(rows.map((row) => row.createdBy).filter((id): id is string => Boolean(id)))];
    const names = await accountNamesById(creatorIds, teamId);
    res.json(ListTinyUrlsResponse.parse({
      items: rows.map((row) => tinyUrlResponse(row, row.createdBy ? names.get(row.createdBy) ?? null : null)),
    }));
  } catch (error) {
    req.log.error({ err: error }, "TinyURL list failed");
    res.status(503).json({ error: "TinyURLs are temporarily unavailable." });
  }
});

router.post("/tiny-urls", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = CreateTinyUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const alias = normalizeTinyUrlAlias(parsed.data.alias);
  if (!alias) {
    res.status(400).json({ error: invalidAliasMessage });
    return;
  }
  const targetUrl = normalizeTinyUrlTarget(parsed.data.targetUrl);
  if (!targetUrl) {
    res.status(400).json({ error: invalidTargetMessage });
    return;
  }
  try {
    const teamId = await requestTeamId(req);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tinyUrlsTable)
      .where(teamFilter(tinyUrlsTable.teamId, teamId));
    if (count >= TINY_URL_TEAM_LIMIT) {
      res.status(409).json({ error: `This team already has ${TINY_URL_TEAM_LIMIT} tinyurls. Delete one before creating another.` });
      return;
    }
    const createdBy = authenticatedInterviewerId(req) ?? null;
    const [created] = await db
      .insert(tinyUrlsTable)
      .values({ id: randomUUID(), teamId, alias, targetUrl, createdBy })
      .returning();
    const names = createdBy ? await accountNamesById([createdBy], teamId) : new Map<string, string>();
    res.status(201).json(CreateTinyUrlResponse.parse(tinyUrlResponse(created, createdBy ? names.get(createdBy) ?? null : null)));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: `/t/${alias} is already taken. Choose another alias.` });
      return;
    }
    req.log.error({ err: error }, "TinyURL create failed");
    res.status(503).json({ error: "TinyURLs are temporarily unavailable." });
  }
});

router.delete("/tiny-urls/:tinyUrlId", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = DeleteTinyUrlParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "A tinyurl id is required." });
    return;
  }
  try {
    const teamId = await requestTeamId(req);
    const deleted = await db
      .delete(tinyUrlsTable)
      .where(and(eq(tinyUrlsTable.id, parsed.data.tinyUrlId), teamFilter(tinyUrlsTable.teamId, teamId)))
      .returning({ id: tinyUrlsTable.id });
    if (!deleted.length) {
      res.status(404).json({ error: "That tinyurl does not exist for this team." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "TinyURL delete failed");
    res.status(503).json({ error: "TinyURLs are temporarily unavailable." });
  }
});

/** Minimal HTML shell for the public short-link surface (no app assets needed). */
function shortLinkShell(title: string, detail: string): string {
  const escape = (value: string) => value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escape(title)}</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #0d1b28; color: #e8eef2; font-family: "Space Grotesk", system-ui, sans-serif; }
  main { text-align: center; padding: 2rem; }
  p.kicker { font-family: "DM Mono", ui-monospace, monospace; font-size: 0.7rem; letter-spacing: 0.22em; text-transform: uppercase; color: #f8c84a; margin: 0 0 0.75rem; }
  h1 { font-size: 1.6rem; font-weight: 600; margin: 0 0 0.5rem; }
  p.detail { color: #9db6bd; margin: 0 0 1.5rem; max-width: 34rem; }
  a { color: #6fc3cf; text-decoration: none; border: 1px solid #31495a; border-radius: 0.6rem; padding: 0.6rem 1.2rem; display: inline-block; }
  a:hover { border-color: #3f8492; }
</style>
</head>
<body>
<main>
  <p class="kicker">Short link</p>
  <h1>${escape(title)}</h1>
  <p class="detail">${escape(detail)}</p>
  <a href="/">Go to the home page</a>
</main>
</body>
</html>`;
}

/**
 * Public redirect for `GET /t/<alias>`. Registered before the SPA fallback in
 * app.ts. Increments the click counter for real navigations (HEAD requests —
 * link previews and health checks — never count) and never leaks which team
 * owns a link.
 */
export async function tinyUrlRedirectHandler(req: Request, res: Response): Promise<void> {
  const rawAlias = typeof req.params.alias === "string" ? req.params.alias : "";
  // Aliases are stored lowercase, so lowercase-and-trim before lookup; the
  // pattern check rejects anything else.
  const alias = rawAlias.toLowerCase().trim().replace(/^\/+|\/+$/g, "");
  if (!isValidTinyUrlAlias(alias)) {
    res.status(404).type("html").send(shortLinkShell(
      "That short link isn't available",
      "The link address is invalid. Check the spelling, or ask the team for a fresh link.",
    ));
    return;
  }
  try {
    const rows = await db
      .select({ id: tinyUrlsTable.id, targetUrl: tinyUrlsTable.targetUrl })
      .from(tinyUrlsTable)
      .where(eq(tinyUrlsTable.alias, alias))
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).type("html").send(shortLinkShell(
        "That short link isn't available",
        "It may have been deleted or the alias may be wrong. Ask the team for a fresh link.",
      ));
      return;
    }
    if (req.method === "GET") {
      void db
        .update(tinyUrlsTable)
        .set({ clickCount: sql`${tinyUrlsTable.clickCount} + 1` })
        .where(eq(tinyUrlsTable.id, row.id))
        .catch((error: unknown) => req.log.warn({ err: error }, "TinyURL click count failed"));
    }
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, row.targetUrl);
  } catch (error) {
    req.log.error({ err: error }, "TinyURL redirect failed");
    res.status(503).type("html").send(shortLinkShell(
      "That short link is unavailable right now",
      "The server could not look the link up. Try again in a moment.",
    ));
  }
}

export default router;
