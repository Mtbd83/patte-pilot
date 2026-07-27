import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  organizations,
  animals,
  animalPlacements,
  animalHealthChecklists,
  fosterFamilies,
  accountingEntries,
  inventoryItems,
  adoptionApplications,
  documents,
  invitations,
  users,
} from "../src/db/schema";

const ORG_SLUG = "asso-test";
const INVITEE_EMAIL = "nouveau-benevole@example.com";

/**
 * Wipes everything the e2e specs create in "asso-test" (animals, foster
 * families, accounting/inventory rows, adoption applications, documents,
 * invitations) so the fixture org stays clean between runs — otherwise every
 * run leaves behind uniquely-suffixed test data (that's the whole point of
 * the suffixes, to avoid collisions *during* a run) that piles up forever in
 * a persistent dev database. Keeps the org itself and the admin membership,
 * which global-setup.ts depends on.
 */
export default async function globalTeardown() {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.slug, ORG_SLUG) });
  if (!org) return;

  const orgAnimals = await db.query.animals.findMany({ where: eq(animals.organizationId, org.id) });
  for (const animal of orgAnimals) {
    await db.delete(animalPlacements).where(eq(animalPlacements.animalId, animal.id));
    await db.delete(animalHealthChecklists).where(eq(animalHealthChecklists.animalId, animal.id));
  }

  await db.delete(documents).where(eq(documents.organizationId, org.id));
  await db.delete(adoptionApplications).where(eq(adoptionApplications.organizationId, org.id));
  await db.delete(animals).where(eq(animals.organizationId, org.id));
  await db.delete(fosterFamilies).where(eq(fosterFamilies.organizationId, org.id));
  await db.delete(accountingEntries).where(eq(accountingEntries.organizationId, org.id));
  await db.delete(inventoryItems).where(eq(inventoryItems.organizationId, org.id));
  await db.delete(invitations).where(eq(invitations.organizationId, org.id));

  const invitee = await db.query.users.findFirst({ where: eq(users.email, INVITEE_EMAIL) });
  if (invitee) {
    await db.delete(users).where(eq(users.id, invitee.id));
  }
}
