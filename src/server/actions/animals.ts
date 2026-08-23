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
  fosterFamilies,
  organizations,
  type AnimalStatus,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireAdminOrPermission, requireRole, getMemberRoles, ForbiddenError } from "@/lib/permissions";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { animalStatusRank, boosterDueDate, isBoosterDueWithin } from "@/lib/animal-care";
import { dateString } from "@/lib/validation";
import { uploadImage } from "@/lib/uploads";
import { sendPushToUsers } from "@/lib/push";
import { buildAnimalRegisterCsv } from "@/lib/animal-register-csv";
import { generateAnimalRegisterPdf } from "@/lib/animal-register-pdf";

/**
 * Best-effort: tells the linked user of `fosterFamilyId`, if any, that an
 * animal has just been placed with them. Never throws — a notification
 * failure must never break the status/creation flow that triggered it.
 */
async function notifyFosterFamilyOfPlacement(
  fosterFamilyId: string,
  animal: { id: string; name: string; organizationId: string },
) {
  try {
    const [family, organization] = await Promise.all([
      db.query.fosterFamilies.findFirst({ where: eq(fosterFamilies.id, fosterFamilyId) }),
      db.query.organizations.findFirst({ where: eq(organizations.id, animal.organizationId) }),
    ]);
    if (!family?.linkedUserId || !organization) return;

    await sendPushToUsers([family.linkedUserId], {
      title: "Nouvel animal confié",
      body: `${animal.name} vous a été confié·e.`,
      url: `/organisations/${organization.slug}/animaux/${animal.id}`,
    });
  } catch (err) {
    console.error("Échec de l'envoi de la notification de nouvel animal confié:", err);
  }
}

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
  dewormingDone: z.boolean().default(false),
  dewormingDate: dateString.optional(),
  externalTreatmentDone: z.boolean().default(false),
  externalTreatmentDate: dateString.optional(),
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
  await requireAdminOrPermission(session.user.id, data.organizationId, "prise_en_charge");

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
      dewormingDone: data.dewormingDone,
      dewormingDate: data.dewormingDate,
      externalTreatmentDone: data.externalTreatmentDone,
      externalTreatmentDate: data.externalTreatmentDate,
    });

    if (data.fosterFamilyId) {
      // The first placement starts when the animal was actually taken in,
      // not whenever this row happens to be created.
      await tx.insert(animalPlacements).values({
        animalId: animal.id,
        fosterFamilyId: data.fosterFamilyId,
        startedAt: new Date(data.intakeDate),
      });
    }

    return animal;
  }).then(async (animal) => {
    if (data.fosterFamilyId) {
      await notifyFosterFamilyOfPlacement(data.fosterFamilyId, {
        id: animal.id,
        name: animal.name,
        organizationId: data.organizationId,
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
  await requireAdminOrPermission(session.user.id, organizationId, "prise_en_charge");

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

/**
 * Admins can upload or replace any animal's photo. A famille d'accueil can
 * only add one when the animal doesn't have one yet — not replace an
 * existing photo — for the animal currently placed with her.
 */
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

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const roles = await getMemberRoles(session.user.id, organizationId);
  if (!roles.includes("admin")) {
    if (animal.photoUrl) {
      throw new ForbiddenError("Seul·e·s les administrateur·rice·s peuvent remplacer une photo existante.");
    }
    if (!(await isResponsibleForAnimal(roles, session.user.id, organizationId, animal))) {
      throw new ForbiddenError(
        "Seul·e·s les administrateur·rice·s ou la famille d'accueil responsable peuvent ajouter une photo.",
      );
    }
  }

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
  // The actual date a foster-family change happened (not necessarily
  // today) — closes the previous placement and opens the new one on this
  // same date. Ignored for an adoption, which uses adoptionDate instead.
  placementChangeDate: dateString.optional(),
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
  await requireAdminOrPermission(session.user.id, data.organizationId, "prise_en_charge");

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

  const nextFosterFamilyId = requiresFosterFamily ? data.fosterFamilyId! : null;

  return db.transaction(async (tx) => {
    const resolvedAdoptionDate =
      data.status === "adopte" ? data.adoptionDate ?? new Date().toISOString().slice(0, 10) : null;

    // The date the change actually happened — the adoption date when it's
    // an adoption, the admin-provided placement change date otherwise
    // (defaulting to today if she's entering it same-day). Used as both
    // the previous placement's end and the new one's start, so there's no
    // gap or overlap in the timeline.
    const changeDate =
      data.status === "adopte"
        ? new Date(resolvedAdoptionDate!)
        : new Date(data.placementChangeDate ?? new Date().toISOString().slice(0, 10));

    if (animal.currentFosterFamilyId && animal.currentFosterFamilyId !== nextFosterFamilyId) {
      await tx
        .update(animalPlacements)
        .set({ endedAt: changeDate })
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
        startedAt: changeDate,
        notes: data.notes,
      });
    }

    const [updated] = await tx
      .update(animals)
      .set({
        status: data.status,
        currentFosterFamilyId: nextFosterFamilyId,
        adoptionDate: resolvedAdoptionDate ?? animal.adoptionDate,
        updatedAt: new Date(),
      })
      .where(eq(animals.id, animal.id))
      .returning();
    if (!updated) throw new Error("Échec du changement de statut.");
    return updated;
  }).then(async (updated) => {
    if (nextFosterFamilyId && nextFosterFamilyId !== animal.currentFosterFamilyId) {
      await notifyFosterFamilyOfPlacement(nextFosterFamilyId, {
        id: updated.id,
        name: updated.name,
        organizationId: data.organizationId,
      });
    }
    return updated;
  });
}

const createAnimalPlacementSchema = z.object({
  animalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  fosterFamilyId: z.string().uuid(),
  startedAt: dateString,
  endedAt: dateString.optional(),
  notes: z.string().optional(),
});

/**
 * Admin-only: adds a placement record directly to an animal's history — for
 * backfilling or correcting the timeline (e.g. an adopted or archived
 * animal whose past placements were never recorded), not for opening a new
 * *current* placement on an animal still in care — use changeAnimalStatus
 * for that, so its status/currentFosterFamilyId stay in step with it.
 */
export async function createAnimalPlacement(input: z.infer<typeof createAnimalPlacementSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createAnimalPlacementSchema.parse(input);
  await requireAdminOrPermission(session.user.id, data.organizationId, "gestion_famille_accueil");

  if (data.endedAt && data.endedAt < data.startedAt) {
    throw new Error("La date de fin ne peut pas précéder la date de début.");
  }

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, data.animalId), eq(animals.organizationId, data.organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const fosterFamily = await db.query.fosterFamilies.findFirst({
    where: and(eq(fosterFamilies.id, data.fosterFamilyId), eq(fosterFamilies.organizationId, data.organizationId)),
  });
  if (!fosterFamily) throw new Error("Famille d'accueil introuvable.");

  if (!data.endedAt) {
    const existingOpen = await db.query.animalPlacements.findFirst({
      where: and(eq(animalPlacements.animalId, data.animalId), isNull(animalPlacements.endedAt)),
    });
    if (existingOpen) {
      throw new Error(
        "Un placement est déjà en cours pour cet animal — renseignez une date de fin, ou terminez-le d'abord.",
      );
    }
  }

  return db.transaction(async (tx) => {
    const [placement] = await tx
      .insert(animalPlacements)
      .values({
        animalId: data.animalId,
        fosterFamilyId: data.fosterFamilyId,
        startedAt: new Date(data.startedAt),
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
        notes: data.notes,
      })
      .returning();
    if (!placement) throw new Error("Échec de l'ajout du placement.");

    // Keep the denormalized "current" pointer consistent if this newly
    // added placement is the one that's actually open.
    if (!data.endedAt) {
      await tx
        .update(animals)
        .set({ currentFosterFamilyId: data.fosterFamilyId, updatedAt: new Date() })
        .where(eq(animals.id, data.animalId));
    }

    return placement;
  });
}

const updateAnimalPlacementSchema = z.object({
  placementId: z.string().uuid(),
  animalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  fosterFamilyId: z.string().uuid(),
  startedAt: dateString,
  endedAt: dateString.optional(),
  notes: z.string().optional(),
});

/** Admin-only: corrects an existing placement record (wrong dates, wrong family, notes). */
export async function updateAnimalPlacement(input: z.infer<typeof updateAnimalPlacementSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = updateAnimalPlacementSchema.parse(input);
  await requireAdminOrPermission(session.user.id, data.organizationId, "gestion_famille_accueil");

  if (data.endedAt && data.endedAt < data.startedAt) {
    throw new Error("La date de fin ne peut pas précéder la date de début.");
  }

  const placement = await db.query.animalPlacements.findFirst({
    where: and(eq(animalPlacements.id, data.placementId), eq(animalPlacements.animalId, data.animalId)),
  });
  if (!placement) throw new Error("Placement introuvable.");

  const fosterFamily = await db.query.fosterFamilies.findFirst({
    where: and(eq(fosterFamilies.id, data.fosterFamilyId), eq(fosterFamilies.organizationId, data.organizationId)),
  });
  if (!fosterFamily) throw new Error("Famille d'accueil introuvable.");

  const wasOpen = placement.endedAt === null;
  const willBeOpen = !data.endedAt;

  if (willBeOpen && !wasOpen) {
    // Re-opening a previously-closed placement — only fine if there isn't
    // already a different open one for this animal.
    const existingOpen = await db.query.animalPlacements.findFirst({
      where: and(eq(animalPlacements.animalId, data.animalId), isNull(animalPlacements.endedAt)),
    });
    if (existingOpen && existingOpen.id !== placement.id) {
      throw new Error("Un placement est déjà en cours pour cet animal.");
    }
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(animalPlacements)
      .set({
        fosterFamilyId: data.fosterFamilyId,
        startedAt: new Date(data.startedAt),
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
        notes: data.notes,
      })
      .where(eq(animalPlacements.id, data.placementId))
      .returning();
    if (!updated) throw new Error("Échec de la mise à jour du placement.");

    // Keep animals.currentFosterFamilyId in step if this edit changed
    // whether (or to whom) this placement is the open one.
    const animal = await tx.query.animals.findFirst({
      where: and(eq(animals.id, data.animalId), eq(animals.organizationId, data.organizationId)),
    });
    if (animal) {
      if (willBeOpen) {
        if (animal.currentFosterFamilyId !== data.fosterFamilyId) {
          await tx
            .update(animals)
            .set({ currentFosterFamilyId: data.fosterFamilyId, updatedAt: new Date() })
            .where(eq(animals.id, data.animalId));
        }
      } else if (wasOpen && animal.currentFosterFamilyId === placement.fosterFamilyId) {
        await tx
          .update(animals)
          .set({ currentFosterFamilyId: null, updatedAt: new Date() })
          .where(eq(animals.id, data.animalId));
      }
    }

    return updated;
  });
}

const deleteAnimalPlacementSchema = z.object({
  placementId: z.string().uuid(),
  animalId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: removes a placement record entirely — a mistaken entry, not a real historical placement. */
export async function deleteAnimalPlacement(input: z.infer<typeof deleteAnimalPlacementSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = deleteAnimalPlacementSchema.parse(input);
  await requireAdminOrPermission(session.user.id, data.organizationId, "gestion_famille_accueil");

  const placement = await db.query.animalPlacements.findFirst({
    where: and(eq(animalPlacements.id, data.placementId), eq(animalPlacements.animalId, data.animalId)),
  });
  if (!placement) throw new Error("Placement introuvable.");

  return db.transaction(async (tx) => {
    await tx.delete(animalPlacements).where(eq(animalPlacements.id, data.placementId));

    // Deleting the currently-open placement leaves the animal with no
    // foster family until a new one is recorded.
    if (!placement.endedAt) {
      const animal = await tx.query.animals.findFirst({
        where: and(eq(animals.id, data.animalId), eq(animals.organizationId, data.organizationId)),
      });
      if (animal?.currentFosterFamilyId === placement.fosterFamilyId) {
        await tx
          .update(animals)
          .set({ currentFosterFamilyId: null, updatedAt: new Date() })
          .where(eq(animals.id, data.animalId));
      }
    }
  });
}

/** Whether `userId` is the foster family currently responsible for `animal` — the one exception to admin-only edits on a handful of fields (checklist, description, first photo). */
async function isResponsibleForAnimal(
  roles: string[],
  userId: string,
  organizationId: string,
  animal: { currentFosterFamilyId: string | null },
) {
  if (!roles.includes("famille_accueil") || !animal.currentFosterFamilyId) return false;
  const family = await db.query.fosterFamilies.findFirst({
    where: and(
      eq(fosterFamilies.id, animal.currentFosterFamilyId),
      eq(fosterFamilies.organizationId, organizationId),
      eq(fosterFamilies.linkedUserId, userId),
    ),
  });
  return family !== undefined;
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
  dewormingDone: z.boolean().optional(),
  dewormingDate: dateString.optional(),
  externalTreatmentDone: z.boolean().optional(),
  externalTreatmentDate: dateString.optional(),
});

export type UpdateHealthChecklistInput = z.infer<typeof updateHealthChecklistSchema>;

/**
 * Admins can update any animal's checklist. A famille d'accueil can only
 * update the checklist of an animal currently placed with her — i.e. her
 * foster family record's linkedUserId matches this user and it's the
 * animal's currentFosterFamilyId.
 */
export async function updateAnimalHealthChecklist(input: UpdateHealthChecklistInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { animalId, organizationId, ...rest } = updateHealthChecklistSchema.parse(input);

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const roles = await getMemberRoles(session.user.id, organizationId);
  if (!roles.includes("admin") && !(await isResponsibleForAnimal(roles, session.user.id, organizationId, animal))) {
    throw new ForbiddenError(
      "Seul·e·s les administrateur·rice·s ou la famille d'accueil responsable peuvent modifier cette checklist.",
    );
  }

  const [updated] = await db
    .update(animalHealthChecklists)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(animalHealthChecklists.animalId, animalId))
    .returning();
  if (!updated) throw new Error("Checklist introuvable.");
  return updated;
}

const updateAnimalDescriptionSchema = z.object({
  animalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  description: z.string().max(2000).optional(),
});

/**
 * Admins can edit any animal's description. A famille d'accueil can only
 * edit the description of the animal currently placed with her — lets her
 * note its personality/needs without full edit access to the rest of the sheet.
 */
export async function updateAnimalDescription(
  input: z.infer<typeof updateAnimalDescriptionSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { animalId, organizationId, description } = updateAnimalDescriptionSchema.parse(input);

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
  });
  if (!animal) throw new Error("Animal introuvable.");

  const roles = await getMemberRoles(session.user.id, organizationId);
  if (!roles.includes("admin") && !(await isResponsibleForAnimal(roles, session.user.id, organizationId, animal))) {
    throw new ForbiddenError(
      "Seul·e·s les administrateur·rice·s ou la famille d'accueil responsable peuvent modifier la description.",
    );
  }

  const [updated] = await db
    .update(animals)
    .set({ description, updatedAt: new Date() })
    .where(eq(animals.id, animalId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de la description.");
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

const ANIMALS_PAGE_SIZE = 20;

const listAnimalsPageSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(animalStatusEnum.enumValues).optional(),
  page: z.number().int().min(1).default(1),
});

