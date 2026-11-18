import type { FtcGlobeResponse } from "@workspace/api-zod";
import { ftcGlobeLocationIndex } from "./ftcGlobeLocationIndex.ts";

const FTC_API_ROOT = "https://ftc-api.firstinspires.org/v2.0";
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MATCH_CACHE_TTL_MS = 20 * 1000;
const MATCH_STALE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_TEAM_PAGES = 100;
const PAGE_CONCURRENCY = 12;
const REQUEST_TIMEOUT_MS = 12_000;

export type FtcTeam = {
  teamNumber: number;
  displayTeamNumber: string | null;
  nameFull: string | null;
  nameShort: string | null;
  schoolName: string | null;
  city: string | null;
  stateProv: string | null;
  country: string | null;
  website: string | null;
  rookieYear: number | null;
  robotName: string | null;
  homeRegion: string | null;
};

export type FtcEvent = {
  season: number;
  code: string;
  name: string | null;
  typeName: string | null;
  venue: string | null;
  city: string | null;
  stateProv: string | null;
  country: string | null;
  website: string | null;
  liveStreamUrl: string | null;
  dateStart: string | null;
  dateEnd: string | null;
};

export type FtcEventMatch = {
  description: string | null;
  tournamentLevel: "qualification" | "playoff" | "practice" | "other";
  series: number | null;
  matchNumber: number;
  redTeamNumbers: number[];
  blueTeamNumbers: number[];
  redScore: number | null;
  blueScore: number | null;
  resultStatus: "scheduled" | "unavailable" | "final" | "tie";
  winningAlliance: "red" | "blue" | "tie" | null;
};

type CacheEntry<T> = { expiresAt: number; staleUntil: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();
const loadErrors = new Map<string, { error: unknown; retryAt: number }>();
const partialTeamLists = new Map<number, FtcTeam[]>();
const CACHE_ERROR_RETRY_MS = 5_000;

type CacheOptions = { ttlMs?: number; staleTtlMs?: number };

function refreshCache<T>(key: string, load: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
  loadErrors.delete(key);
  const request = Promise.resolve()
    .then(load)
    .then(value => {
      const cachedAt = Date.now();
      cache.set(key, {
        expiresAt: cachedAt + (options.ttlMs ?? CACHE_TTL_MS),
        staleUntil: cachedAt + (options.staleTtlMs ?? STALE_CACHE_TTL_MS),
        value,
      });
      return value;
    })
    .catch(error => {
      loadErrors.set(key, { error, retryAt: Date.now() + CACHE_ERROR_RETRY_MS });
      throw error;
    })
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
  pending.set(key, request);
  return request;
}

function cached<T>(key: string, load: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry && entry.expiresAt > now) return Promise.resolve(entry.value);

  const existing = pending.get(key) as Promise<T> | undefined;
  if (entry && entry.staleUntil > now) {
    const previousError = loadErrors.get(key);
    if (!existing && (!previousError || previousError.retryAt <= now)) {
      void refreshCache(key, load, options).catch(() => undefined);
    }
    return Promise.resolve(entry.value);
  }
  if (existing) return existing;
  const previousError = loadErrors.get(key);
  if (previousError && previousError.retryAt > now) return Promise.reject(previousError.error);
  return refreshCache(key, load, options);
}

function requiredCredentials(): string {
  const username = process.env.FTC_EVENTS_USERNAME?.trim();
  const authorizationKey = process.env.FTC_EVENTS_AUTHORIZATION_KEY?.trim();
  if (!username || !authorizationKey) {
    throw new Error("FTC Events API credentials are not configured.");
  }
  return `Basic ${Buffer.from(`${username}:${authorizationKey}`).toString("base64")}`;
}

