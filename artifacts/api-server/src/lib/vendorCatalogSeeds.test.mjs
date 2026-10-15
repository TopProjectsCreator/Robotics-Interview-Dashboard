import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// vendorCatalogSeeds.ts uses extensionless relative imports (tsc/esbuild
// convention). Resolve them the same way the import script does: the seed
// import must stay dynamic because registerHooks only affects resolutions
// issued after it runs.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        specifier.startsWith(".") &&
        !specifier.endsWith(".ts") &&
        !specifier.endsWith(".js")
      ) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});
const { VENDOR_CATALOG_SEEDS } = await import("./vendorCatalogSeeds.ts");

const VENDOR_DOMAINS = {
  "rev-robotics": "revrobotics.com",
  "studica": "studica.com",
  "axon-robotics": "axon-robotics.com",
  "bwtlink": "bwtlink.com",
  "offset-robotics": "offsetrobotics.com",
};

function owns(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

test("every registered seed is shaped for the catalog upsert", () => {
  assert.ok(VENDOR_CATALOG_SEEDS.size >= 1);
  for (const [vendorKey, seed] of VENDOR_CATALOG_SEEDS) {
    assert.ok(seed.records.length > 0, `${vendorKey}: empty seed`);
    assert.ok(seed.provenance.length > 0, `${vendorKey}: missing provenance`);
    assert.ok(
      seed.coverage === "complete" || seed.coverage === "partial",
      `${vendorKey}: bad coverage`,
    );
    assert.ok(seed.coverageDetail.length > 0, `${vendorKey}: missing coverage detail`);
    const domain = VENDOR_DOMAINS[vendorKey];
    assert.ok(domain, `${vendorKey}: add vendor domain to registry test`);
    const externalKeys = new Set();
    for (const record of seed.records) {
      assert.equal(record.vendorKey, vendorKey);
      assert.ok(record.name.length >= 2, `${vendorKey}: bad name`);
      assert.ok(
        record.externalKey.length > 0 && record.externalKey.length <= 500,
        `${vendorKey}: bad externalKey`,
      );
      assert.ok(!externalKeys.has(record.externalKey), `${vendorKey}: dup ${record.externalKey}`);
      externalKeys.add(record.externalKey);
      assert.ok(
        record.description === null || record.description.length <= 1200,
        `${vendorKey}: description too long`,
      );
      if (record.productUrl !== null) {
        const url = new URL(record.productUrl);
        assert.equal(url.protocol, "https:", `${vendorKey}: non-https productUrl`);
        assert.ok(owns(url.hostname, domain), `${vendorKey}: off-domain ${record.productUrl}`);
      }
      if (record.imageUrl !== null) {
        assert.ok(record.imageUrl.startsWith("https://"), `${vendorKey}: bad imageUrl`);
      }
    }
  }
});

test("complete seeds have enumeration evidence in their coverage detail", () => {
  for (const [vendorKey, seed] of VENDOR_CATALOG_SEEDS) {
    if (seed.coverage === "complete") {
      assert.ok(
        /walked to end|walked \(|enumerated|all \d+/i.test(seed.coverageDetail),
        `${vendorKey}: complete coverage needs enumeration evidence`,
      );
    }
  }
});
