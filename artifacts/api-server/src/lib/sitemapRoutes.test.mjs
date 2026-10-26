import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const { buildSitemapXml, FRONTEND_PATHS } = await import("../routes/sitemap.ts");

const here = path.dirname(fileURLToPath(import.meta.url));
const staticSitemapPath = path.resolve(
  here,
  "../../../robotics-interview-dashboard/public/sitemap.xml",
);

function locsFrom(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

/**
 * The sitemap is for crawlers, so it must list the pages a browser can
 * render. API endpoints are machine contracts (see lib/api-spec/openapi.yaml)
 * and listing them only invites crawlers to fetch JSON nobody can index.
 */
test("the sitemap lists no API endpoints", () => {
  const locs = locsFrom(buildSitemapXml("http://localhost"));

  assert.deepEqual(
    locs.filter((loc) => new URL(loc).pathname.startsWith("/api")),
    [],
    "no /api path may appear in the sitemap",
  );
});

test("the sitemap lists the custom workspaces page", () => {
  const locs = locsFrom(buildSitemapXml("http://localhost"));

  assert.ok(
    locs.includes("http://localhost/custom-workspaces"),
    "the /custom-workspaces page must be listed",
  );
});

test("every frontend path is listed exactly once", () => {
  const locs = locsFrom(buildSitemapXml("http://localhost"));

  assert.equal(locs.length, FRONTEND_PATHS.length);
  assert.equal(new Set(locs).size, locs.length, "no URL may be listed twice");
  for (const frontendPath of FRONTEND_PATHS) {
    assert.ok(
      locs.includes(`http://localhost${frontendPath}`),
      `${frontendPath} must be listed`,
    );
  }
});

test("the checked-in public sitemap matches the generated page list", async () => {
  const staticXml = await readFile(staticSitemapPath, "utf8");
  const staticPaths = locsFrom(staticXml).map((loc) => new URL(loc).pathname);
  const generatedPaths = locsFrom(buildSitemapXml("http://localhost")).map(
    (loc) => new URL(loc).pathname,
  );

  assert.deepEqual(
    staticPaths,
    generatedPaths,
    "public/sitemap.xml must be refreshed when the page list changes",
  );
});
