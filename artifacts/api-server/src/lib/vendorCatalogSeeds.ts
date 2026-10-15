/**
 * Hand-collected vendor catalog seeds.
 *
 * Several suppliers expose no verified public full-catalog feed, so automated
 * feed sync can only report them as discovery sources with zero indexed
 * items. Each seed below is a transcribed/scraped listing snapshot collected
 * with keyless tools (see each seed file's header for provenance) so the
 * Parts workspace synced-catalog search still covers these vendors.
 *
 * Coverage honesty rule: a seed reports `synced` ("Complete feed") only when
 * its source pagination was walked to an empty page. Anything scoped, sampled
 * or otherwise short of full enumeration stays `search_only` ("Discovery
 * only") with the scope stated in the message. Live search remains
 * discovery-only either way. The catalog sync merges each seed for its vendor
 * on every run (see collectPublicVendorCatalog), so re-syncs never wipe
 * seeded rows.
 */
import { REV_CATALOG_SEED } from "./revCatalogSeed";
import { STUDICA_CATALOG_SEED } from "./studicaCatalogSeed";
import { AXON_ROBOTICS_CATALOG_SEED } from "./axonRoboticsCatalogSeed";
import { BWTLINK_CATALOG_SEED } from "./bwtlinkCatalogSeed";
import { OFFSET_ROBOTICS_CATALOG_SEED } from "./offsetRoboticsCatalogSeed";

export type VendorCatalogSeedRecord = {
  vendorKey: string;
  externalKey: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

export type VendorSeedCoverage = "complete" | "partial";

type VendorCatalogSeed = {
  records: VendorCatalogSeedRecord[];
  /** Official site URL used as the sync source for this seed. */
  source: string;
  /** Short provenance note shown in sync-state messages. */
  provenance: string;
  coverage: VendorSeedCoverage;
  /** Enumeration evidence (complete) or scope statement (partial). */
  coverageDetail: string;
};

export const VENDOR_CATALOG_SEEDS: ReadonlyMap<string, VendorCatalogSeed> = new Map([
  [
    "rev-robotics",
    {
      records: REV_CATALOG_SEED,
      source: "https://www.revrobotics.com/",
      provenance: "REV Robotics Shop All catalog, Oct 2026 Firecrawl walk",
      coverage: "complete",
      coverageDetail:
        "19 Shop All listing pages walked to end (empty page 20): 372 products with real page URLs and images",
    },
  ],
  [
    "studica",
    {
      records: STUDICA_CATALOG_SEED,
      source: "https://www.studica.com/",
      provenance: "Studica Robot Parts catalog, Oct 2026 polite scrape",
      coverage: "complete",
      coverageDetail:
        "37 Robot Parts listing pages walked to end (category reports 587 products, 587 collected)",
    },
  ],
  [
    "axon-robotics",
    {
      records: AXON_ROBOTICS_CATALOG_SEED,
      source: "https://axon-robotics.com/",
      provenance: "Axon Robotics catalog, Oct 2026 polite scrape",
      coverage: "complete",
      coverageDetail:
        "vendor sitemap enumerated (8 product URLs), all 8 product pages collected",
    },
  ],
  [
    "bwtlink",
    {
      records: BWTLINK_CATALOG_SEED,
      source: "https://bwtlink.com/",
      provenance: "BWTLink catalog, Oct 2026 polite scrape",
      coverage: "complete",
      coverageDetail:
        "all 6 catalog tabs walked (47 listings, 47 detail pages, PIDs all resolved)",
    },
  ],
  [
    "offset-robotics",
    {
      records: OFFSET_ROBOTICS_CATALOG_SEED,
      source: "https://offsetrobotics.com/",
      provenance: "Offset Robotics catalog, Oct 2026 polite scrape",
      coverage: "complete",
      coverageDetail:
        "all 4 catalogs / 12 site-nav collections walked (52 unique products)",
    },
  ],
]);

export type VendorSeedSyncStatus = "synced" | "search_only";

export function vendorSeedSyncStatus(seed: VendorCatalogSeed): VendorSeedSyncStatus {
  return seed.coverage === "complete" ? "synced" : "search_only";
}

export function vendorSeedSyncMessage(seed: VendorCatalogSeed): string {
  const base = `${seed.provenance} (${seed.records.length} products)`;
  if (seed.coverage === "complete") {
    return `${base}; listing pagination walked to its end (${seed.coverageDetail}), and global supplier search remains available.`;
  }
  return `${base}; partial coverage — ${seed.coverageDetail}, and global supplier search remains available.`;
}
