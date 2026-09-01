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

const coordsFields = {
  // Manual override — set together, takes priority over auto-geocoding.
  // Nominatim occasionally fails from Vercel's shared IPs even for an
  // address that geocodes fine elsewhere; this is the fallback so a vet
  // isn't permanently stuck off the map when that happens.
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
};

const createVeterinarianSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(200),
  ...addressFields,
  ...coordsFields,
  phone: z.string().max(30).optional(),
  notes: z.string().optional(),
});

export type CreateVeterinarianInput = z.infer<typeof createVeterinarianSchema>;

/**
 * Admin-only: registers a new partner veterinarian. If `latitude`/
 * `longitude` are both given, they're used as-is (manual placement); other-
 * wise the address is geocoded automatically. `geocodeError` on the result
 * is non-null when auto-geocoding was attempted and failed (the vet is
 * still created either way) — surfaced by the caller as a toast so a real
 * failure is visible without server log access.
 */
export async function createVeterinarian(input: CreateVeterinarianInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { latitude, longitude, ...data } = createVeterinarianSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  let coords: { latitude: number; longitude: number } | null = null;
  let geocodeError: string | null = null;
  if (latitude != null && longitude != null) {
    coords = { latitude, longitude };
  } else {
    const geocoded = await geocodeAddress(data);
    geocodeError = geocoded && "error" in geocoded ? geocoded.error : null;
    coords = geocoded && "latitude" in geocoded ? geocoded : null;
  }

  const [veterinarian] = await db
    .insert(veterinarians)
    .values({ ...data, latitude: coords?.latitude, longitude: coords?.longitude })
    .returning();
  if (!veterinarian) throw new Error("Échec de la création du vétérinaire.");
  return { ...veterinarian, geocodeError };
}

const updateVeterinarianSchema = z.object({
  veterinarianId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  ...addressFields,
  ...coordsFields,
  phone: z.string().max(30).optional(),
  notes: z.string().optional(),
});

export type UpdateVeterinarianInput = z.infer<typeof updateVeterinarianSchema>;

/**
 * Admin-only: updates a veterinarian's details. `latitude`/`longitude`, if
 * both given, are used as-is and take priority over re-geocoding — the
 * fallback for fixing a vet stuck without coordinates after an automatic
 * geocoding failure. Otherwise, changing the address re-geocodes it.
 */
export async function updateVeterinarian(input: UpdateVeterinarianInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { veterinarianId, organizationId, latitude, longitude, ...rest } =
    updateVeterinarianSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const veterinarian = await db.query.veterinarians.findFirst({
    where: and(eq(veterinarians.id, veterinarianId), eq(veterinarians.organizationId, organizationId)),
  });
  if (!veterinarian) throw new Error("Vétérinaire introuvable.");

  const manualCoords = latitude != null && longitude != null ? { latitude, longitude } : null;

  const addressChanged =
    !manualCoords &&
    ((rest.address !== undefined && rest.address !== veterinarian.address) ||
      (rest.postalCode !== undefined && rest.postalCode !== veterinarian.postalCode) ||
      (rest.city !== undefined && rest.city !== veterinarian.city));

  const geocoded = addressChanged
    ? await geocodeAddress({
        address: rest.address ?? veterinarian.address,
        postalCode: rest.postalCode ?? veterinarian.postalCode,
        city: rest.city ?? veterinarian.city,
      })
    : null;
  const geocodeError = geocoded && "error" in geocoded ? geocoded.error : null;
  const coords = manualCoords ?? (geocoded && "latitude" in geocoded ? geocoded : null);

  const [updated] = await db
    .update(veterinarians)
    .set({
      ...rest,
      ...(manualCoords || addressChanged
        ? { latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(veterinarians.id, veterinarianId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du vétérinaire.");
  return { ...updated, geocodeError };
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
 * Admin or famille d'accueil only (not bénévole — this tab is reserved for
 * the people who actually deal with vets): lists an organization's
 * veterinarians with their tariffs. A famille d'accueil only receives the
 * tariffs when the organization has opted into showing them — stripped out
 * here, server-side, not just hidden in the UI.
 */
export async function listVeterinarians(input: z.infer<typeof listVeterinariansSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listVeterinariansSchema.parse(input);
  const roles = await requireRole(session.user.id, organizationId, ["admin", "famille_accueil"]);

  const list = await db.query.veterinarians.findMany({
    where: eq(veterinarians.organizationId, organizationId),
    with: { tariffs: true },
    orderBy: (veterinarians, { asc }) => [asc(veterinarians.name)],
  });

  const isOnlyFosterFamily = roles.includes("famille_accueil") && !roles.includes("admin");
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
