"use server";

import { z } from "zod";
import { db } from "@/db";
import { organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Le slug ne doit contenir que des lettres minuscules, chiffres et tirets."),
  contactEmail: z.string().email().optional(),
});

/** Creates a new organization and makes the current user its admin. */
export async function createOrganization(
  input: z.infer<typeof createOrganizationSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createOrganizationSchema.parse(input);

  const userId = session.user.id;

  return db.transaction(async (tx) => {
    const [organization] = await tx.insert(organizations).values(data).returning();
    if (!organization) throw new Error("Échec de la création de l'organisation.");

    const [member] = await tx
      .insert(organizationMembers)
      .values({ organizationId: organization.id, userId })
      .returning();
    if (!member) throw new Error("Échec de la création du membre administrateur.");

    await tx.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });

    return organization;
  });
}
