import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { animals } from "./animals";
import { fosterFamilies } from "./foster-families";

/**
 * Full history of which foster family hosted which animal, and when.
 * `animals.currentFosterFamilyId` is a denormalized pointer to the *current*
 * open placement (endedAt IS NULL) for fast lookups; this table is the
 * source of truth for the timeline.
 */
export const animalPlacements = pgTable(
  "animal_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    animalId: uuid("animal_id")
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    fosterFamilyId: uuid("foster_family_id")
      .notNull()
      .references(() => fosterFamilies.id, { onDelete: "cascade" }),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }), // null = placement en cours
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    animalIdx: index("animal_placements_animal_idx").on(table.animalId),
    fosterFamilyIdx: index("animal_placements_foster_family_idx").on(
      table.fosterFamilyId,
    ),
  }),
);

export const animalPlacementsRelations = relations(animalPlacements, ({ one }) => ({
  animal: one(animals, {
    fields: [animalPlacements.animalId],
    references: [animals.id],
  }),
  fosterFamily: one(fosterFamilies, {
    fields: [animalPlacements.fosterFamilyId],
    references: [fosterFamilies.id],
  }),
}));

export type AnimalPlacement = typeof animalPlacements.$inferSelect;
