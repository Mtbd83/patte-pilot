import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
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
  type ContractFieldPositions,
} from "../src/db/schema";
import { uploadDocument } from "../src/lib/uploads";

/**
 * La Patte Chanceuse's real, historical positions for contrat-adoption-template.pdf
 * — originally hardcoded in adoption-contract-pdf.ts, now seed data so specs
 * exercising the contract don't depend on the mapping tool having been used
 * by hand beforehand. See tests/unit/adoption-contract-pdf.test.ts for the
 * same values.
 */
const SEED_CONTRACT_POSITIONS: ContractFieldPositions = {
  nom: { page: 0, x: 55, y: 633.02 },
  dateNaissance: { page: 0, x: 432, y: 633.02 },
  icad: { page: 0, x: 150, y: 613.62 },
  pelage: { page: 0, x: 404, y: 613.62 },
  espece: { page: 0, x: 295, y: 559.72 },
  adopterName: { page: 0, x: 86, y: 520.62 },
  adopterAddress: { page: 0, x: 70, y: 501.22 },
  adopterPostalCode: { page: 0, x: 85, y: 471.92 },
  adopterCity: { page: 0, x: 338, y: 471.92 },
  adopterPhone1: { page: 0, x: 88, y: 447.42 },
  adopterPhone2: { page: 0, x: 378, y: 447.42 },
  adopterEmail: { page: 0, x: 90, y: 423.02 },
  vetFees: { page: 0, x: 360, y: 398.52, size: 9 },
  sterilizationFees: { page: 0, x: 254, y: 382.92, size: 9 },
  donationAmount: { page: 0, x: 102, y: 354.62, size: 9 },
  donationReason: { page: 0, x: 257, y: 354.62 },
  signaturePlace: { page: 0, x: 53, y: 305.82 },
  signatureDate: { page: 0, x: 281, y: 305.82 },
  sexeMaleBox: { page: 0, x: 202.15, y: 630.8 },
  sexeFemelleBox: { page: 0, x: 245.95, y: 631.6 },
  sterilizeOuiBox: { page: 0, x: 114.75, y: 582.66 },
  sterilizeNonBox: { page: 0, x: 157.65, y: 582.4 },
  santeOuiBox: { page: 0, x: 154.4, y: 558.45 },
  santeNonBox: { page: 0, x: 195.8, y: 558.15 },
};

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
  // Read by global-teardown.ts (same process for a single `npx playwright
  // test` invocation) so it only deletes rows created during *this* run —
  // anything that predates it (hand-seeded playground data, e.g.) is never
  // touched, regardless of which table it's in.
  process.env.E2E_RUN_STARTED_AT = new Date().toISOString();

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

  // sendEngagementCertificate now requires the org's own uploaded PDF (no
  // more bundled fallback file) — seed one so specs exercising it don't
  // depend on a certificate having been configured by hand beforehand.
  if (!org.certificateFileUrl) {
    const placeholderPath = path.join(process.cwd(), "public", "documents", "certificat-engagement.pdf");
    const bytes = await readFile(placeholderPath);
    const file = new File([new Uint8Array(bytes)], "certificat-engagement.pdf", {
      type: "application/pdf",
    });
    const certificateFileUrl = await uploadDocument(file, `documents/${org.id}/certificat-default`);
    [org] = await db
      .update(organizations)
      .set({ certificateFileUrl })
      .where(eq(organizations.id, org.id))
      .returning();
    if (!org) throw new Error("Seed failed: could not set the test org's certificate URL.");
  }

  // Same idea for the adoption contract — generateAdoptionContractPdf now
  // needs the org's own template + field positions instead of a bundled file.
  if (!org.contractTemplateUrl) {
    const templatePath = path.join(process.cwd(), "public", "documents", "contrat-adoption-template.pdf");
    const bytes = await readFile(templatePath);
    const file = new File([new Uint8Array(bytes)], "contrat-adoption-template.pdf", {
      type: "application/pdf",
    });
    const contractTemplateUrl = await uploadDocument(file, `documents/${org.id}/contrat`);
    [org] = await db
      .update(organizations)
      .set({ contractTemplateUrl, contractFieldPositions: SEED_CONTRACT_POSITIONS })
      .where(eq(organizations.id, org.id))
      .returning();
    if (!org) throw new Error("Seed failed: could not set the test org's contract template.");
  }

  await ensureMemberWithRole(org.id, ADMIN_EMAIL, ADMIN_PASSWORD, "admin");
  await ensureMemberWithRole(org.id, BENEVOLE_EMAIL, BENEVOLE_PASSWORD, "benevole");
  await ensureMemberWithRole(org.id, FAMILLE_ACCUEIL_EMAIL, FAMILLE_ACCUEIL_PASSWORD, "famille_accueil");

  // Remove any leftover invitee from a previous run so re-invitation works.
  const leftover = await db.query.users.findFirst({ where: eq(users.email, INVITEE_EMAIL) });
  if (leftover) {
    await db.delete(users).where(eq(users.id, leftover.id));
  }
}
