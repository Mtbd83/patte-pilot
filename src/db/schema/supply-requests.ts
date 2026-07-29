import { pgTable, uuid, integer, text, pgEnum, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { fosterFamilies } from "./foster-families";

export const supplyRequestCategoryEnum = pgEnum("supply_request_category", [
  "croquettes_chat",
  "croquettes_chien",
  "litiere",
  "bac_litiere",
  "cage_transport_chat",
  "cage_transport_chien",
  "griffoir",
  "panier",
  "autre",
]);

// No "traité" value: treating a request deletes its row (see
// treatSupplyRequest in src/server/actions/supply-requests.ts) rather than
// storing a third status — there's nothing left to show once it's done.
export const supplyRequestStatusEnum = pgEnum("supply_request_status", ["en_cours", "pris_en_compte"]);

export const supplyRequests = pgTable(
  "supply_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fosterFamilyId: uuid("foster_family_id")
      .notNull()
      .references(() => fosterFamilies.id, { onDelete: "cascade" }),

    category: supplyRequestCategoryEnum("category").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    comment: text("comment"),
    status: supplyRequestStatusEnum("status").default("en_cours").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("supply_requests_organization_idx").on(table.organizationId),
    fosterFamilyIdx: index("supply_requests_foster_family_idx").on(table.fosterFamilyId),
  }),
);

export type SupplyRequest = typeof supplyRequests.$inferSelect;
export type NewSupplyRequest = typeof supplyRequests.$inferInsert;
export type SupplyRequestCategory = (typeof supplyRequestCategoryEnum.enumValues)[number];
export type SupplyRequestStatus = (typeof supplyRequestStatusEnum.enumValues)[number];
