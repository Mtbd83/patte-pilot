import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";

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
