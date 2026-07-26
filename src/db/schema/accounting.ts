import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  pgEnum,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./organizations";
import { animals } from "./animals";

export const accountingTypeEnum = pgEnum("accounting_type", ["entree", "sortie"]);

export const accountingCategoryEnum = pgEnum("accounting_category", [
  "nourriture",
  "veterinaire",
  "equipement",
  "autre",
]);

export const accountingEntries = pgTable(
  "accounting_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    date: date("date").notNull(),
    type: accountingTypeEnum("type").notNull(),
    category: accountingCategoryEnum("category").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),

    // Dépense/recette liée à un animal en particulier (frais vétérinaires, don fléché...).
    animalId: uuid("animal_id").references(() => animals.id, { onDelete: "set null" }),
    comment: text("comment"),

    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("accounting_entries_organization_idx").on(table.organizationId),
    dateIdx: index("accounting_entries_date_idx").on(table.organizationId, table.date),
  }),
);

export const accountingEntriesRelations = relations(accountingEntries, ({ one }) => ({
  organization: one(organizations, {
    fields: [accountingEntries.organizationId],
    references: [organizations.id],
  }),
  animal: one(animals, {
    fields: [accountingEntries.animalId],
    references: [animals.id],
  }),
  createdBy: one(users, {
    fields: [accountingEntries.createdByUserId],
    references: [users.id],
  }),
}));

export type AccountingEntry = typeof accountingEntries.$inferSelect;
export type NewAccountingEntry = typeof accountingEntries.$inferInsert;
