import "dotenv/config";
import { and, eq, gte } from "drizzle-orm";
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

// Fixture accounts global-setup.ts ensures on every run — never swept, no
// matter when their row happens to say they were created (e.g. the very
// first run ever, when they're created fresh and would otherwise look
// exactly like test-created data).
const FIXTURE_EMAILS = new Set([
  "admin@example.com",
  "benevole-test@example.com",
  "famille-accueil-test@example.com",
]);

/**
 * Wipes only what THIS run's e2e specs created in "asso-test" (animals,
 * foster families, accounting/inventory rows, adoption applications,
 * documents, invitations) plus any stray user account a spec created
 * (invitees, signups) — identified by `createdAt >= E2E_RUN_STARTED_AT`
 * (set by global-setup.ts at the very start of this same process), not by
 * table membership alone. Anything that predates this run — hand-seeded
 * playground data, e.g. — is left untouched regardless of which table it's
 * in. Keeps the org itself and the fixture memberships, which
 * global-setup.ts depends on.
 */
export default async function globalTeardown() {
  const watermark = process.env.E2E_RUN_STARTED_AT;
  if (!watermark) {
    console.warn(
      "[global-teardown] E2E_RUN_STARTED_AT is unset — skipping cleanup rather than risk wiping non-test data.",
    );
    return;
  }
  const since = new Date(watermark);

  const org = await db.query.organizations.findFirst({ where: eq(organizations.slug, ORG_SLUG) });
  if (org) {
    const orgAnimals = await db.query.animals.findMany({
      where: and(eq(animals.organizationId, org.id), gte(animals.createdAt, since)),
    });
    for (const animal of orgAnimals) {
      await db.delete(animalPlacements).where(eq(animalPlacements.animalId, animal.id));
      await db.delete(animalHealthChecklists).where(eq(animalHealthChecklists.animalId, animal.id));
    }

    await db
      .delete(documents)
      .where(and(eq(documents.organizationId, org.id), gte(documents.createdAt, since)));
    await db
      .delete(adoptionApplications)
      .where(and(eq(adoptionApplications.organizationId, org.id), gte(adoptionApplications.createdAt, since)));
    await db
      .delete(animals)
      .where(and(eq(animals.organizationId, org.id), gte(animals.createdAt, since)));
    await db
      .delete(fosterFamilies)
      .where(and(eq(fosterFamilies.organizationId, org.id), gte(fosterFamilies.createdAt, since)));
    await db
      .delete(accountingEntries)
      .where(and(eq(accountingEntries.organizationId, org.id), gte(accountingEntries.createdAt, since)));
    await db
      .delete(inventoryItems)
      .where(and(eq(inventoryItems.organizationId, org.id), gte(inventoryItems.createdAt, since)));
    await db
      .delete(invitations)
      .where(and(eq(invitations.organizationId, org.id), gte(invitations.createdAt, since)));
  }

  // Covers ad hoc users created directly through the invite/signup UI
  // (mdp-test-*/suppr-test-*/nouveau-benevole@example.com...) that specs
  // don't always clean up themselves — anything new since this run started,
  // except the fixed seed accounts.
  const recentUsers = await db.query.users.findMany({ where: gte(users.createdAt, since) });
  for (const user of recentUsers) {
    if (FIXTURE_EMAILS.has(user.email)) continue;
    await db.delete(users).where(eq(users.id, user.id));
  }
}
