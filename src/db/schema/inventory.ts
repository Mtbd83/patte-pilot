import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  date,
  pgEnum,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { animalSpeciesEnum } from "./animals";

export const inventoryCategoryEnum = pgEnum("inventory_category", [
  "nourriture",
  "materiel",
  "medical",
  "hygiene",
  "autre",
]);

/**
 * Denormalized status flag, kept in sync by the application layer whenever
 * quantity/minQuantity/expirationDate change (see src/lib/inventory-status.ts
 * once built), so lists/alerts can filter on it directly instead of
 * recomputing it in every query.
 */
export const inventoryStatusEnum = pgEnum("inventory_status", [
  "ok",
  "stock_bas",
  "expire",
  "rupture",
]);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    articleName: varchar("article_name", { length: 200 }).notNull(),
    category: inventoryCategoryEnum("category").notNull(),
    animalSpecies: animalSpeciesEnum("animal_species"), // null = concerne toutes les espèces

    quantity: integer("quantity").default(0).notNull(),
    minQuantity: integer("min_quantity").default(0).notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
    expirationDate: date("expiration_date"),
    status: inventoryStatusEnum("status").default("ok").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("inventory_items_organization_idx").on(table.organizationId),
    statusIdx: index("inventory_items_status_idx").on(table.organizationId, table.status),
  }),
);

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [inventoryItems.organizationId],
    references: [organizations.id],
  }),
}));

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type InventoryCategory = (typeof inventoryCategoryEnum.enumValues)[number];
export type InventoryStatus = (typeof inventoryStatusEnum.enumValues)[number];