/**
 * Any member: the paginated, triage-ordered animal list used by the Animaux
 * page — animals with an owed booster first, then by
 * `ANIMAL_STATUS_ORDER`, most recent first within each group.
 */
export async function listAnimalsPage(input: z.infer<typeof listAnimalsPageSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, status, page } = listAnimalsPageSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  const all = await db.query.animals.findMany({
    where: status
      ? and(eq(animals.organizationId, organizationId), eq(animals.status, status))
      : eq(animals.organizationId, organizationId),
    with: { healthChecklist: true, currentFosterFamily: true },
  });

  const sorted = [...all].sort((a, b) => {
    const aOwed = a.healthChecklist ? isBoosterDueWithin(a.healthChecklist, 14, a.status) : false;
    const bOwed = b.healthChecklist ? isBoosterDueWithin(b.healthChecklist, 14, b.status) : false;
    if (aOwed !== bOwed) return aOwed ? -1 : 1;

    const rankDiff = animalStatusRank(a.status) - animalStatusRank(b.status);
    if (rankDiff !== 0) return rankDiff;

    // Within "adopté", the adoption date is what actually matters to
    // review, not when the row was created.
    if (a.status === "adopte" && b.status === "adopte") {
      return (b.adoptionDate ?? "").localeCompare(a.adoptionDate ?? "");
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / ANIMALS_PAGE_SIZE));
  const start = (page - 1) * ANIMALS_PAGE_SIZE;

  return {
    animals: sorted.slice(start, start + ANIMALS_PAGE_SIZE),
    total,
    page,
    pageSize: ANIMALS_PAGE_SIZE,
    totalPages,
  };
}

