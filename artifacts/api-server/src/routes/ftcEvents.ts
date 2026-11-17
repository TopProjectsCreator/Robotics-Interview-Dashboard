import { Router, type IRouter } from "express";
import {
  GetFtcGlobeDataQueryParams,
  GetFtcGlobeDataResponse,
  GetFtcEventProfileParams,
  GetFtcEventProfileQueryParams,
  GetFtcEventProfileResponse,
  GetFtcTeamProfileParams,
  GetFtcTeamProfileQueryParams,
  GetFtcTeamProfileResponse,
  SearchFtcMentionsQueryParams,
  SearchFtcMentionsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/adminAuth";
import { getFtcEventProfile, getFtcGlobeData, getFtcTeamProfile, searchFtcEntities } from "../lib/ftcEvents";

const router: IRouter = Router();

function requestedSeason(value: unknown): number | null {
  const season = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d{4}$/.test(value)
      ? Number(value)
      : NaN;
  return Number.isInteger(season) && season >= 2022 && season <= 2100
    ? season
    : null;
}

router.get("/public/ftc-globe", async (req, res): Promise<void> => {
  const query = GetFtcGlobeDataQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const season = requestedSeason(query.data.season) ?? new Date().getUTCFullYear();
  try {
    const data = await getFtcGlobeData(season);
    res.set("Cache-Control", "public, max-age=900, stale-while-revalidate=86400");
    res.json(GetFtcGlobeDataResponse.parse(data));
  } catch (error) {
    req.log.warn({ err: error, season }, "Public FTC globe data could not be loaded");
    res.status(502).json({ error: "FTC team and event locations could not be loaded right now." });
  }
});

router.get("/queue/chat/ftc/search", requireAdmin, async (req, res): Promise<void> => {
  const query = SearchFtcMentionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const season = requestedSeason(query.data.season) ?? new Date().getUTCFullYear();
  try {
    res.json(SearchFtcMentionsResponse.parse(await searchFtcEntities(season, query.data.query)));
  } catch (error) {
    req.log.warn({ err: error, season }, "FTC mention search failed");
    res.status(502).json({ error: "FTC team and event data could not be loaded right now." });
  }
});

router.get("/queue/chat/ftc/teams/:teamNumber", requireAdmin, async (req, res): Promise<void> => {
  const path = GetFtcTeamProfileParams.safeParse(req.params);
  const query = GetFtcTeamProfileQueryParams.safeParse(req.query);
  if (!path.success) {
    res.status(400).json({ error: path.error.message });
    return;
  }
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const season = requestedSeason(query.data.season) ?? new Date().getUTCFullYear();
  try {
    const profile = await getFtcTeamProfile(season, path.data.teamNumber);
    if (!profile.team) {
      res.status(404).json({ error: "That FTC team was not found for this season." });
      return;
    }
    res.json(GetFtcTeamProfileResponse.parse({ season, ...profile }));
  } catch (error) {
    req.log.warn({ err: error, season, teamNumber: path.data.teamNumber }, "FTC team profile request failed");
    res.status(502).json({ error: "FTC team details could not be loaded right now." });
  }
});

router.get("/queue/chat/ftc/events/:eventCode", requireAdmin, async (req, res): Promise<void> => {
  const path = GetFtcEventProfileParams.safeParse(req.params);
  const query = GetFtcEventProfileQueryParams.safeParse(req.query);
  if (!path.success) {
    res.status(400).json({ error: path.error.message });
    return;
  }
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const season = requestedSeason(query.data.season) ?? new Date().getUTCFullYear();
  try {
    const profile = await getFtcEventProfile(season, path.data.eventCode);
    if (!profile.event) {
      res.status(404).json({ error: "That FTC event was not found for this season." });
      return;
    }
    res.json(GetFtcEventProfileResponse.parse({ season, ...profile }));
  } catch (error) {
    req.log.warn({ err: error, season, eventCode: path.data.eventCode }, "FTC event profile request failed");
    res.status(502).json({ error: "FTC event details could not be loaded right now." });
  }
});

export default router;
