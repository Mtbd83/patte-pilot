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
} from "../src/db/schema";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Password123!";
const ORG_NAME = "Asso Test";
const ORG_SLUG = "asso-test";
const INVITEE_EMAIL = "nouveau-benevole@example.com";

/**
 * Seeds the fixtures assumed by e2e/invite-flow.spec.ts: an admin account
 * already a member of "Asso Test", and a clean slate for the invitee so the
 * test can re-run against a persistent dev database.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";

  // The dev server may already be running (e.g. left open in another
  // terminal), in which case it never saw ENABLE_TEST_MAIL_SINK at startup.
  // Flip the sink on at runtime instead of relying on how it was launched.
  await fetch(`${baseURL}/api/test/enable-mail-sink`, { method: "POST" });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let admin = await db.query.users.findFirst({ where: eq(users.email, ADMIN_EMAIL) });
  if (!admin) {
    [admin] = await db.insert(users).values({ email: ADMIN_EMAIL, passwordHash }).returning();
  } else {
    await db.update(users).set({ passwordHash }).where(eq(users.id, admin.id));
  }
  if (!admin) throw new Error("Seed failed: could not create admin user.");

  let org = await db.query.organizations.findFirst({ where: eq(organizations.slug, ORG_SLUG) });
  if (!org) {
    [org] = await db.insert(organizations).values({ name: ORG_NAME, slug: ORG_SLUG }).returning();
  }
  if (!org) throw new Error("Seed failed: could not create organization.");

  let member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, org.id),
      eq(organizationMembers.userId, admin.id),
    ),
  });
  if (!member) {
    [member] = await db
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId: admin.id })
      .returning();
  }
  if (!member) throw new Error("Seed failed: could not create membership.");

  await db
    .insert(organizationMemberRoles)
    .values({ memberId: member.id, role: "admin" })
    .onConflictDoNothing();

  // Remove any leftover invitee from a previous run so re-invitation works.
  const leftover = await db.query.users.findFirst({ where: eq(users.email, INVITEE_EMAIL) });
  if (leftover) {
    await db.delete(users).where(eq(users.id, leftover.id));
  }
}