const getAnimalStatusCountsSchema = z.object({ organizationId: z.string().uuid() });

/** Any member: how many animals are in each status, across the whole org (not just the current page/filter) — feeds the stats summary on the Animaux page. */
export async function getAnimalStatusCounts(
  input: z.infer<typeof getAnimalStatusCountsSchema>,
): Promise<Record<AnimalStatus, number>> {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = getAnimalStatusCountsSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  const rows = await db.query.animals.findMany({
    where: eq(animals.organizationId, organizationId),
    columns: { status: true },
  });

  const counts = Object.fromEntries(
    animalStatusEnum.enumValues.map((status) => [status, 0]),
  ) as Record<AnimalStatus, number>;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

const listAnimalsWithBoosterDueSchema = z.object({
  organizationId: z.string().uuid(),
  withinDays: z.number().int().min(1).default(14),
});

/** Any member: animals whose booster is owed and due within `withinDays` (including already-overdue ones) — used for the dashboard shortcut. */
export async function listAnimalsWithBoosterDue(
  input: z.infer<typeof listAnimalsWithBoosterDueSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, withinDays } = listAnimalsWithBoosterDueSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  const all = await db.query.animals.findMany({
    where: eq(animals.organizationId, organizationId),
    with: { healthChecklist: true },
  });

  return all
    .filter((a) => a.healthChecklist && isBoosterDueWithin(a.healthChecklist, withinDays, a.status))
    .sort((a, b) => boosterDueDate(a.healthChecklist!)!.localeCompare(boosterDueDate(b.healthChecklist!)!));
}

