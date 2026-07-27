import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./organizations";

export const eventTypeEnum = pgEnum("event_type", [
  "journee_adoption",
  "collecte",
  "benevolat",
  "autre",
]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    type: eventTypeEnum("type").default("autre").notNull(),
    location: varchar("location", { length: 200 }),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),

    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("events_organization_idx").on(table.organizationId),
    startAtIdx: index("events_start_at_idx").on(table.organizationId, table.startAt),
  }),
);

export const eventsRelations = relations(events, ({ one }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [events.createdByUserId],
    references: [users.id],
  }),
}));

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
