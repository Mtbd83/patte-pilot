import { pgTable, uuid, varchar, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { animals } from "./animals";
import { adoptionApplications } from "./adoption-applications";

export const documentTypeEnum = pgEnum("document_type", [
  "certificat_engagement",
  "contrat_adoption",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "genere",
  "envoye",
  "signe",
]);

/**
 * A generated PDF (engagement certificate or adoption contract) tracked end
 * to end: generation → email send via Gmail → (optionally) signature.
 * `fileUrl` points at the stored PDF (e.g. Vercel Blob / S3).
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    animalId: uuid("animal_id")
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    adoptionApplicationId: uuid("adoption_application_id").references(
      () => adoptionApplications.id,
      { onDelete: "set null" },
    ),

    type: documentTypeEnum("type").notNull(),
    status: documentStatusEnum("status").default("genere").notNull(),
    fileUrl: text("file_url"),

    sentToEmail: varchar("sent_to_email", { length: 255 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("documents_organization_idx").on(table.organizationId),
    animalIdx: index("documents_animal_idx").on(table.animalId),
  }),
);

export const documentsRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  animal: one(animals, {
    fields: [documents.animalId],
    references: [animals.id],
  }),
  adoptionApplication: one(adoptionApplications, {
    fields: [documents.adoptionApplicationId],
    references: [adoptionApplications.id],
  }),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
