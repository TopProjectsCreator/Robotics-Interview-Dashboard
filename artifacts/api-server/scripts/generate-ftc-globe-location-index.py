#!/usr/bin/env python3
"""Generate the compact public-location index used by the FTC homepage globe.

Reads the current-season FIRST Events API and GeoNames' cities500 gazetteer.
Credentials are read only from the server-side FTC_EVENTS_* environment
variables. The raw gazetteer is downloaded to a temporary directory and is
never copied into the repository.
"""

from __future__ import annotations

import difflib
import json
import os
import re
import tempfile
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

API_ROOT = "https://ftc-api.firstinspires.org/v2.0"
GEONAMES_ROOT = "https://download.geonames.org/export/dump"
MAX_TEAM_PAGES = 100
PAGE_WORKERS = 12
ARTIFACT = Path(__file__).resolve().parents[1]
OUTPUT = ARTIFACT / "src/lib/ftcGlobeLocationIndex.ts"
FTC_COUNTRY_ALIASES = {
    "Bosnia Herzegovina": "BA",
    "Chinese Taipei": "TW",
    "Czech Republic": "CZ",
    "Macedonia": "MK",
    "Netherlands": "NL",
    "Palestine": "PS",
    "Turkiye": "TR",
}


def normalize(value: str | None) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    ascii_value = decomposed.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", " ", ascii_value).strip()


def get_bytes(url: str, headers: dict[str, str] | None = None) -> bytes:
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def read_text(url: str) -> list[str]:
    return get_bytes(url).decode("utf-8").splitlines()


def load_first_season(season: int) -> tuple[list[dict], list[dict]]:
    username = os.environ.get("FTC_EVENTS_USERNAME", "").strip()
    authorization_key = os.environ.get("FTC_EVENTS_AUTHORIZATION_KEY", "").strip()
    if not username or not authorization_key:
        raise SystemExit("FTC Events API credentials are not configured.")
    auth = (username + ":" + authorization_key).encode("utf-8")
    headers = {
        "Authorization": "Basic " + __import__("base64").b64encode(auth).decode("ascii"),
        "Accept": "application/json",
    }

    def request_json(path: str) -> dict:
        return json.loads(get_bytes(f"{API_ROOT}/{path}", headers).decode("utf-8"))

    first_page = request_json(f"{season}/teams?page=1")
    page_total = int(first_page.get("pageTotal") or 1)
    if page_total > MAX_TEAM_PAGES:
        raise SystemExit(f"FIRST returned {page_total} team pages; the safety limit is {MAX_TEAM_PAGES}.")
    pages = list(range(2, page_total + 1))
    with ThreadPoolExecutor(max_workers=PAGE_WORKERS) as executor:
        remaining = list(executor.map(lambda page: request_json(f"{season}/teams?page={page}"), pages))
    teams = list(first_page.get("teams") or [])
    teams.extend(team for page in remaining for team in page.get("teams", []))
    events = list(request_json(f"{season}/events").get("events") or [])
    return teams, events


def country_and_region_aliases() -> tuple[dict[str, str], dict[str, str]]:
    countries: dict[str, str] = {}
    for line in read_text(f"{GEONAMES_ROOT}/countryInfo.txt"):
        if not line or line.startswith("#"):
            continue
        columns = line.split("\t")
        if len(columns) < 5:
            continue
        iso2, iso3, _, _, country_name = columns[:5]
        if not iso2:
            continue
        for alias in (iso2, iso3, country_name):
            if alias:
                countries[normalize(alias)] = iso2
    for alias, iso2 in FTC_COUNTRY_ALIASES.items():
        countries[normalize(alias)] = iso2

    regions: dict[str, str] = {}
    for line in read_text(f"{GEONAMES_ROOT}/admin1CodesASCII.txt"):
        columns = line.split("\t")
        if len(columns) < 3 or "." not in columns[0]:
            continue
        country, code = columns[0].split(".", 1)
        full_name, ascii_name = columns[1:3]
        words = [word for word in normalize(full_name).split() if word not in {"of", "the", "and"}]
        initials = "".join(word[0] for word in words)
        aliases = {code, full_name, ascii_name}
        if 2 <= len(initials) <= 4:
            aliases.add(initials)
        for alias in aliases:
            normalized = normalize(alias)
            if normalized:
                regions[f"{country}|{normalized}"] = code
    return countries, regions


def row_location(row: dict, countries: dict[str, str], regions: dict[str, str]) -> tuple[str, str, str, str]:
    country_raw = normalize(row.get("country"))
    country = countries.get(country_raw, country_raw.upper())
    region_raw = normalize(row.get("stateProv") or row.get("stateprov"))
    region = regions.get(f"{country}|{region_raw}", region_raw)
    city = normalize(row.get("city"))
    return country, region_raw, region, city


def location_candidates(
    teams: list[dict],
    events: list[dict],
    countries: dict[str, str],
    regions: dict[str, str],
) -> tuple[set[tuple[str, str]], set[str], list[tuple[str, str, str, str]]]:
    relevant_regions: set[tuple[str, str]] = set()
    requested_names: set[str] = set()
    targets = []
    for row in teams + events:
        country, raw_region, region, city = row_location(row, countries, regions)
        targets.append((country, raw_region, region, city))
        requested_names.add(city)
        if region:
            relevant_regions.add((country, region))
            if city.endswith(" " + normalize(region)):
                requested_names.add(city[: -len(normalize(region))].strip())
    return relevant_regions, requested_names, targets


