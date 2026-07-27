"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  animals,
  animalHealthChecklists,
  animalPlacements,
  animalSexEnum,
  animalSpeciesEnum,
  animalStatusEnum,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, ForbiddenError } from "@/lib/permissions";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { dateString } from "@/lib/validation";
import { uploadImage } from "@/lib/uploads";

const createAnimalSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120),
  species: z.enum(animalSpeciesEnum.enumValues).default("chat"),
  icadNumber: z.string().max(50).optional(),
  birthDate: dateString.optional(),
  breed: z.string().max(120).optional(),
  sex: z.enum(animalSexEnum.enumValues).default("inconnu"),
  coat: z.string().max(120).optional(),
  description: z.string().optional(),
  intakeDate: dateString,
  status: z.enum(animalStatusEnum.enumValues).default("quarantaine"),
  fosterFamilyId: z.string().uuid().optional(),
  firstVaccineDone: z.boolean().default(false),
  firstVaccineDate: dateString.optional(),
  sterilizationDone: z.boolean().default(false),
  sterilizationDate: dateString.optional(),
  boosterDone: z.boolean().default(false),
  boosterDate: dateString.optional(),
});

export type CreateAnimalInput = z.input<typeof createAnimalSchema>;

/**
 * Admin-only: registers a new animal. Creates its health checklist (blank,
 * or pre-filled from the create form) and, if the initial status requires a
 * foster family, opens the first placement — all in the same transaction.
 */
export async function createAnimal(input: CreateAnimalInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createAnimalSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  if (statusRequiresFosterFamily(data.status) && !data.fosterFamilyId) {
    throw new Error(
      "Une famille d'accueil est requise pour ce statut : sélectionnez-en une existante ou créez-en une nouvelle.",
    );
  }

  return db.transaction(async (tx) => {
    const [animal] = await tx
      .insert(animals)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        species: data.species,
        icadNumber: data.icadNumber,
        birthDate: data.birthDate,
        breed: data.breed,
        sex: data.sex,
        coat: data.coat,
        description: data.description,
        intakeDate: data.intakeDate,
        status: data.status,
        currentFosterFamilyId: data.fosterFamilyId ?? null,
      })
      .returning();
    if (!animal) throw new Error("Échec de la création de l'animal.");

    await tx.insert(animalHealthChecklists).values({
      animalId: animal.id,
      firstVaccineDone: data.firstVaccineDone,
      firstVaccineDate: data.firstVaccineDate,
      sterilizationDone: data.sterilizationDone,
      sterilizationDate: data.sterilizationDate,
      boosterDone: data.boosterDone,
      boosterDate: data.boosterDate,
    });

    if (data.fosterFamilyId) {
      await tx.insert(animalPlacements).values({
        animalId: animal.id,
        fosterFamilyId: data.fosterFamilyId,
      });
    }

    return animal;
  });
}

const updateAnimalSchema = z.object({
  animalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  species: z.enum(animalSpeciesEnum.enumValues).optional(),
  icadNumber: z.string().max(50).optional(),
  icadUpdatedAt: dateString.optional(),
  birthDate: dateString.optional(),
  breed: z.string().max(120).optional(),
  sex: z.enum(animalSexEnum.enumValues).optional(),
  coat: z.string().max(120).optional(),
  description: z.string().optional(),
  intakeDate: dateString.optional(),
});

export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;

/**
 * Admin-only: updates an animal's descriptive fields. Status and foster
 * family changes go through `changeAnimalStatus` so the placement history
 * stays consistent.
 */
