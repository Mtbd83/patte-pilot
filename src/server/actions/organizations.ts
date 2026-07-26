"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";

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

const updateOrganizationProfileSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(200).optional(),
  contactEmail: z.string().email().optional(),
  siren: z.string().max(20).optional(),
  registrationAuthority: z.string().max(200).optional(),
  registrationNumber: z.string().max(50).optional(),
  address: z.string().optional(),
  postalCode: z.string().max(10).optional(),
  city: z.string().max(120).optional(),
  phone1: z.string().max(30).optional(),
  phone2: z.string().max(30).optional(),
});

export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;

/**
 * Admin-only: updates the organization's profile, including the legal
 * letterhead details (SIREN, préfecture registration, address, phones)
 * used when generating adoption contracts.
 */
export async function updateOrganizationProfile(input: UpdateOrganizationProfileInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, ...rest } = updateOrganizationProfileSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const [updated] = await db
    .update(organizations)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du profil de l'organisation.");
  return updated;
}
