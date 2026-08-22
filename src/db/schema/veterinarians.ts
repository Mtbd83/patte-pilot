import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  doublePrecision,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { animalSpeciesEnum, animalSexEnum } from "./animals";

/** A partner veterinarian, contact details owned by the organization. */
export const veterinarians = pgTable(
  "veterinarians",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 200 }).notNull(),
    address: text("address"),
    postalCode: varchar("postal_code", { length: 10 }),
    city: varchar("city", { length: 120 }),
    phone: varchar("phone", { length: 30 }),
    notes: text("notes"),

    // Geocoded server-side from address/postalCode/city (see
    // src/lib/geocoding.ts) whenever they're set — null if geocoding
    // failed or no address was given yet; the vet is still usable, just
    // absent from the map.
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("veterinarians_organization_idx").on(table.organizationId),
  }),
);

/**
 * One priced act for a vet — species/sex narrow which animals it applies
 * to; null in either means "any" (e.g. a consultation fee that doesn't
 * depend on sex), the same nullable-means-all convention as
 * inventory_items.animal_species.
 */
export const veterinarianTariffs = pgTable(
  "veterinarian_tariffs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    veterinarianId: uuid("veterinarian_id")
      .notNull()
      .references(() => veterinarians.id, { onDelete: "cascade" }),

    actName: varchar("act_name", { length: 200 }).notNull(),
    species: animalSpeciesEnum("species"),
    sex: animalSexEnum("sex"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    vetIdx: index("veterinarian_tariffs_veterinarian_idx").on(table.veterinarianId),
  }),
);

export type Veterinarian = typeof veterinarians.$inferSelect;
export type NewVeterinarian = typeof veterinarians.$inferInsert;
export type VeterinarianTariff = typeof veterinarianTariffs.$inferSelect;
export type NewVeterinarianTariff = typeof veterinarianTariffs.$inferInsert;
