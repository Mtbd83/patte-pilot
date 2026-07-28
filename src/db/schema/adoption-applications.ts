import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { animals, animalSpeciesEnum } from "./animals";

export const adoptionApplicationStatusEnum = pgEnum("adoption_application_status", [
  "en_attente",
  "en_cours",
  "retenu",
  "refuse",
  "retire",
]);

export const housingTypeEnum = pgEnum("housing_type", [
  "maison",
  "appartement",
  "autre",
]);

export const housingZoneEnum = pgEnum("housing_zone", [
  "urbaine",
  "peri_urbaine",
  "rurale",
]);

export const residencyStatusEnum = pgEnum("residency_status", [
  "proprietaire",
  "locataire",
]);

export const livingSituationEnum = pgEnum("living_situation", [
  "seul",
  "en_couple",
  "colocation",
  "en_famille",
]);

export const activityLevelEnum = pgEnum("activity_level", [
  "intense",
  "modere",
  "faible",
]);

export const aloneTimeEnum = pgEnum("alone_time_per_day", [
  "presque_aucune",
  "moins_2h",
  "2h_4h",
  "4h_6h",
  "8h_plus",
]);

/**
 * A submitted adoption application, mirroring the fields of the current
 * Google Form so imports/migration stay straightforward. Kept as one wide
 * table (rather than heavily normalized) since it represents a single
 * point-in-time submission, not data that's queried/updated piecemeal.
 */
export const adoptionApplications = pgTable(
  "adoption_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Identité du candidat
    lastName: varchar("last_name", { length: 120 }).notNull(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }),
    phone: varchar("phone", { length: 30 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    age: integer("age"),
    spouseAge: integer("spouse_age"),
    profession: varchar("profession", { length: 150 }),
    spouseProfession: varchar("spouse_profession", { length: 150 }),

    // Logement
    housingZone: housingZoneEnum("housing_zone"),
    housingType: housingTypeEnum("housing_type"),
    gardenAreaM2: numeric("garden_area_m2", { precision: 8, scale: 2 }),
    fenceHeight: varchar("fence_height", { length: 120 }), // texte libre : hauteur ou "non clôturé"
    gardenAccessDetails: text("garden_access_details"), // accès jardin / mise en liberté pour NAC
    residencyStatus: residencyStatusEnum("residency_status"),
    residencyDuration: varchar("residency_duration", { length: 120 }),
    livingSituation: livingSituationEnum("living_situation"),

    // Foyer
    familySize: integer("family_size"),
    childrenCount: integer("children_count").default(0),
    hasAllergies: boolean("has_allergies").default(false),
    activityLevel: activityLevelEnum("activity_level"),
    familyAgrees: boolean("family_agrees").default(true).notNull(),
    familyDisagreementReason: text("family_disagreement_reason"),

    // Animaux déjà présents
    hasOtherAnimals: boolean("has_other_animals").default(false).notNull(),
    otherAnimalsDetails: text("other_animals_details"), // type / race / âge / stérilisé / dernier vaccin

    // Organisation du quotidien
    caretakerPerson: varchar("caretaker_person", { length: 200 }),
    sleepingArea: varchar("sleeping_area", { length: 200 }),
    aloneTimePerDay: aloneTimeEnum("alone_time_per_day"),
    dogWalksPerDay: integer("dog_walks_per_day"), // si adoption d'un chien
    dogMiddayWalkPossible: boolean("dog_midday_walk_possible"),
    vacationPlan: text("vacation_plan"), // weekends / vacances

    // Souhait d'adoption
    desiredSpecies: animalSpeciesEnum("desired_species"),
    specificAnimalName: varchar("specific_animal_name", { length: 120 }), // "coup de cœur"
    targetAnimalId: uuid("target_animal_id").references(() => animals.id, {
      onDelete: "set null",
    }),
    additionalComments: text("additional_comments"),

    status: adoptionApplicationStatusEnum("status").default("en_attente").notNull(),
    reviewNotes: text("review_notes"),

    // Captured for anti-spam auditing/rate-limiting — see submitAdoptionApplication.
    ipAddress: varchar("ip_address", { length: 45 }), // 45 = max IPv6 textual length

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("adoption_applications_organization_idx").on(table.organizationId),
    statusIdx: index("adoption_applications_status_idx").on(
      table.organizationId,
      table.status,
    ),
  }),
);

export const adoptionApplicationsRelations = relations(
  adoptionApplications,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [adoptionApplications.organizationId],
      references: [organizations.id],
    }),
    targetAnimal: one(animals, {
      fields: [adoptionApplications.targetAnimalId],
      references: [animals.id],
    }),
  }),
);

export type AdoptionApplication = typeof adoptionApplications.$inferSelect;
export type NewAdoptionApplication = typeof adoptionApplications.$inferInsert;
export type AdoptionApplicationStatus = (typeof adoptionApplicationStatusEnum.enumValues)[number];
export type HousingType = (typeof housingTypeEnum.enumValues)[number];
export type HousingZone = (typeof housingZoneEnum.enumValues)[number];
export type ResidencyStatus = (typeof residencyStatusEnum.enumValues)[number];
export type LivingSituation = (typeof livingSituationEnum.enumValues)[number];
export type ActivityLevel = (typeof activityLevelEnum.enumValues)[number];
export type AloneTime = (typeof aloneTimeEnum.enumValues)[number];
