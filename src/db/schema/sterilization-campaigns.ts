import { pgTable, pgEnum, uuid, varchar, integer, date, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations, organizationMembers } from "./organizations";
import { animalSexEnum } from "./animals";

/** The organization granting the vouchers for a campaign. */
export const sterilizationPartnerEnum = pgEnum("sterilization_partner", [
  "spa",
  "fondation_brigitte_bardot",
  "trente_millions_damis",
  "autre",
]);

/**
 * A batch of sterilization vouchers ("bons") granted by a partner for a
 * given city, to be used at a given veterinarian — "Campagne de
 * stérilisation Chat Libre", an opt-in module (see
 * organizations.sterilizationCampaignModuleEnabled). `voucherQuotaTotal` is
 * a target for planning purposes only — the vouchers actually logged live
 * in `sterilizationVouchers` below and aren't capped at this number.
 *
 * The vet is stored as plain fields, not a link to the Vétérinaires tab's
 * partner-vet list: a campaign's vet is often not one of the association's
 * general partner vets, so requiring one to exist there first would be a
 * false constraint. The campaign form still offers picking a partner vet as
 * a one-off convenience to prefill these fields.
 */
export const sterilizationCampaigns = pgTable(
  "sterilization_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    city: varchar("city", { length: 120 }).notNull(),
    partner: sterilizationPartnerEnum("partner").notNull(),
    vetName: varchar("vet_name", { length: 200 }).notNull(),
    vetAddress: text("vet_address"),
    vetPhone: varchar("vet_phone", { length: 30 }),

    voucherQuotaTotal: integer("voucher_quota_total").notNull(),
    voucherQuotaMale: integer("voucher_quota_male"),
    voucherQuotaFemale: integer("voucher_quota_female"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("sterilization_campaigns_organization_idx").on(table.organizationId),
  }),
);

/**
 * One physical voucher ("bon") logged against a campaign, filled in as the
 * association performs each sterilization. `sex` reuses `animalSexEnum` for
 * schema consistency but is restricted to male/femelle (never "inconnu") at
 * the Zod layer — a bon is only logged once the cat's sex is known.
 */
export const sterilizationVouchers = pgTable(
  "sterilization_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => sterilizationCampaigns.id, { onDelete: "cascade" }),

    voucherNumber: varchar("voucher_number", { length: 60 }).notNull(),
    identificationNumber: varchar("identification_number", { length: 60 }).notNull(),
    date: date("date").notNull(),
    sex: animalSexEnum("sex").notNull(),
    photoUrl: text("photo_url"),
    comment: text("comment"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("sterilization_vouchers_campaign_idx").on(table.campaignId),
  }),
);

/**
 * Per-campaign scoping for the "campagne_sterilisation" bénévole permission:
 * holding the permission alone only unlocks the tab — a bénévole (never an
 * admin, who always sees everything) additionally needs a row here for a
 * given campaign to see or work on it specifically.
 */
export const sterilizationCampaignVolunteers = pgTable(
  "sterilization_campaign_volunteers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => sterilizationCampaigns.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqCampaignMember: uniqueIndex("uniq_campaign_volunteer").on(table.campaignId, table.memberId),
  }),
);

export type SterilizationCampaign = typeof sterilizationCampaigns.$inferSelect;
export type NewSterilizationCampaign = typeof sterilizationCampaigns.$inferInsert;
export type SterilizationVoucher = typeof sterilizationVouchers.$inferSelect;
export type NewSterilizationVoucher = typeof sterilizationVouchers.$inferInsert;
export type SterilizationPartner = (typeof sterilizationPartnerEnum.enumValues)[number];
