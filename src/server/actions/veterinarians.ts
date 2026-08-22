"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, veterinarians, veterinarianTariffs } from "@/db/schema";
import { animalSpeciesEnum, animalSexEnum } from "@/db/schema/animals";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, ForbiddenError } from "@/lib/permissions";
import { geocodeAddress } from "@/lib/geocoding";

const addressFields = {
  address: z.string().optional(),
  postalCode: z.string().max(10).optional(),
  city: z.string().max(120).optional(),
};

const createVeterinarianSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(200),
  ...addressFields,
  phone: z.string().max(30).optional(),
  notes: z.string().optional(),
});

export type CreateVeterinarianInput = z.infer<typeof createVeterinarianSchema>;

/** Admin-only: registers a new partner veterinarian, geocoding its address if given. */
export async function createVeterinarian(input: CreateVeterinarianInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createVeterinarianSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const coords = await geocodeAddress(data);

  const [veterinarian] = await db
    .insert(veterinarians)
    .values({ ...data, latitude: coords?.latitude, longitude: coords?.longitude })
    .returning();
  if (!veterinarian) throw new Error("Échec de la création du vétérinaire.");
  return veterinarian;
}

const updateVeterinarianSchema = z.object({
  veterinarianId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  ...addressFields,
  phone: z.string().max(30).optional(),
  notes: z.string().optional(),
});

export type UpdateVeterinarianInput = z.infer<typeof updateVeterinarianSchema>;

