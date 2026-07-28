"use server";

import { and, desc, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import {
  adoptionApplications,
  adoptionApplicationStatusEnum,
  housingTypeEnum,
  housingZoneEnum,
  residencyStatusEnum,
  livingSituationEnum,
  activityLevelEnum,
  aloneTimeEnum,
  animalSpeciesEnum,
  organizations,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, listOrganizationAdminUserIds, ForbiddenError } from "@/lib/permissions";
import { sendPushToUsers } from "@/lib/push";
import { SPECIES_LABELS } from "@/lib/animal-labels";

const submitAdoptionApplicationSchema = z.object({
  organizationId: z.string().uuid(),

  // Identité du candidat
  lastName: z.string().min(1).max(120),
  firstName: z.string().min(1).max(120),
  city: z.string().max(120).optional(),
  phone: z.string().min(1).max(30),
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  spouseAge: z.coerce.number().int().min(0).max(120).optional(),
  profession: z.string().max(150).optional(),
  spouseProfession: z.string().max(150).optional(),

  // Logement
  housingZone: z.enum(housingZoneEnum.enumValues).optional(),
  housingType: z.enum(housingTypeEnum.enumValues).optional(),
  gardenAreaM2: z.coerce.number().min(0).optional(),
  fenceHeight: z.string().max(120).optional(),
  gardenAccessDetails: z.string().optional(),
  residencyStatus: z.enum(residencyStatusEnum.enumValues).optional(),
  residencyDuration: z.string().max(120).optional(),
  livingSituation: z.enum(livingSituationEnum.enumValues).optional(),

  // Foyer
  familySize: z.coerce.number().int().min(1).optional(),
  childrenCount: z.coerce.number().int().min(0).default(0),
  hasAllergies: z.boolean().default(false),
  activityLevel: z.enum(activityLevelEnum.enumValues).optional(),
  familyAgrees: z.boolean().default(true),
  familyDisagreementReason: z.string().optional(),

  // Animaux déjà présents
  hasOtherAnimals: z.boolean().default(false),
  otherAnimalsDetails: z.string().optional(),

  // Organisation du quotidien
  caretakerPerson: z.string().max(200).optional(),
  sleepingArea: z.string().max(200).optional(),
  aloneTimePerDay: z.enum(aloneTimeEnum.enumValues).optional(),
  dogWalksPerDay: z.coerce.number().int().min(0).optional(),
  dogMiddayWalkPossible: z.boolean().optional(),
  vacationPlan: z.string().optional(),

  // Souhait d'adoption
  desiredSpecies: z.enum(animalSpeciesEnum.enumValues).optional(),
  specificAnimalName: z.string().max(120).optional(),
  targetAnimalId: z.string().uuid().optional(),
  additionalComments: z.string().optional(),

  // Honeypot: a field real visitors never see or fill (hidden off-screen in
  // the form) — bots that fill in every input trip it. Never persisted.
  honeypot: z.string().optional(),
});

export type SubmitAdoptionApplicationInput = z.input<typeof submitAdoptionApplicationSchema>;

const RATE_LIMIT_MAX_PER_HOUR = 5;

function getClientIp() {
  try {
    const requestHeaders = headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    return forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;
  } catch {
    // Outside a real request scope (e.g. this action called directly from a
    // test) — rate-limiting is simply skipped rather than failing the call.
    return null;
  }
}

/**
 * Public: anyone can submit an adoption application for an organization —
 * this is the public-facing adoption form, so deliberately no auth check.
 * Two lightweight anti-spam measures given the total absence of auth here:
 * a honeypot field, and a per-IP rate limit.
 */
export async function submitAdoptionApplication(input: SubmitAdoptionApplicationInput) {
  const { honeypot, ...rest } = submitAdoptionApplicationSchema.parse(input);

  // A filled honeypot means a bot, not a real visitor — silently no-op
  // instead of throwing, so the bot has no signal it was caught.
  if (honeypot) {
    return null;
  }

  const data = rest;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, data.organizationId),
  });
  if (!organization) throw new Error("Organisation introuvable.");

  const ipAddress = getClientIp();
  if (ipAddress) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFromSameIp = await db.query.adoptionApplications.findMany({
      where: and(
        eq(adoptionApplications.organizationId, data.organizationId),
        eq(adoptionApplications.ipAddress, ipAddress),
        gte(adoptionApplications.createdAt, oneHourAgo),
      ),
    });
    if (recentFromSameIp.length >= RATE_LIMIT_MAX_PER_HOUR) {
      throw new Error("Trop de candidatures envoyées récemment — réessayez plus tard.");
    }
  }

  const [application] = await db
    .insert(adoptionApplications)
    .values({
      ...data,
      gardenAreaM2: data.gardenAreaM2 !== undefined ? data.gardenAreaM2.toString() : undefined,
      ipAddress,
    })
    .returning();
  if (!application) throw new Error("Échec de l'envoi de la candidature.");

  // Best-effort: never let a notification failure break the public submission.
  try {
    const adminUserIds = await listOrganizationAdminUserIds(data.organizationId);
    const animalWanted =
      application.specificAnimalName ||
      (application.desiredSpecies ? SPECIES_LABELS[application.desiredSpecies] : "un animal");
    await sendPushToUsers(adminUserIds, {
      title: "Nouvelle candidature",
      body: `${application.firstName} ${application.lastName} souhaite adopter ${animalWanted}.`,
      url: `/organisations/${organization.slug}/candidatures/${application.id}`,
    });
  } catch (err) {
    console.error("Échec de l'envoi de la notification de nouvelle candidature:", err);
  }

  return application;
}

const listAdoptionApplicationsSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(adoptionApplicationStatusEnum.enumValues).optional(),
});

/** Any member (admin, bénévole or famille d'accueil): lists adoption applications. */
export async function listAdoptionApplications(
  input: z.infer<typeof listAdoptionApplicationsSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, status } = listAdoptionApplicationsSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  return db.query.adoptionApplications.findMany({
    where: status
      ? and(eq(adoptionApplications.organizationId, organizationId), eq(adoptionApplications.status, status))
      : eq(adoptionApplications.organizationId, organizationId),
    orderBy: desc(adoptionApplications.createdAt),
    with: { targetAnimal: true },
  });
}

const getAdoptionApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/**
 * Admin or bénévole (not famille d'accueil): fetches a single adoption
 * application (contains the applicant's personal details).
 */
export async function getAdoptionApplication(
  input: z.infer<typeof getAdoptionApplicationSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { applicationId, organizationId } = getAdoptionApplicationSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole"]);

  const application = await db.query.adoptionApplications.findFirst({
    where: and(
      eq(adoptionApplications.id, applicationId),
      eq(adoptionApplications.organizationId, organizationId),
    ),
    with: { targetAnimal: true },
  });
  if (!application) throw new Error("Candidature introuvable.");
  return application;
}

const updateStatusSchema = z.object({
  applicationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  status: z.enum(adoptionApplicationStatusEnum.enumValues),
  reviewNotes: z.string().optional(),
  targetAnimalId: z.string().uuid().nullable().optional(),
});

/**
 * Admin or bénévole (not famille d'accueil): accepts/refuses/withdraws an
 * adoption application, and records which animal was adopted.
 */
export async function updateAdoptionApplicationStatus(
  input: z.infer<typeof updateStatusSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { applicationId, organizationId, status, reviewNotes, targetAnimalId } =
    updateStatusSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole"]);

  const application = await db.query.adoptionApplications.findFirst({
    where: and(
      eq(adoptionApplications.id, applicationId),
      eq(adoptionApplications.organizationId, organizationId),
    ),
  });
  if (!application) throw new Error("Candidature introuvable.");

  // targetAnimalId is only touched when the caller explicitly sends it (the
  // inline table editor always does; the detail page's status form doesn't
  // carry this field at all) — otherwise a save from a form that doesn't
  // know about it would silently wipe out an already-recorded animal.
  const [updated] = await db
    .update(adoptionApplications)
    .set({
      status,
      reviewNotes,
      ...(targetAnimalId !== undefined ? { targetAnimalId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(adoptionApplications.id, applicationId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du statut.");
  return updated;
}

const deleteAdoptionApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: permanently removes an adoption application. */
export async function deleteAdoptionApplication(
  input: z.infer<typeof deleteAdoptionApplicationSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { applicationId, organizationId } = deleteAdoptionApplicationSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const application = await db.query.adoptionApplications.findFirst({
    where: and(
      eq(adoptionApplications.id, applicationId),
      eq(adoptionApplications.organizationId, organizationId),
    ),
  });
  if (!application) throw new Error("Candidature introuvable.");

  await db.delete(adoptionApplications).where(eq(adoptionApplications.id, applicationId));
}
