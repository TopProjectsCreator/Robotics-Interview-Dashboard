const FTC_API_ROOT = "https://ftc-api.firstinspires.org/v2.0";
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
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

type CacheEntry<T> = { expiresAt: number; staleUntil: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

function refreshCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const request = load()
    .then(value => {
      const cachedAt = Date.now();
      cache.set(key, {
        expiresAt: cachedAt + CACHE_TTL_MS,
        staleUntil: cachedAt + STALE_CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry && entry.expiresAt > now) return Promise.resolve(entry.value);

  const existing = pending.get(key) as Promise<T> | undefined;
  if (entry && entry.staleUntil > now) {
    if (!existing) void refreshCache(key, load).catch(() => undefined);
    return Promise.resolve(entry.value);
  }
  if (existing) return existing;
  return refreshCache(key, load);
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
    const firstPage = await getTeamPage(season, 1);
    if (firstPage.pageTotal > MAX_TEAM_PAGES) {
      throw new Error("The FTC team list is too large to search safely. Search by team number instead.");
    }
    const allTeams = [...firstPage.teams];
    for (let start = 2; start <= firstPage.pageTotal; start += PAGE_CONCURRENCY) {
      const pages = Array.from(
        { length: Math.min(PAGE_CONCURRENCY, firstPage.pageTotal - start + 1) },
        (_, index) => start + index,
      );
      const results = await Promise.all(pages.map(page => getTeamPage(season, page)));
      allTeams.push(...results.flatMap(result => result.teams));
    }
    return [...new Map(allTeams.map(team => [team.teamNumber, team])).values()];
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

export async function warmFtcMentionSearchCache(season: number): Promise<void> {
  await Promise.all([getSeasonTeams(season), getSeasonEvents(season)]);
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

export async function searchFtcEntities(season: number, query: string): Promise<{ season: number; teams: FtcTeam[]; events: FtcEvent[] }> {
  const normalized = query.trim();
  if (normalized.length < 2) return { season, teams: [], events: [] };

  let teamsPromise: Promise<FtcTeam[]>;
  if (/^\d{5}$/.test(normalized)) {
    teamsPromise = cached(`team:${season}:${normalized}`, async () => {
      const payload = asRecord(await requestFirst<unknown>(`${season}/teams?teamNumber=${encodePathPart(normalized)}`));
      return Array.isArray(payload.teams)
        ? payload.teams.map(mapTeam).filter((team): team is FtcTeam => team !== null)
        : [];
    });
  } else {
    teamsPromise = getSeasonTeams(season);
  }

  const [teams, events] = await Promise.all([teamsPromise, getSeasonEvents(season)]);
  return {
    season,
    teams: teams
      .map(team => ({ team, rank: rankMatch(normalized, [team.teamNumber, team.displayTeamNumber, team.nameFull, team.nameShort, team.schoolName, team.robotName, team.city, team.stateProv]) }))
      .filter(result => Number.isFinite(result.rank))
      .sort((left, right) => left.rank - right.rank || left.team.teamNumber - right.team.teamNumber)
      .slice(0, 8)
      .map(result => result.team),
    events: events
      .map(event => ({ event, rank: rankMatch(normalized, [event.code, event.name, event.typeName, event.venue, event.city, event.stateProv, event.country]) }))
      .filter(result => Number.isFinite(result.rank))
      .sort((left, right) => left.rank - right.rank || (left.event.name ?? "").localeCompare(right.event.name ?? ""))
      .slice(0, 8)
      .map(result => result.event),
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

export async function getFtcEventProfile(season: number, eventCode: string): Promise<{ event: FtcEvent | null; teams: FtcTeam[] }> {
  return cached(`event-profile:${season}:${eventCode.toLowerCase()}`, async () => {
    const code = encodePathPart(eventCode);
    const [eventsPayload, teamsPayload] = await Promise.all([
      requestFirst<unknown>(`${season}/events?eventCode=${code}`),
      requestFirst<unknown>(`${season}/teams?eventCode=${code}`),
    ]);
    const eventList = asRecord(eventsPayload).events;
    const teamList = asRecord(teamsPayload).teams;
    return {
      event: Array.isArray(eventList) ? eventList.map(event => mapEvent(event, season)).find((event): event is FtcEvent => event !== null) ?? null : null,
      teams: Array.isArray(teamList) ? teamList.map(mapTeam).filter((team): team is FtcTeam => team !== null) : [],
    };
  });
}

export function clearFtcEventCacheForTests(): void {
  cache.clear();
  pending.clear();
}