/** Admin-only: updates a veterinarian's details, re-geocoding when the address changed. */
export async function updateVeterinarian(input: UpdateVeterinarianInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { veterinarianId, organizationId, ...rest } = updateVeterinarianSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const veterinarian = await db.query.veterinarians.findFirst({
    where: and(eq(veterinarians.id, veterinarianId), eq(veterinarians.organizationId, organizationId)),
  });
  if (!veterinarian) throw new Error("Vétérinaire introuvable.");

  const addressChanged =
    (rest.address !== undefined && rest.address !== veterinarian.address) ||
    (rest.postalCode !== undefined && rest.postalCode !== veterinarian.postalCode) ||
    (rest.city !== undefined && rest.city !== veterinarian.city);

  const coords = addressChanged
    ? await geocodeAddress({
        address: rest.address ?? veterinarian.address,
        postalCode: rest.postalCode ?? veterinarian.postalCode,
        city: rest.city ?? veterinarian.city,
      })
    : null;

  const [updated] = await db
    .update(veterinarians)
    .set({
      ...rest,
      ...(addressChanged ? { latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(veterinarians.id, veterinarianId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du vétérinaire.");
  return updated;
}

const deleteVeterinarianSchema = z.object({
  veterinarianId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: removes a veterinarian (its tariffs cascade). */
export async function deleteVeterinarian(input: z.infer<typeof deleteVeterinarianSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { veterinarianId, organizationId } = deleteVeterinarianSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const veterinarian = await db.query.veterinarians.findFirst({
    where: and(eq(veterinarians.id, veterinarianId), eq(veterinarians.organizationId, organizationId)),
  });
  if (!veterinarian) throw new Error("Vétérinaire introuvable.");

  await db.delete(veterinarians).where(eq(veterinarians.id, veterinarianId));
}

const listVeterinariansSchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Any member (admin, bénévole or famille d'accueil): lists an organization's
 * veterinarians with their tariffs. A famille d'accueil only receives the
 * tariffs when the organization has opted into showing them — stripped out
 * here, server-side, not just hidden in the UI.
 */
export async function listVeterinarians(input: z.infer<typeof listVeterinariansSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listVeterinariansSchema.parse(input);
  const roles = await requireRole(session.user.id, organizationId, [
    "admin",
    "benevole",
    "famille_accueil",
  ]);

  const list = await db.query.veterinarians.findMany({
    where: eq(veterinarians.organizationId, organizationId),
    with: { tariffs: true },
    orderBy: (veterinarians, { asc }) => [asc(veterinarians.name)],
  });

  const isOnlyFosterFamily = roles.includes("famille_accueil") && !roles.includes("admin") && !roles.includes("benevole");
  if (!isOnlyFosterFamily) return list;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { vetTariffsVisibleToFosterFamilies: true },
  });
  if (organization?.vetTariffsVisibleToFosterFamilies) return list;

  return list.map((veterinarian) => ({ ...veterinarian, tariffs: [] }));
}

const updateVetTariffsVisibilitySchema = z.object({
  organizationId: z.string().uuid(),
  visible: z.boolean(),
});

/** Admin-only: toggles whether familles d'accueil can see vet tariffs. */
export async function updateVetTariffsVisibility(
  input: z.infer<typeof updateVetTariffsVisibilitySchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, visible } = updateVetTariffsVisibilitySchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const [updated] = await db
    .update(organizations)
    .set({ vetTariffsVisibleToFosterFamilies: visible, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning({ id: organizations.id });
  if (!updated) throw new Error("Échec de la mise à jour du paramètre.");
  return updated;
}

const createVeterinarianTariffSchema = z.object({
  veterinarianId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actName: z.string().min(1).max(200),
  species: z.enum(animalSpeciesEnum.enumValues).nullable().optional(),
  sex: z.enum(animalSexEnum.enumValues).nullable().optional(),
  price: z.coerce.number().min(0),
});

export type CreateVeterinarianTariffInput = z.infer<typeof createVeterinarianTariffSchema>;

/** Admin-only: adds one priced act to a veterinarian's tariff grid. */
export async function createVeterinarianTariff(input: CreateVeterinarianTariffInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, veterinarianId, ...rest } = createVeterinarianTariffSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const veterinarian = await db.query.veterinarians.findFirst({
    where: and(eq(veterinarians.id, veterinarianId), eq(veterinarians.organizationId, organizationId)),
  });
  if (!veterinarian) throw new Error("Vétérinaire introuvable.");

  const [tariff] = await db
    .insert(veterinarianTariffs)
    .values({ veterinarianId, ...rest, price: rest.price.toFixed(2) })
    .returning();
  if (!tariff) throw new Error("Échec de l'ajout du tarif.");
  return tariff;
}

const updateVeterinarianTariffSchema = z.object({
  tariffId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actName: z.string().min(1).max(200).optional(),
  species: z.enum(animalSpeciesEnum.enumValues).nullable().optional(),
  sex: z.enum(animalSexEnum.enumValues).nullable().optional(),
  price: z.coerce.number().min(0).optional(),
});

export type UpdateVeterinarianTariffInput = z.infer<typeof updateVeterinarianTariffSchema>;

/** Admin-only: edits one tariff line. */
export async function updateVeterinarianTariff(input: UpdateVeterinarianTariffInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { tariffId, organizationId, price, ...rest } = updateVeterinarianTariffSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const tariff = await db.query.veterinarianTariffs.findFirst({
    where: eq(veterinarianTariffs.id, tariffId),
    with: { veterinarian: true },
  });
  if (!tariff || tariff.veterinarian.organizationId !== organizationId) {
    throw new Error("Tarif introuvable.");
  }

  const [updated] = await db
    .update(veterinarianTariffs)
    .set({ ...rest, ...(price !== undefined ? { price: price.toFixed(2) } : {}) })
    .where(eq(veterinarianTariffs.id, tariffId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du tarif.");
  return updated;
}

const deleteVeterinarianTariffSchema = z.object({
  tariffId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: removes one tariff line. */
export async function deleteVeterinarianTariff(
  input: z.infer<typeof deleteVeterinarianTariffSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { tariffId, organizationId } = deleteVeterinarianTariffSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const tariff = await db.query.veterinarianTariffs.findFirst({
    where: eq(veterinarianTariffs.id, tariffId),
    with: { veterinarian: true },
  });
  if (!tariff || tariff.veterinarian.organizationId !== organizationId) {
    throw new Error("Tarif introuvable.");
  }

  await db.delete(veterinarianTariffs).where(eq(veterinarianTariffs.id, tariffId));
}
