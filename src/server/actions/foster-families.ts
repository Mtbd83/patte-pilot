"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { animals, fosterFamilies } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdminOrPermission, requireRole, ForbiddenError } from "@/lib/permissions";

const createFosterFamilySchema = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  hasCats: z.boolean().default(false),
  hasDogs: z.boolean().default(false),
  hasRabbits: z.boolean().default(false),
  linkedUserId: z.string().uuid().optional(),
});

export type CreateFosterFamilyInput = z.input<typeof createFosterFamilySchema>;

/** Admin-only: registers a new foster family for the organization. */
export async function createFosterFamily(input: CreateFosterFamilyInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createFosterFamilySchema.parse(input);
  await requireAdminOrPermission(session.user.id, data.organizationId, "gestion_famille_accueil");

  const [fosterFamily] = await db.insert(fosterFamilies).values(data).returning();
  if (!fosterFamily) throw new Error("Échec de la création de la famille d'accueil.");
  return fosterFamily;
}

const updateFosterFamilySchema = z.object({
  fosterFamilyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  hasCats: z.boolean().optional(),
  hasDogs: z.boolean().optional(),
  hasRabbits: z.boolean().optional(),
  linkedUserId: z.string().uuid().nullable().optional(),
});

export type UpdateFosterFamilyInput = z.infer<typeof updateFosterFamilySchema>;

/** Admin-only: updates a foster family's details. */
export async function updateFosterFamily(input: UpdateFosterFamilyInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { fosterFamilyId, organizationId, ...rest } = updateFosterFamilySchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "gestion_famille_accueil");

  const fosterFamily = await db.query.fosterFamilies.findFirst({
    where: and(eq(fosterFamilies.id, fosterFamilyId), eq(fosterFamilies.organizationId, organizationId)),
  });
  if (!fosterFamily) throw new Error("Famille d'accueil introuvable.");

  const [updated] = await db
    .update(fosterFamilies)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(fosterFamilies.id, fosterFamilyId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de la famille d'accueil.");
  return updated;
}

const deactivateFosterFamilySchema = z.object({
  fosterFamilyId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/**
 * Admin-only: deactivates a foster family. Refuses if an animal is
 * currently hosted there — reassign or close that placement first.
 */
export async function deactivateFosterFamily(
  input: z.infer<typeof deactivateFosterFamilySchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { fosterFamilyId, organizationId } = deactivateFosterFamilySchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "gestion_famille_accueil");

  const fosterFamily = await db.query.fosterFamilies.findFirst({
    where: and(eq(fosterFamilies.id, fosterFamilyId), eq(fosterFamilies.organizationId, organizationId)),
  });
  if (!fosterFamily) throw new Error("Famille d'accueil introuvable.");

  const hostedAnimal = await db.query.animals.findFirst({
    where: eq(animals.currentFosterFamilyId, fosterFamilyId),
  });
  if (hostedAnimal) {
    throw new Error(
      "Impossible de désactiver cette famille d'accueil : un animal y est actuellement hébergé.",
    );
  }

  const [updated] = await db
    .update(fosterFamilies)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(fosterFamilies.id, fosterFamilyId))
    .returning();
  if (!updated) throw new Error("Échec de la désactivation.");
  return updated;
}

const listFosterFamiliesSchema = z.object({
  organizationId: z.string().uuid(),
  includeInactive: z.boolean().default(false),
});

/** Any member (admin, bénévole or famille d'accueil): lists an organization's foster families. */
export async function listFosterFamilies(input: z.input<typeof listFosterFamiliesSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, includeInactive } = listFosterFamiliesSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  return db.query.fosterFamilies.findMany({
    where: includeInactive
      ? eq(fosterFamilies.organizationId, organizationId)
      : and(eq(fosterFamilies.organizationId, organizationId), eq(fosterFamilies.isActive, true)),
  });
}