async function requestFirst<T>(path: string): Promise<T> {
  const response = await fetch(`${FTC_API_ROOT}/${path}`, {
    headers: {
      Authorization: requiredCredentials(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`FTC Events API returned ${response.status}.`);
  }
  return await response.json() as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapTeam(value: unknown): FtcTeam | null {
  const source = asRecord(value);
  const teamNumber = source.teamNumber;
  if (typeof teamNumber !== "number" || !Number.isInteger(teamNumber) || teamNumber < 1) return null;
  return {
    teamNumber,
    displayTeamNumber: nullableString(source.displayTeamNumber),
    nameFull: nullableString(source.nameFull),
    nameShort: nullableString(source.nameShort),
    schoolName: nullableString(source.schoolName),
    city: nullableString(source.city),
    stateProv: nullableString(source.stateProv),
    country: nullableString(source.country),
    website: nullableString(source.website),
    rookieYear: nullableNumber(source.rookieYear),
    robotName: nullableString(source.robotName),
    homeRegion: nullableString(source.homeRegion),
  };
}

function mapEvent(value: unknown, season: number): FtcEvent | null {
  const source = asRecord(value);
  const code = nullableString(source.code);
  if (!code) return null;
  return {
    season,
    code,
    name: nullableString(source.name),
    typeName: nullableString(source.typeName),
    venue: nullableString(source.venue),
    city: nullableString(source.city),
    stateProv: nullableString(source.stateprov ?? source.stateProv),
    country: nullableString(source.country),
    website: nullableString(source.website),
    liveStreamUrl: nullableString(source.liveStreamUrl),
    dateStart: nullableString(source.dateStart),
    dateEnd: nullableString(source.dateEnd),
  };
}

function mapTournamentLevel(value: unknown): FtcEventMatch["tournamentLevel"] {
  switch (typeof value === "string" ? value.trim().toLocaleUpperCase() : "") {
    case "QUALIFICATION":
      return "qualification";
    case "PLAYOFF":
      return "playoff";
    case "PRACTICE":
      return "practice";
    default:
      return "other";
  }
}

function allianceTeamNumbers(teams: unknown, alliance: "Red" | "Blue"): number[] {
  if (!Array.isArray(teams)) return [];
  const allianceTeams = teams.flatMap(team => {
    const source = asRecord(team);
    const station = nullableString(source.station);
    const match = station?.match(new RegExp(`^${alliance}(1|2)$`, "i"));
    const teamNumber = source.teamNumber;
    if (!match || typeof teamNumber !== "number" || !Number.isInteger(teamNumber) || teamNumber < 1) return [];
    return [{ position: Number(match[1]), teamNumber }];
  });
  return [...new Map(allianceTeams
    .sort((left, right) => left.position - right.position)
    .map(team => [team.position, team.teamNumber])).values()];
}

function mapFtcEventMatch(value: unknown): FtcEventMatch | null {
  const source = asRecord(value);
  const matchNumber = source.matchNumber;
  if (typeof matchNumber !== "number" || !Number.isInteger(matchNumber) || matchNumber < 1) return null;

  const redTeamNumbers = allianceTeamNumbers(source.teams, "Red");
  const blueTeamNumbers = allianceTeamNumbers(source.teams, "Blue");
  // Only render a match when FIRST has published both sides of its matchup.
  if (!redTeamNumbers.length || !blueTeamNumbers.length) return null;

  const publishedResult = nullableString(source.postResultTime) !== null;
  const officialRedScore = nullableNumber(source.scoreRedFinal);
  const officialBlueScore = nullableNumber(source.scoreBlueFinal);
  const redScore = publishedResult ? officialRedScore : null;
  const blueScore = publishedResult ? officialBlueScore : null;
  let resultStatus: FtcEventMatch["resultStatus"] = "scheduled";
  let winningAlliance: FtcEventMatch["winningAlliance"] = null;
  if (publishedResult) {
    if (redScore === null || blueScore === null) {
      resultStatus = "unavailable";
    } else if (redScore === blueScore) {
      resultStatus = "tie";
      winningAlliance = "tie";
    } else {
      resultStatus = "final";
      winningAlliance = redScore > blueScore ? "red" : "blue";
    }
  }

  const series = source.series;
  return {
    description: nullableString(source.description),
    tournamentLevel: mapTournamentLevel(source.tournamentLevel),
    series: typeof series === "number" && Number.isInteger(series) && series >= 0 ? series : null,
    matchNumber,
    redTeamNumbers,
    blueTeamNumbers,
    redScore,
    blueScore,
    resultStatus,
    winningAlliance,
  };
}

function rankMatch(query: string, fields: readonly (string | number | null)[]): number {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return 0;
  const values = fields.filter((value): value is string | number => value !== null)
    .map(value => String(value).toLocaleLowerCase());
  if (values.some(value => value === needle)) return 0;
  if (values.some(value => value.startsWith(needle))) return 1;
  return values.some(value => value.includes(needle)) ? 2 : Number.POSITIVE_INFINITY;
}

async function getTeamPage(season: number, page: number): Promise<{ teams: FtcTeam[]; pageTotal: number }> {
  const payload = asRecord(await requestFirst<unknown>(`${season}/teams?page=${page}`));
  const teams = Array.isArray(payload.teams) ? payload.teams.map(mapTeam).filter((team): team is FtcTeam => team !== null) : [];
  const pageTotal = typeof payload.pageTotal === "number" && Number.isFinite(payload.pageTotal)
    ? Math.max(1, Math.trunc(payload.pageTotal))
    : 1;
  return { teams, pageTotal };
}

async function getSeasonTeams(season: number): Promise<FtcTeam[]> {
  return cached(`teams:${season}`, async () => {
    const cachedTeams = cache.get(`teams:${season}`);
    if (!cachedTeams || cachedTeams.staleUntil <= Date.now()) partialTeamLists.delete(season);
    const firstPage = await getTeamPage(season, 1);
    if (firstPage.pageTotal > MAX_TEAM_PAGES) {
      throw new Error("The FTC team list is too large to search safely. Search by team number instead.");
    }
    const allTeams = [...firstPage.teams];
    partialTeamLists.set(season, allTeams);
    for (let start = 2; start <= firstPage.pageTotal; start += PAGE_CONCURRENCY) {
      const pages = Array.from(
        { length: Math.min(PAGE_CONCURRENCY, firstPage.pageTotal - start + 1) },
        (_, index) => start + index,
      );
      const partialTeams = new Map(allTeams.map(team => [team.teamNumber, team]));
      const results = await Promise.all(pages.map(async page => {
        const result = await getTeamPage(season, page);
        for (const team of result.teams) partialTeams.set(team.teamNumber, team);
        partialTeamLists.set(season, [...partialTeams.values()]);
        return { page, result };
      }));
      allTeams.push(...results.sort((left, right) => left.page - right.page).flatMap(result => result.result.teams));
    }
    const uniqueTeams = [...new Map(allTeams.map(team => [team.teamNumber, team])).values()];
    partialTeamLists.set(season, uniqueTeams);
    return uniqueTeams;
  });
}

async function getSeasonEvents(season: number): Promise<FtcEvent[]> {
  return cached(`events:${season}`, async () => {
    const payload = asRecord(await requestFirst<unknown>(`${season}/events`));
    return Array.isArray(payload.events)
      ? payload.events.map(event => mapEvent(event, season)).filter((event): event is FtcEvent => event !== null)
      : [];
  });
}

function normalizeLocationPart(value: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getFtcLocation(city: string | null, stateProv: string | null, country: string | null): {
  latitude: number;
  longitude: number;
  precision: "city" | "region" | "country" | "unknown";
} {
  const normalizedCountry = normalizeLocationPart(country);
  const countryCode = ftcGlobeLocationIndex.countries[normalizedCountry] ?? normalizedCountry.toUpperCase();
  const normalizedRegion = normalizeLocationPart(stateProv);
  const regionCode = ftcGlobeLocationIndex.regionAliases[`${countryCode}|${normalizedRegion}`] ?? normalizedRegion;
  const normalizedCity = normalizeLocationPart(city);
  const cityPoint = ftcGlobeLocationIndex.cityLocations[`${countryCode}|${regionCode}|${normalizedCity}`];
  if (cityPoint) return { latitude: cityPoint[0], longitude: cityPoint[1], precision: cityPoint[2] };

  const regionPoint = ftcGlobeLocationIndex.regionLocations[`${countryCode}|${regionCode}`];
  if (regionPoint) return { latitude: regionPoint[0], longitude: regionPoint[1], precision: "region" };

  const countryPoint = ftcGlobeLocationIndex.countryLocations[countryCode];
  if (countryPoint) return { latitude: countryPoint[0], longitude: countryPoint[1], precision: "country" };

  return { latitude: 0, longitude: 0, precision: "unknown" };
}

function formatLocation(city: string | null, stateProv: string | null, country: string | null): string {
  const parts = [city, stateProv, country].filter((part): part is string => Boolean(part?.trim()));
  return parts.length ? parts.join(", ") : "Location unavailable";
}

export async function getFtcGlobeData(season: number): Promise<FtcGlobeResponse> {
  return cached(`globe:${season}`, async () => {
    const [teams, events] = await Promise.all([getSeasonTeams(season), getSeasonEvents(season)]);
    const teamPoints = teams.map(team => {
      const location = getFtcLocation(team.city, team.stateProv, team.country);
      return {
        id: `team-${season}-${team.teamNumber}`,
        kind: "team" as const,
        season,
        ...location,
        label: team.nameFull ?? team.nameShort ?? team.schoolName ?? `FTC Team ${team.teamNumber}`,
        location: formatLocation(team.city, team.stateProv, team.country),
        teamNumber: team.teamNumber,
        eventCode: null,
        schoolName: team.schoolName,
        nameShort: team.nameShort,
        robotName: team.robotName,
        rookieYear: team.rookieYear,
        typeName: null,
        venue: null,
        website: team.website,
        liveStreamUrl: null,
        dateStart: null,
        dateEnd: null,
      };
    });
    const eventPoints = events.map(event => {
      const location = getFtcLocation(event.city, event.stateProv, event.country);
      return {
        id: `event-${season}-${event.code}`,
        kind: "event" as const,
        season,
        ...location,
        label: event.name ?? `FTC Event ${event.code}`,
        location: formatLocation(event.city, event.stateProv, event.country),
        teamNumber: null,
        eventCode: event.code,
        schoolName: null,
        nameShort: null,
        robotName: null,
        rookieYear: null,
        typeName: event.typeName,
        venue: event.venue,
        website: event.website,
        liveStreamUrl: event.liveStreamUrl,
        dateStart: event.dateStart,
        dateEnd: event.dateEnd,
      };
    });
    return {
      season,
      teamCount: teams.length,
      eventCount: events.length,
      points: [...teamPoints, ...eventPoints],
    };
  });
}

export async function warmFtcMentionSearchCache(season: number): Promise<void> {
  await Promise.all([getSeasonTeams(season), getSeasonEvents(season)]);
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

type FtcSearchSourceStatus = "loading" | "ready" | "error";

function availableCacheValue<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  return entry && entry.staleUntil > Date.now() ? entry.value : undefined;
}

function sourceStatus(key: string): FtcSearchSourceStatus {
  if (pending.has(key)) return "loading";
  if (loadErrors.has(key)) return "error";
  if (availableCacheValue(key) !== undefined) return "ready";
  return "loading";
}

function filterTeams(query: string, teams: readonly FtcTeam[]): FtcTeam[] {
  return teams
    .map(team => ({ team, rank: rankMatch(query, [team.teamNumber, team.displayTeamNumber, team.nameFull, team.nameShort, team.schoolName, team.robotName, team.city, team.stateProv]) }))
    .filter(result => Number.isFinite(result.rank))
    .sort((left, right) => left.rank - right.rank || left.team.teamNumber - right.team.teamNumber)
    .slice(0, 8)
    .map(result => result.team);
}

function filterEvents(query: string, events: readonly FtcEvent[]): FtcEvent[] {
  return events
    .map(event => ({ event, rank: rankMatch(query, [event.code, event.name, event.typeName, event.venue, event.city, event.stateProv, event.country]) }))
    .filter(result => Number.isFinite(result.rank))
    .sort((left, right) => left.rank - right.rank || (left.event.name ?? "").localeCompare(right.event.name ?? ""))
    .slice(0, 8)
    .map(result => result.event);
}

export async function searchFtcEntities(season: number, query: string): Promise<{
  season: number;
  teams: FtcTeam[];
  events: FtcEvent[];
  teamsStatus: FtcSearchSourceStatus;
  eventsStatus: FtcSearchSourceStatus;
}> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return { season, teams: [], events: [], teamsStatus: "ready", eventsStatus: "ready" };
  }

  const exactTeamKey = /^\d{5}$/.test(normalized) ? `team:${season}:${normalized}` : null;
  const teamsKey = exactTeamKey ?? `teams:${season}`;
  const eventsKey = `events:${season}`;
  if (!exactTeamKey && !availableCacheValue<FtcTeam[]>(teamsKey) && !pending.has(teamsKey)) {
    partialTeamLists.delete(season);
  }
  const teamsPromise = exactTeamKey
    ? cached(exactTeamKey, async () => {
      const payload = asRecord(await requestFirst<unknown>(`${season}/teams?teamNumber=${encodePathPart(normalized)}`));
      return Array.isArray(payload.teams)
        ? payload.teams.map(mapTeam).filter((team): team is FtcTeam => team !== null)
        : [];
    })
    : getSeasonTeams(season);
  const eventsPromise = getSeasonEvents(season);
  void teamsPromise.catch(() => undefined);
  void eventsPromise.catch(() => undefined);

  const teamsStatus = sourceStatus(teamsKey);
  const eventsStatus = sourceStatus(eventsKey);
  if (teamsStatus === "error" && eventsStatus === "error") {
    throw new Error("FTC team and event data could not be loaded.");
  }
  const fullSeasonTeams = exactTeamKey ? availableCacheValue<FtcTeam[]>(`teams:${season}`) : undefined;
  const teams = exactTeamKey
    ? availableCacheValue<FtcTeam[]>(exactTeamKey) ?? (fullSeasonTeams?.filter(team => String(team.teamNumber) === normalized) ?? [])
    : availableCacheValue<FtcTeam[]>(teamsKey) ?? partialTeamLists.get(season) ?? [];
  const events = availableCacheValue<FtcEvent[]>(eventsKey) ?? [];
  return {
    season,
    teams: filterTeams(normalized, teams),
    events: filterEvents(normalized, events),
    teamsStatus,
    eventsStatus,
  };
}

export async function getFtcTeamProfile(season: number, teamNumber: number): Promise<{ team: FtcTeam | null; events: FtcEvent[] }> {
  return cached(`team-profile:${season}:${teamNumber}`, async () => {
    const [teamsPayload, eventsPayload] = await Promise.all([
      requestFirst<unknown>(`${season}/teams?teamNumber=${teamNumber}`),
      requestFirst<unknown>(`${season}/events?teamNumber=${teamNumber}`),
    ]);
    const teamList = asRecord(teamsPayload).teams;
    const eventList = asRecord(eventsPayload).events;
    return {
      team: Array.isArray(teamList) ? teamList.map(mapTeam).find((team): team is FtcTeam => team !== null) ?? null : null,
      events: Array.isArray(eventList) ? eventList.map(event => mapEvent(event, season)).filter((event): event is FtcEvent => event !== null) : [],
    };
  });
}

export async function getFtcEventProfile(season: number, eventCode: string): Promise<{
  event: FtcEvent | null;
  teams: FtcTeam[];
  matches: FtcEventMatch[];
}> {
  return cached(`event-profile:${season}:${eventCode.toLowerCase()}`, async () => {
    const code = encodePathPart(eventCode);
    const [eventsPayload, teamsPayload] = await Promise.all([
      requestFirst<unknown>(`${season}/events?eventCode=${code}`),
      requestFirst<unknown>(`${season}/teams?eventCode=${code}`),
    ]);
    const eventList = asRecord(eventsPayload).events;
    const teamList = asRecord(teamsPayload).teams;
    const event = Array.isArray(eventList)
      ? eventList.map(value => mapEvent(value, season)).find((item): item is FtcEvent => item !== null) ?? null
      : null;
    const teams = Array.isArray(teamList)
      ? teamList.map(mapTeam).filter((team): team is FtcTeam => team !== null)
      : [];
    if (!event) return { event: null, teams, matches: [] };

    const matchesPayload = asRecord(await requestFirst<unknown>(`${season}/matches/${code}`));
    return {
      event,
      teams,
      matches: Array.isArray(matchesPayload.matches)
        ? matchesPayload.matches.map(mapFtcEventMatch).filter((match): match is FtcEventMatch => match !== null)
        : [],
    };
  }, {
    ttlMs: MATCH_CACHE_TTL_MS,
    staleTtlMs: MATCH_STALE_CACHE_TTL_MS,
  });
}

export function clearFtcEventCacheForTests(): void {
  cache.clear();
  pending.clear();
  loadErrors.clear();
  partialTeamLists.clear();
}
