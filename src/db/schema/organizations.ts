import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * A member's role within a single organization.
 * A member can hold multiple roles at once (e.g. "benevole" + "famille_accueil"),
 * so roles are stored as separate rows in `organizationMemberRoles`, not as a
 * single enum column on the membership.
 */
export const orgRoleEnum = pgEnum("org_role", [
  "admin",
  "benevole",
  "famille_accueil",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

// ---------------------------------------------------------------------------
// Core identity
// ---------------------------------------------------------------------------

/** A global user account. One user can belong to several organizations. */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"), // null if the user only ever signs in via invitation/magic link
  firstName: varchar("first_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }),
  phone: varchar("phone", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** An association / rescue organization using the platform. */
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  contactEmail: varchar("contact_email", { length: 255 }),
  logoUrl: text("logo_url"),

  // Engagement certificate PDFs, uploaded per organization (sent as-is, no
  // filling — see sendEngagementCertificate). `certificateFileUrl` covers
  // chat/lapin/autre; `certificateFileUrlChien` optionally overrides it for
  // chien. Falls back to nothing — an org without either configured gets a
  // clear "configure it" error rather than silently sending someone else's
  // document.
  certificateFileUrl: text("certificate_file_url"),
  certificateFileUrlChien: text("certificate_file_url_chien"),

  // Outgoing email identity: each organization sends through its own mailbox
  // (typically Gmail + an app password) so recipients only ever see that
  // organization's own address, never a shared/platform one. Emails fail
  // with a clear error if these aren't set — no silent fallback.
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpAppPassword: text("smtp_app_password"),

  // Legal/letterhead details used on generated documents (adoption contract).
  siren: varchar("siren", { length: 20 }),
  registrationAuthority: varchar("registration_authority", { length: 200 }), // ex: "sous-préfecture du Var"
  registrationNumber: varchar("registration_number", { length: 50 }), // ex: "W832021610"
  address: text("address"),
  postalCode: varchar("postal_code", { length: 10 }),
  city: varchar("city", { length: 120 }),
  phone1: varchar("phone1", { length: 30 }),
  phone2: varchar("phone2", { length: 30 }),

  // Payment details filled into the adoption contract email (IBAN/treasurer
  // name go straight into the {{iban}}/{{tresoriere}} tokens below).
  iban: varchar("iban", { length: 34 }),
  treasurerName: varchar("treasurer_name", { length: 200 }),

  // Editable email templates (see src/lib/email-templates.ts for the token
  // syntax and the fallback text used while these are unset).
  certificateEmailSubject: text("certificate_email_subject"),
  certificateEmailBody: text("certificate_email_body"),
  contractEmailSubject: text("contract_email_subject"),
  contractEmailBody: text("contract_email_body"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Named HelloAsso payment links (e.g. "Chaton vaccin complet", "Frais
 * réduit") an admin maintains freely — no fixed set of categories, since
 * they vary per association and change over time. Picked manually from a
 * dropdown when composing the adoption contract email; never auto-selected.
 */
export const organizationHelloAssoLinks = pgTable("organization_helloasso_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 120 }).notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Membership of a user inside an organization (without the role detail). */
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // A user can only have one membership row per organization; roles are
    // layered on top via organizationMemberRoles.
    uniqUserOrg: uniqueIndex("uniq_user_org").on(table.organizationId, table.userId),
  }),
);

/** The (possibly multiple) roles a member holds within their organization. */
export const organizationMemberRoles = pgTable(
  "organization_member_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull(),
  },
  (table) => ({
    uniqMemberRole: uniqueIndex("uniq_member_role").on(table.memberId, table.role),
  }),
);

/**
 * A pending or resolved invitation for someone to join an organization with
 * a given set of roles. Sent by an admin via email (Nodemailer).
 */
export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  roles: orgRoleEnum("roles").array().notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  status: invitationStatusEnum("status").default("pending").notNull(),
  // Nullable + set-null on delete: the invite record (who was invited, with
  // which roles) stays valid history even after the inviting admin's own
  // account is deleted.
  invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

// Note: `users` and `organizations` relations are declared in ./index.ts,
// consolidated with the cross-domain tables (animals, foster families, ...)
// so each table has exactly one `relations()` definition.

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
    roles: many(organizationMemberRoles),
  }),
);

export const organizationMemberRolesRelations = relations(
  organizationMemberRoles,
  ({ one }) => ({
    member: one(organizationMembers, {
      fields: [organizationMemberRoles.memberId],
      references: [organizationMembers.id],
    }),
  }),
);

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedByUserId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type OrganizationMemberRole = typeof organizationMemberRoles.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type OrgRole = (typeof orgRoleEnum.enumValues)[number];
export type OrganizationHelloAssoLink = typeof organizationHelloAssoLinks.$inferSelect;
