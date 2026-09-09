import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
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

/**
 * A submitted adoption application. Only the identity/contact "tronc
 * commun" fields (always the same across every organization) are plain
 * columns — everything else is whatever the submitting organization's
 * `adoptionFormQuestionKeys`/`adoptionFormFreeQuestions` selection was at
 * submission time (see src/lib/adoption-question-bank.ts), stored in
 * `answers` keyed by question key ("libre_1"/"libre_2" for the two free
 * questions). Kept as one wide-ish table (rather than heavily normalized)
 * since a submission represents a single point-in-time record, not data
 * that's queried/updated piecemeal.
 */
export const adoptionApplications = pgTable(
  "adoption_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Identité du candidat — tronc commun, identique pour toutes les organisations.
    lastName: varchar("last_name", { length: 120 }).notNull(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    age: integer("age"),
    spouseAge: integer("spouse_age"),
    profession: varchar("profession", { length: 150 }),
    spouseProfession: varchar("spouse_profession", { length: 150 }),

    // Souhait d'adoption — tronc commun (pilote l'affichage conditionnel
    // ailleurs dans l'app, ex: la fiche animal ciblée).
    desiredSpecies: animalSpeciesEnum("desired_species"),
    specificAnimalName: varchar("specific_animal_name", { length: 120 }), // "coup de cœur"
    targetAnimalId: uuid("target_animal_id").references(() => animals.id, {
      onDelete: "set null",
    }),

    // Banque de questions + questions libres de l'organisation — voir
    // src/lib/adoption-question-bank.ts. Valeur = texte, ou tableau de
    // textes pour une question à choix multiple.
    answers: jsonb("answers").$type<Record<string, string | string[]>>().notNull().default({}),

    // Horodatage du consentement RGPD obligatoire ("j'accepte que mon
    // profil soit conservé pour être recontacté·e") — jamais facultatif,
    // jamais personnalisable par organisation.
    rgpdConsentAt: timestamp("rgpd_consent_at", { withTimezone: true }).notNull(),

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
