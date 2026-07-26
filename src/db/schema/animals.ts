import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  pgEnum,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { fosterFamilies } from "./foster-families";

export const animalSpeciesEnum = pgEnum("animal_species", [
  "chat",
  "chien",
  "lapin",
  "autre",
]);

export const animalSexEnum = pgEnum("animal_sex", ["male", "femelle", "inconnu"]);

/**
 * Lifecycle status of an animal. Whenever the status is one of
 * quarantaine / en_soins / en_famille_accueil / visite_en_cours / reserve,
 * the animal is expected to be linked to a foster family via
 * `currentFosterFamilyId` (enforced at the application layer, see
 * src/lib/animal-status.ts once the module is built).
 */
export const animalStatusEnum = pgEnum("animal_status", [
  "quarantaine",
  "en_soins",
  "en_famille_accueil",
  "visite_en_cours",
  "reserve",
  "adopte",
  "archive",
]);

export const animals = pgTable(
  "animals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 120 }).notNull(),
    species: animalSpeciesEnum("species").default("chat").notNull(),

    icadNumber: varchar("icad_number", { length: 50 }),
    icadUpdatedAt: date("icad_updated_at"), // date de changement d'ICAD, le cas échéant

    birthDate: date("birth_date"),
    breed: varchar("breed", { length: 120 }), // race
    sex: animalSexEnum("sex").default("inconnu").notNull(),
    coat: varchar("coat", { length: 120 }), // pelage
    description: text("description"),

    intakeDate: date("intake_date").notNull(), // date de prise en charge
    adoptionDate: date("adoption_date"), // date d'adoption, si adopté

    status: animalStatusEnum("status").default("quarantaine").notNull(),

    // Denormalized pointer to the current foster family for fast lookups.
    // The full history of placements lives in `animal_placements`.
    currentFosterFamilyId: uuid("current_foster_family_id").references(
      () => fosterFamilies.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("animals_organization_idx").on(table.organizationId),
    statusIdx: index("animals_status_idx").on(table.organizationId, table.status),
  }),
);

/**
 * One-to-one health checklist per animal: first vaccine, sterilization,
 * booster — each with a done/not-done flag and an optional date.
 */
export const animalHealthChecklists = pgTable(
  "animal_health_checklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    animalId: uuid("animal_id")
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),

    firstVaccineDone: boolean("first_vaccine_done").default(false).notNull(),
    firstVaccineDate: date("first_vaccine_date"),

    sterilizationDone: boolean("sterilization_done").default(false).notNull(),
    sterilizationDate: date("sterilization_date"),

    boosterDone: boolean("booster_done").default(false).notNull(),
    boosterDate: date("booster_date"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqAnimal: uniqueIndex("uniq_animal_health_checklist").on(table.animalId),
  }),
);

// Note: full `animals` relations (organization, foster family, health
// checklist, plus the cross-domain "many" sides) are declared in ./index.ts
// so `animals` has exactly one `relations()` definition.

export const animalHealthChecklistsRelations = relations(
  animalHealthChecklists,
  ({ one }) => ({
    animal: one(animals, {
      fields: [animalHealthChecklists.animalId],
      references: [animals.id],
    }),
  }),
);

export type Animal = typeof animals.$inferSelect;
export type NewAnimal = typeof animals.$inferInsert;
export type AnimalHealthChecklist = typeof animalHealthChecklists.$inferSelect;
export type AnimalStatus = (typeof animalStatusEnum.enumValues)[number];
export type AnimalSpecies = (typeof animalSpeciesEnum.enumValues)[number];
export type AnimalSex = (typeof animalSexEnum.enumValues)[number];