export async function updateAnimal(input: UpdateAnimalInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { animalId, organizationId, ...rest } = updateAnimalSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const [updated] = await db
    .update(animals)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(animals.id, animalId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de l'animal.");
  return updated;
}

/** Admin-only: uploads (or replaces) an animal's photo. */
export async function uploadAnimalPhoto(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const organizationId = formData.get("organizationId");
  const animalId = formData.get("animalId");
  const file = formData.get("file");
  if (
    typeof organizationId !== "string" ||
    typeof animalId !== "string" ||
    !(file instanceof File)
  ) {
    throw new Error("Requête invalide.");
  }

  await requireAdmin(session.user.id, organizationId);

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const photoUrl = await uploadImage(file, `animaux/${animalId}`);

  const [updated] = await db
    .update(animals)
    .set({ photoUrl, updatedAt: new Date() })
    .where(eq(animals.id, animalId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de l'animal.");
  return updated;
}

const changeAnimalStatusSchema = z.object({
  animalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  status: z.enum(animalStatusEnum.enumValues),
  fosterFamilyId: z.string().uuid().optional(),
  adoptionDate: dateString.optional(),
  notes: z.string().optional(),
});

export type ChangeAnimalStatusInput = z.infer<typeof changeAnimalStatusSchema>;

/**
 * Admin-only: moves an animal to a new status, keeping the foster-family
 * link and placement history consistent:
 *  - statuses that require a foster family (quarantaine, en_soins,
 *    en_famille_accueil, visite_en_cours, reserve) need `fosterFamilyId` —
 *    switching family closes the previous open placement and opens a new one.
 *  - "adopte"/"archive" close the current placement and clear the link.
 */
export async function changeAnimalStatus(input: ChangeAnimalStatusInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = changeAnimalStatusSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, data.animalId), eq(animals.organizationId, data.organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const requiresFosterFamily = statusRequiresFosterFamily(data.status);
  if (requiresFosterFamily && !data.fosterFamilyId) {
    throw new Error(
      "Une famille d'accueil est requise pour ce statut : sélectionnez-en une existante ou créez-en une nouvelle.",
    );
  }

  return db.transaction(async (tx) => {
    const nextFosterFamilyId = requiresFosterFamily ? data.fosterFamilyId! : null;

    if (animal.currentFosterFamilyId && animal.currentFosterFamilyId !== nextFosterFamilyId) {
      await tx
        .update(animalPlacements)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(animalPlacements.animalId, animal.id),
            eq(animalPlacements.fosterFamilyId, animal.currentFosterFamilyId),
            isNull(animalPlacements.endedAt),
          ),
        );
    }

    if (nextFosterFamilyId && nextFosterFamilyId !== animal.currentFosterFamilyId) {
      await tx.insert(animalPlacements).values({
        animalId: animal.id,
        fosterFamilyId: nextFosterFamilyId,
        notes: data.notes,
      });
    }

    const [updated] = await tx
      .update(animals)
      .set({
        status: data.status,
        currentFosterFamilyId: nextFosterFamilyId,
        adoptionDate:
          data.status === "adopte"
            ? data.adoptionDate ?? new Date().toISOString().slice(0, 10)
            : animal.adoptionDate,
        updatedAt: new Date(),
      })
      .where(eq(animals.id, animal.id))
      .returning();
    if (!updated) throw new Error("Échec du changement de statut.");
    return updated;
  });
}

const updateHealthChecklistSchema = z.object({
  animalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  firstVaccineDone: z.boolean().optional(),
  firstVaccineDate: dateString.optional(),
  sterilizationDone: z.boolean().optional(),
  sterilizationDate: dateString.optional(),
  boosterDone: z.boolean().optional(),
  boosterDate: dateString.optional(),
});

export type UpdateHealthChecklistInput = z.infer<typeof updateHealthChecklistSchema>;

/** Admin-only: updates one or more fields of an animal's health checklist. */
export async function updateAnimalHealthChecklist(input: UpdateHealthChecklistInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { animalId, organizationId, ...rest } = updateHealthChecklistSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const [updated] = await db
    .update(animalHealthChecklists)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(animalHealthChecklists.animalId, animalId))
    .returning();
  if (!updated) throw new Error("Checklist introuvable.");
  return updated;
}

const listAnimalsSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(animalStatusEnum.enumValues).optional(),
});

/** Any member (admin, bénévole or famille d'accueil): lists an organization's animals. */
export async function listAnimals(input: z.infer<typeof listAnimalsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, status } = listAnimalsSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  return db.query.animals.findMany({
    where: status
      ? and(eq(animals.organizationId, organizationId), eq(animals.status, status))
      : eq(animals.organizationId, organizationId),
    orderBy: desc(animals.createdAt),
    with: { healthChecklist: true, currentFosterFamily: true },
  });
}
