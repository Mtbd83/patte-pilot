import "dotenv/config";
import type { FullConfig } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import {
  users,
  organizations,
  organizationMembers,
  organizationMemberRoles,
  type OrgRole,
} from "../src/db/schema";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Password123!";
const ORG_NAME = "Asso Test";
const ORG_SLUG = "asso-test";
const INVITEE_EMAIL = "nouveau-benevole@example.com";
const BENEVOLE_EMAIL = "benevole-test@example.com";
const BENEVOLE_PASSWORD = "Benevole123!";
const FAMILLE_ACCUEIL_EMAIL = "famille-accueil-test@example.com";
const FAMILLE_ACCUEIL_PASSWORD = "FamilleAccueil123!";

/**
 * Upserts a user, makes them an active member of the given org, and grants
 * them the given role — idempotent, so it's safe to re-run against a
 * persistent dev database.
 */
async function ensureMemberWithRole(
  orgId: string,
  email: string,
  password: string,
  role: OrgRole,
) {
  const passwordHash = await bcrypt.hash(password, 10);

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    [user] = await db.insert(users).values({ email, passwordHash }).returning();
  } else {
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  }
  if (!user) throw new Error(`Seed failed: could not create user ${email}.`);

  let member = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, user.id)),
  });
  if (!member) {
    [member] = await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: user.id })
      .returning();
  }
  if (!member) throw new Error(`Seed failed: could not create membership for ${email}.`);

  await db
    .insert(organizationMemberRoles)
    .values({ memberId: member.id, role })
    .onConflictDoNothing();

  return user;
}

/**
 * Seeds the fixtures assumed by the e2e specs: an admin, a bénévole and a
 * famille d'accueil test account, all members of "Asso Test", plus a clean
 * slate for the invite-flow invitee so that test can re-run against a
 * persistent dev database.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";

  // The dev server may already be running (e.g. left open in another
  // terminal), in which case it never saw ENABLE_TEST_MAIL_SINK at startup.
  // Flip the sink on at runtime instead of relying on how it was launched.
  await fetch(`${baseURL}/api/test/enable-mail-sink`, { method: "POST" });

  let org = await db.query.organizations.findFirst({ where: eq(organizations.slug, ORG_SLUG) });
  if (!org) {
    [org] = await db.insert(organizations).values({ name: ORG_NAME, slug: ORG_SLUG }).returning();
  }
  if (!org) throw new Error("Seed failed: could not create organization.");

  await ensureMemberWithRole(org.id, ADMIN_EMAIL, ADMIN_PASSWORD, "admin");
  await ensureMemberWithRole(org.id, BENEVOLE_EMAIL, BENEVOLE_PASSWORD, "benevole");
  await ensureMemberWithRole(org.id, FAMILLE_ACCUEIL_EMAIL, FAMILLE_ACCUEIL_PASSWORD, "famille_accueil");

  // Remove any leftover invitee from a previous run so re-invitation works.
  const leftover = await db.query.users.findFirst({ where: eq(users.email, INVITEE_EMAIL) });
  if (leftover) {
    await db.delete(users).where(eq(users.id, leftover.id));
  }
}
