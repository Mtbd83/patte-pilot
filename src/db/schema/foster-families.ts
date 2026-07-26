import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./organizations";

export const fosterFamilies = pgTable(
  "foster_families",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    lastName: varchar("last_name", { length: 120 }).notNull(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 30 }),
    email: varchar("email", { length: 255 }),

    // "Autres animaux" déjà présents chez la famille d'accueil.
    hasCats: boolean("has_cats").default(false).notNull(),
    hasDogs: boolean("has_dogs").default(false).notNull(),
    hasRabbits: boolean("has_rabbits").default(false).notNull(),

    // Compte utilisateur lié, si la famille d'accueil a aussi un accès à la plateforme
    // (cumul avec le rôle "famille_accueil" dans organization_member_roles).
    linkedUserId: uuid("linked_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("foster_families_organization_idx").on(table.organizationId),
  }),
);

// Note: full `fosterFamilies` relations are declared in ./index.ts, merged
// with the cross-domain "many" sides (placements, animals hosted).

export type FosterFamily = typeof fosterFamilies.$inferSelect;
export type NewFosterFamily = typeof fosterFamilies.$inferInsert;
