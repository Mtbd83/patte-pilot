import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers, organizations } from "@/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Organizations are addressed by slug in most links (/organisations/asso-test)
 * but invitation acceptance redirects by id. Accept either.
 */
export async function findOrganizationByIdentifier(identifier: string) {
  return db.query.organizations.findFirst({
    where: UUID_RE.test(identifier)
      ? eq(organizations.id, identifier)
      : eq(organizations.slug, identifier),
  });
}

/** The organizations a user belongs to, used to route them after login. */
export async function listOrganizationsForUser(userId: string) {
  const memberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
    with: { organization: true },
  });
  return memberships.map((membership) => membership.organization);
}
