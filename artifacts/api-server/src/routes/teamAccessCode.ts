import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, enterInstance, teamsTable } from "@workspace/db";
import {
  UpdateTeamAccessCodeBody,
  UpdateTeamAccessCodeResponse,
} from "@workspace/api-zod";
import { activeTeamDatabaseInstance } from "../lib/activeTeamDatabase";
import { isDatabaseConnectionError } from "../lib/databaseErrors";
import {
  hasTeamCode,
  hashTeamCode,
  matchesLegacyTeamCode,
  TEAM_CODE_UNIQUENESS_LOCK_KEY,
} from "../lib/teams";
import { requestTeamId, requireCoordinator } from "../middlewares/adminAuth";

const router: IRouter = Router();

router.put("/auth/teams/access-code", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = UpdateTeamAccessCodeBody.safeParse(req.body);
  const code = parsed.success && typeof parsed.data.code === "string"
    ? parsed.data.code.trim()
    : "";
  if (!parsed.success || code.length < 4 || code.length > 128) {
    res.status(400).json({ error: "Choose a team access code with 4–128 characters." });
    return;
  }

  const teamId = await requestTeamId(req);
  // Team records are authoritative on the active team database. Keep existing
  // signed-in sessions valid; only future code-based lookups use this hash.
  enterInstance(activeTeamDatabaseInstance());

  let outcome: "updated" | "conflict" | "missing";
  try {
    outcome = await db.transaction(async (tx) => {
      // Serialize rotations across API instances, including when a team has no
      // other lockable row that represents its proposed access code.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${TEAM_CODE_UNIQUENESS_LOCK_KEY}))`);
      const teams = await tx.select({
        id: teamsTable.id,
        codeHash: teamsTable.codeHash,
      }).from(teamsTable);
      if (!teams.some((team) => team.id === teamId)) return "missing";

      const otherTeams = teams.filter((team) => team.id !== teamId);
      if (hasTeamCode(code, otherTeams) || matchesLegacyTeamCode(code)) return "conflict";

      const [updated] = await tx.update(teamsTable)
        .set({ codeHash: hashTeamCode(code), updatedAt: new Date() })
        .where(eq(teamsTable.id, teamId))
        .returning({ id: teamsTable.id });
      return updated ? "updated" : "missing";
    });
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    res.status(503).json({ error: "The team database is temporarily unavailable. Try again shortly." });
    return;
  }

  if (outcome === "conflict") {
    res.status(409).json({ error: "That team access code is already in use. Choose a different code." });
    return;
  }
  if (outcome === "missing") {
    res.status(404).json({ error: "Your team could not be found." });
    return;
  }

  res.json(UpdateTeamAccessCodeResponse.parse({ message: "Team access code updated." }));
});

export default router;
