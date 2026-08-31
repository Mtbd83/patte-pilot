import { relations } from "drizzle-orm";
import {
  organizations,
  users,
  organizationMembers,
  invitations,
  organizationHelloAssoLinks,
  organizationSignupRequests,
} from "./organizations";
import { animals, animalHealthChecklists } from "./animals";
import { fosterFamilies } from "./foster-families";
import { animalPlacements } from "./animal-placements";
import { adoptionApplications } from "./adoption-applications";
import { accountingEntries } from "./accounting";
import { inventoryItems } from "./inventory";
import { events } from "./events";
import { documents } from "./documents";
import { pushSubscriptions } from "./push-subscriptions";
import { supplyRequests } from "./supply-requests";
import { veterinarians, veterinarianTariffs } from "./veterinarians";
import {
  sterilizationCampaigns,
  sterilizationVouchers,
  sterilizationCampaignVolunteers,
} from "./sterilization-campaigns";

export * from "./organizations";
export * from "./animals";
export * from "./foster-families";
export * from "./animal-placements";
export * from "./adoption-applications";
export * from "./accounting";
export * from "./inventory";
export * from "./events";
export * from "./documents";
export * from "./push-subscriptions";
export * from "./supply-requests";
export * from "./veterinarians";
export * from "./sterilization-campaigns";

// ---------------------------------------------------------------------------
// All relations() calls live here, one per table, so a table's relations
// are never split across two files (Drizzle only supports a single
// `relations()` definition per table). Domain files above only declare the
// tables themselves.
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  fosterFamilyProfiles: many(fosterFamilies),
  pushSubscriptions: many(pushSubscriptions),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  invitations: many(invitations),
  animals: many(animals),
  fosterFamilies: many(fosterFamilies),
  adoptionApplications: many(adoptionApplications),
  accountingEntries: many(accountingEntries),
  inventoryItems: many(inventoryItems),
  events: many(events),
  documents: many(documents),
  helloAssoLinks: many(organizationHelloAssoLinks),
  supplyRequests: many(supplyRequests),
  veterinarians: many(veterinarians),
  sterilizationCampaigns: many(sterilizationCampaigns),
}));

export const organizationHelloAssoLinksRelations = relations(
  organizationHelloAssoLinks,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationHelloAssoLinks.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationSignupRequestsRelations = relations(
  organizationSignupRequests,
  ({ one }) => ({
    createdOrganization: one(organizations, {
      fields: [organizationSignupRequests.createdOrganizationId],
      references: [organizations.id],
    }),
  }),
);

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const animalsRelations = relations(animals, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [animals.organizationId],
    references: [organizations.id],
  }),
  currentFosterFamily: one(fosterFamilies, {
    fields: [animals.currentFosterFamilyId],
    references: [fosterFamilies.id],
  }),
  healthChecklist: one(animalHealthChecklists, {
    fields: [animals.id],
    references: [animalHealthChecklists.animalId],
  }),
  placements: many(animalPlacements),
  adoptionApplications: many(adoptionApplications),
  accountingEntries: many(accountingEntries),
  documents: many(documents),
}));

export const fosterFamiliesRelations = relations(fosterFamilies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [fosterFamilies.organizationId],
    references: [organizations.id],
  }),
  linkedUser: one(users, {
    fields: [fosterFamilies.linkedUserId],
    references: [users.id],
  }),
  placements: many(animalPlacements),
  animalsHosted: many(animals),
  supplyRequests: many(supplyRequests),
}));

export const supplyRequestsRelations = relations(supplyRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [supplyRequests.organizationId],
    references: [organizations.id],
  }),
  fosterFamily: one(fosterFamilies, {
    fields: [supplyRequests.fosterFamilyId],
    references: [fosterFamilies.id],
  }),
}));

export const veterinariansRelations = relations(veterinarians, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [veterinarians.organizationId],
    references: [organizations.id],
  }),
  tariffs: many(veterinarianTariffs),
}));

export const veterinarianTariffsRelations = relations(veterinarianTariffs, ({ one }) => ({
  veterinarian: one(veterinarians, {
    fields: [veterinarianTariffs.veterinarianId],
    references: [veterinarians.id],
  }),
}));

export const sterilizationCampaignsRelations = relations(sterilizationCampaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sterilizationCampaigns.organizationId],
    references: [organizations.id],
  }),
  vouchers: many(sterilizationVouchers),
  volunteers: many(sterilizationCampaignVolunteers),
}));

export const sterilizationVouchersRelations = relations(sterilizationVouchers, ({ one }) => ({
  campaign: one(sterilizationCampaigns, {
    fields: [sterilizationVouchers.campaignId],
    references: [sterilizationCampaigns.id],
  }),
}));

export const sterilizationCampaignVolunteersRelations = relations(
  sterilizationCampaignVolunteers,
  ({ one }) => ({
    campaign: one(sterilizationCampaigns, {
      fields: [sterilizationCampaignVolunteers.campaignId],
      references: [sterilizationCampaigns.id],
    }),
    member: one(organizationMembers, {
      fields: [sterilizationCampaignVolunteers.memberId],
      references: [organizationMembers.id],
    }),
  }),
);