const listAnimalIntakeYearsSchema = z.object({ organizationId: z.string().uuid() });

/** Admin-only: distinct years with at least one animal intake, most recent first — feeds the register export's period filter. */
export async function listAnimalIntakeYears(input: z.infer<typeof listAnimalIntakeYearsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listAnimalIntakeYearsSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const rows = await db.query.animals.findMany({
    where: eq(animals.organizationId, organizationId),
    columns: { intakeDate: true },
  });

  const years = new Set(rows.map((row) => Number(row.intakeDate.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

const animalRegisterFilterSchema = z.object({
  organizationId: z.string().uuid(),
  year: z.number().int().optional(),
});

/**
 * Every animal for the org, most recently taken in first — the legally
 * required "registre d'entrée et de sortie", optionally scoped to the
 * year it was taken in (not the year it was adopted — an animal belongs
 * to the register of the year it entered the association).
 */
async function fetchAnimalsForRegister(input: z.infer<typeof animalRegisterFilterSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, year } = animalRegisterFilterSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const all = await db.query.animals.findMany({
    where: eq(animals.organizationId, organizationId),
    orderBy: desc(animals.intakeDate),
  });

  return year ? all.filter((a) => Number(a.intakeDate.slice(0, 4)) === year) : all;
}

function formatRegisterDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString("fr-FR") : "—";
}

/** Admin-only: the legal placement register as a semicolon-delimited CSV (Excel-FR friendly), optionally filtered to one year. */
export async function exportAnimalRegisterCsv(input: z.infer<typeof animalRegisterFilterSchema>) {
  const animalsForRegister = await fetchAnimalsForRegister(input);

  const csv = buildAnimalRegisterCsv(
    animalsForRegister.map((a) => ({
      animalName: a.name,
      icadNumber: a.icadNumber ?? "—",
      intakeDate: formatRegisterDate(a.intakeDate),
      adoptionDate: formatRegisterDate(a.adoptionDate),
      icadUpdatedAt: formatRegisterDate(a.icadUpdatedAt),
    })),
  );

  return { csv };
}

const exportAnimalRegisterPdfSchema = animalRegisterFilterSchema.extend({ periodDescription: z.string() });

/** Admin-only: the legal placement register as a PDF, optionally filtered to one year. */
export async function exportAnimalRegisterPdf(input: z.infer<typeof exportAnimalRegisterPdfSchema>) {
  const { periodDescription, ...filters } = exportAnimalRegisterPdfSchema.parse(input);
  const [animalsForRegister, organization] = await Promise.all([
    fetchAnimalsForRegister(filters),
    db.query.organizations.findFirst({ where: eq(organizations.id, filters.organizationId) }),
  ]);
  if (!organization) throw new Error("Association introuvable.");

  const pdfBytes = await generateAnimalRegisterPdf({
    organizationName: organization.name,
    periodDescription,
    rows: animalsForRegister.map((a) => ({
      animalName: a.name,
      icadNumber: a.icadNumber ?? "—",
      intakeDate: formatRegisterDate(a.intakeDate),
      adoptionDate: formatRegisterDate(a.adoptionDate),
      icadUpdatedAt: formatRegisterDate(a.icadUpdatedAt),
    })),
  });

  return { pdfBase64: Buffer.from(pdfBytes).toString("base64") };
}
