import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const partsCatalogItemsTable = pgTable(
  "parts_catalog_items",
  {
    id: text("id").primaryKey(),
    vendorKey: text("vendor_key").notNull(),
    externalKey: text("external_key").notNull(),
    name: text("name").notNull(),
    sku: text("sku"),
    category: text("category"),
    description: text("description"),
    productUrl: text("product_url"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    vendorExternalKey: uniqueIndex("parts_catalog_vendor_external_key_unique").on(
      table.vendorKey,
      table.externalKey,
    ),
  }),
);

export const partsInventoryTable = pgTable(
  "parts_inventory",
  {
    partId: text("part_id")
      .primaryKey()
      .references(() => partsCatalogItemsTable.id, { onDelete: "cascade" }),
    quantityOwned: integer("quantity_owned").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nonnegativeQuantity: check(
      "parts_inventory_nonnegative_quantity",
      sql`${table.quantityOwned} >= 0`,
    ),
  }),
);

export const partsRobotsTable = pgTable(
  "parts_robots",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueName: uniqueIndex("parts_robots_normalized_name_unique").on(
      sql`lower(${table.name})`,
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