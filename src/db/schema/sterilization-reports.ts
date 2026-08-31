import { pgTable, pgEnum, uuid, varchar, text, doublePrecision, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { animalSexEnum } from "./animals";

export const sterilizationNeedEnum = pgEnum("sterilization_need", ["oui", "non", "ne_sait_pas"]);

/** Set by the public reporter at creation — what kind of sighting this is. */
export const reportFinderStatusEnum = pgEnum("report_finder_status", ["trouve", "perdu", "errant"]);

/** Set by the association afterwards — the report's own handling workflow. */
export const reportManagementStatusEnum = pgEnum("report_management_status", [
  "en_cours",
  "pris_en_compte",
  "ferme",
  "archive",
]);

/** One vertex of a reporting map's boundary polygon, in order. */
export interface BoundaryPoint {
  latitude: number;
  longitude: number;
}

/**
 * One city-wide public map for reporting stray cats — deliberately NOT
 * linked to a sterilization campaign (several campaigns can exist for the
 * same city over time, but reports should keep flowing independently of
 * any one of them). One per city per organization, shared via `publicToken`
 * — a durable public tool, so unlike an invitation token this one never
 * expires.
 */
export const sterilizationReportingMaps = pgTable(
  "sterilization_reporting_maps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    city: varchar("city", { length: 120 }).notNull(),
    publicToken: varchar("public_token", { length: 64 }).notNull().unique(),
    // Drawn by the admin at creation (a polygon, ≥3 points) rather than
    // derived from OSM/Nominatim data — a fixed-radius circle around a
    // geocoded center was tried first and rejected: too small for a big
    // city, way too large for a small commune (bleeds into neighboring
    // villages), and real OSM administrative boundaries aren't reliably
    // available for every small place either. Letting the admin, who knows
    // their own area, trace it by hand sidesteps both problems.
    boundary: jsonb("boundary").$type<BoundaryPoint[]>().notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgCity: uniqueIndex("uniq_reporting_map_org_city").on(table.organizationId, table.city),
  }),
);

/**
 * A single stray-cat sighting reported by the public on a reporting map's
 * shared link. `finderStatus` is the reporter's own classification, set
 * once at creation; `managementStatus` is the association's independent
 * workflow status, defaulting to "en_cours" and changed only from the
 * authenticated side. `reporterIp` is for rate-limiting only — never
 * returned to any caller, public or authenticated.
 */
export const sterilizationReports = pgTable(
  "sterilization_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => sterilizationReportingMaps.id, { onDelete: "cascade" }),

    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    photoUrl: text("photo_url").notNull(),
    sex: animalSexEnum("sex").notNull(),
    needsSterilization: sterilizationNeedEnum("needs_sterilization").notNull(),
    finderStatus: reportFinderStatusEnum("finder_status").notNull(),
    managementStatus: reportManagementStatusEnum("management_status").default("en_cours").notNull(),
    description: text("description"),
    reporterIp: varchar("reporter_ip", { length: 64 }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    mapIdx: index("sterilization_reports_map_idx").on(table.mapId),
  }),
);

/** A public comment on a report — e.g. "c'est le mien" / "pas le mien". No auth, no account needed. */
export const sterilizationReportComments = pgTable(
  "sterilization_report_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => sterilizationReports.id, { onDelete: "cascade" }),

    authorName: varchar("author_name", { length: 120 }).notNull(),
    text: text("text").notNull(),
    reporterIp: varchar("reporter_ip", { length: 64 }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    reportIdx: index("sterilization_report_comments_report_idx").on(table.reportId),
  }),
);

export type SterilizationReportingMap = typeof sterilizationReportingMaps.$inferSelect;
export type SterilizationReport = typeof sterilizationReports.$inferSelect;
export type SterilizationReportComment = typeof sterilizationReportComments.$inferSelect;
export type SterilizationNeed = (typeof sterilizationNeedEnum.enumValues)[number];
export type ReportFinderStatus = (typeof reportFinderStatusEnum.enumValues)[number];
export type ReportManagementStatus = (typeof reportManagementStatusEnum.enumValues)[number];