def mean_points(sums: dict[tuple[str, ...], list[float]]) -> dict[str, list[float]]:
    return {
        "|".join(key): [round(values[0] / values[2], 4), round(values[1] / values[2], 4)]
        for key, values in sums.items()
        if values[2]
    }


def build_location_index() -> dict:
    season = datetime.now(timezone.utc).year
    teams, events = load_first_season(season)
    countries, region_aliases = country_and_region_aliases()
    relevant_regions, requested_names, targets = location_candidates(teams, events, countries, region_aliases)

    by_region: dict[tuple[str, str], dict[str, tuple[int, float, float]]] = defaultdict(dict)
    by_country: dict[tuple[str, str], set[tuple[float, float]]] = defaultdict(set)
    region_sums: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    country_sums: dict[tuple[str], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])

    with tempfile.TemporaryDirectory(prefix="ftc-geonames-") as temp_dir:
        archive_path = Path(temp_dir) / "cities500.zip"
        archive_path.write_bytes(get_bytes(f"{GEONAMES_ROOT}/cities500.zip"))
        with zipfile.ZipFile(archive_path) as archive:
            with archive.open("cities500.txt") as source:
                for raw in source:
                    columns = raw.decode("utf-8").rstrip("\n").split("\t")
                    if len(columns) < 15:
                        continue
                    country, region = columns[8], columns[10]
                    if not country:
                        continue
                    try:
                        latitude, longitude = float(columns[4]), float(columns[5])
                    except (TypeError, ValueError):
                        continue
                    population = int(columns[14] or 0)

                    country_sum = country_sums[(country,)]
                    country_sum[0] += latitude
                    country_sum[1] += longitude
                    country_sum[2] += 1
                    if region:
                        region_sum = region_sums[(country, region)]
                        region_sum[0] += latitude
                        region_sum[1] += longitude
                        region_sum[2] += 1

                    region_key = (country, region)
                    if region_key not in relevant_regions:
                        continue
                    names = {normalize(columns[1]), normalize(columns[2])}
                    names.update(normalize(name) for name in columns[3].split(",") if name)
                    names.discard("")
                    for name in names:
                        if name in requested_names:
                            by_country[(country, name)].add((latitude, longitude))
                        current = by_region[region_key].get(name)
                        if current is None or population > current[0]:
                            by_region[region_key][name] = (population, latitude, longitude)

    city_locations: dict[str, list[float]] = {}
    precision_counts = {"city": 0, "region": 0, "country": 0, "unknown": 0}
    for country, raw_region, region, city in targets:
        location = None
        if country and city:
            candidates = by_region.get((country, region), {})
            variants = {city}
            if region and city.endswith(" " + normalize(region)):
                variants.add(city[: -len(normalize(region))].strip())
            for variant in variants:
                candidate = candidates.get(variant)
                if candidate:
                    location = (candidate[1], candidate[2], "city")
                    break
                close = difflib.get_close_matches(variant, candidates.keys(), n=2, cutoff=0.91)
                if close:
                    best = close[0]
                    second_score = difflib.SequenceMatcher(None, variant, close[1]).ratio() if len(close) > 1 else 0
                    best_score = difflib.SequenceMatcher(None, variant, best).ratio()
                    if best_score - second_score >= 0.04:
                        candidate = candidates[best]
                        location = (candidate[1], candidate[2], "city")
                        break

            if location is None and city:
                country_matches = by_country.get((country, city), set())
                if len(country_matches) == 1:
                    latitude, longitude = next(iter(country_matches))
                    location = (latitude, longitude, "city")

        if location is None and country:
            region_center = mean_points({(country, region): region_sums[(country, region)]}).get(f"{country}|{region}")
            if region_center:
                location = (*region_center, "region")

        if location is None and country:
            country_center = mean_points({(country,): country_sums[(country,)]}).get(country)
            if country_center:
                location = (*country_center, "country")

        if location is None:
            location = (0.0, 0.0, "unknown")
        latitude, longitude, precision = location
        precision_counts[precision] += 1
        key = f"{country}|{region}|{city}"
        city_locations[key] = [round(latitude, 4), round(longitude, 4), precision]

    index = {
        "source": "GeoNames cities500, CC BY 4.0",
        "generatedForSeason": season,
        "countries": countries,
        "regionAliases": region_aliases,
        "cityLocations": city_locations,
        "regionLocations": mean_points(dict(region_sums)),
        "countryLocations": mean_points(dict(country_sums)),
        "counts": precision_counts,
    }
    return index


def main() -> None:
    data = build_location_index()
    source_json = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(
        "export type FtcGlobePrecision = 'city' | 'region' | 'country' | 'unknown';\n"
        "export interface FtcGlobeLocationIndex {\n"
        "  source: string;\n"
        "  generatedForSeason: number;\n"
        "  countries: Record<string, string>;\n"
        "  regionAliases: Record<string, string>;\n"
        "  cityLocations: Record<string, [number, number, FtcGlobePrecision]>;\n"
        "  regionLocations: Record<string, [number, number]>;\n"
        "  countryLocations: Record<string, [number, number]>;\n"
        "  counts: Record<FtcGlobePrecision, number>;\n"
        "}\n"
        f"export const ftcGlobeLocationIndex: FtcGlobeLocationIndex = {source_json};\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "season": data["generatedForSeason"],
        "teamsAndEventsMapped": len(data["cityLocations"]),
        "precisionCounts": data["counts"],
        "outputBytes": OUTPUT.stat().st_size,
    }))


if __name__ == "__main__":
    main()
