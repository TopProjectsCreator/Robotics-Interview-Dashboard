import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const partsCatalogItemsTable = pgTable(
  "parts_catalog_items",
  {
    id: text("id").primaryKey(),
    // NULL identifies shared supplier rows; manual rows always carry a team ID.
    teamId: text("team_id"),
    vendorKey: text("vendor_key").notNull(),
    externalKey: text("external_key").notNull(),
    name: text("name").notNull(),
    isManual: boolean("is_manual").default(false).notNull(),
    sku: text("sku"),
    category: text("category"),
    description: text("description"),
    productUrl: text("product_url"),
    imageUrl: text("image_url"),
    unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
    costCurrency: text("cost_currency"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sharedVendorExternalKey: uniqueIndex("parts_catalog_vendor_external_key_unique")
      .on(table.vendorKey, table.externalKey)
      .where(sql`${table.teamId} is null and ${table.isManual} = false`),
    teamVendorExternalKey: uniqueIndex("parts_catalog_team_vendor_external_key_unique")
      .on(table.teamId, table.vendorKey, table.externalKey)
      .where(sql`${table.teamId} is not null`),
    validSavedCost: check(
      "parts_catalog_saved_cost_valid",
      sql`(${table.unitCost} is null and ${table.costCurrency} is null)
        or (${table.unitCost} >= 0 and ${table.unitCost} <= 99999999.99
          and ${table.costCurrency} is not null
          and ${table.costCurrency} ~ '^[A-Z]{3}$')`,
    ),
  }),
);

export const partsSupplierSyncStatesTable = pgTable(
  "parts_supplier_sync_states",
  {
    vendorKey: text("vendor_key").primaryKey(),
    status: text("status").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    itemCount: integer("item_count").notNull(),
    source: text("source").notNull(),
    message: text("message").notNull(),
  },
  (table) => ({
    validResult: check(
      "parts_supplier_sync_states_valid_result",
      sql`${table.status} in ('synced', 'search_only', 'unavailable', 'incomplete')
        and ${table.itemCount} >= 0`,
    ),
  }),
);

export const partsVendorBlocksTable = pgTable(
  "parts_vendor_blocks",
  {
    teamId: text("team_id").notNull().default("default"),
    vendorKey: text("vendor_key").notNull(),
    blockedAt: timestamp("blocked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teamVendor: primaryKey({ columns: [table.teamId, table.vendorKey] }),
  }),
);

export const partsInventoryTable = pgTable(
  "parts_inventory",
  {
    partId: text("part_id")
      .notNull()
      .references(() => partsCatalogItemsTable.id, { onDelete: "cascade" }),
    teamId: text("team_id").default("default").notNull(),
    quantityOwned: integer("quantity_owned").default(0).notNull(),
    storageLocation: text("storage_location"),
    inventoryNotes: text("inventory_notes"),
    unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
    costCurrency: text("cost_currency"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teamPart: primaryKey({ columns: [table.partId, table.teamId] }),
    nonnegativeQuantity: check(
      "parts_inventory_nonnegative_quantity",
      sql`${table.quantityOwned} >= 0`,
    ),
    validStorageLocation: check(
      "parts_inventory_storage_location_valid",
      sql`${table.storageLocation} is null or length(${table.storageLocation}) <= 120`,
    ),
    validInventoryNotes: check(
      "parts_inventory_notes_valid",
      sql`${table.inventoryNotes} is null or length(${table.inventoryNotes}) <= 2000`,
    ),
    validSavedCost: check(
      "parts_inventory_saved_cost_valid",
      sql`(${table.unitCost} is null and ${table.costCurrency} is null)
        or (${table.unitCost} >= 0 and ${table.unitCost} <= 99999999.99
          and ${table.costCurrency} is not null
          and ${table.costCurrency} ~ '^[A-Z]{3}$')`,
    ),
  }),
);

export const partsRobotsTable = pgTable(
  "parts_robots",
  {
    id: text("id").primaryKey(),
    // NULL = legacy row belonging to the default team; never lost.
    teamId: text("team_id"),
    name: text("name").notNull(),
    previewObjectPath: text("preview_object_path"),
    previewFileName: text("preview_file_name"),
    previewContentType: text("preview_content_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueName: uniqueIndex("parts_robots_normalized_name_unique").on(
      table.teamId,
      sql`lower(${table.name})`,
    ),
    validPreview: check(
      "parts_robots_preview_metadata_valid",
      sql`(${table.previewObjectPath} is null and ${table.previewFileName} is null and ${table.previewContentType} is null)
        or (${table.previewObjectPath} ~ '^/objects/[A-Za-z0-9-]{8,128}$'
          and ${table.previewFileName} is not null and ${table.previewContentType} is not null
          and length(${table.previewFileName}) between 1 and 255
          and length(${table.previewContentType}) between 1 and 100)`,
    ),
  }),
);

export const partsRobotAllocationsTable = pgTable(
  "parts_robot_allocations",
  {
    id: text("id").primaryKey(),
    robotId: text("robot_id")
      .notNull()
      .references(() => partsRobotsTable.id, { onDelete: "cascade" }),
    partId: text("part_id")
      .notNull()
      .references(() => partsCatalogItemsTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    robotPart: uniqueIndex("parts_robot_allocations_robot_part_unique").on(
      table.robotId,
      table.partId,
    ),
    positiveQuantity: check(
      "parts_robot_allocations_positive_quantity",
      sql`${table.quantity} > 0`,
    ),
  }),
);

export const partsSupplierPriceSnapshotsTable = pgTable(
  "parts_supplier_price_snapshots",
  {
    id: text("id").primaryKey(),
    partId: text("part_id")
      .notNull()
      .references(() => partsCatalogItemsTable.id, { onDelete: "cascade" }),
    teamId: text("team_id").default("default").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    sourceUrl: text("source_url").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    isStartingAt: boolean("is_starting_at").default(false).notNull(),
  },
  (table) => ({
    validQuote: check(
      "parts_supplier_price_snapshots_valid",
      sql`${table.unitPrice} >= 0 and ${table.unitPrice} <= 99999999.99
        and ${table.currency} ~ '^[A-Z]{3}$'
        and length(${table.sourceUrl}) between 1 and 2000`,
    ),
  }),
);