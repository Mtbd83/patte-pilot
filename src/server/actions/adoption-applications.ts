"use server";

import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adoptionApplications, adoptionApplicationStatusEnum, animalSpeciesEnum, organizations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireAdminOrPermission, requireRole, listOrganizationAdminUserIds, ForbiddenError } from "@/lib/permissions";
import { sendPushToUsers } from "@/lib/push";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { findAdoptionQuestion, isQuestionVisible } from "@/lib/adoption-question-bank";
import { getClientIp } from "@/lib/request-ip";

const answersSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

const submitAdoptionApplicationSchema = z.object({
  organizationId: z.string().uuid(),

  // Identité du candidat — tronc commun
  lastName: z.string().min(1).max(120),
  firstName: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  phone: z.string().min(1).max(30),
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  spouseAge: z.coerce.number().int().min(0).max(120).optional(),
  profession: z.string().max(150).optional(),
  spouseProfession: z.string().max(150).optional(),

  // Souhait d'adoption — tronc commun
  desiredSpecies: z.enum(animalSpeciesEnum.enumValues).optional(),
  specificAnimalName: z.string().max(120).optional(),
  targetAnimalId: z.string().uuid().optional(),

  // Banque de questions + questions libres de l'organisation — la forme
  // exacte dépend de sa config, revalidée ci-dessous contre l'organisation
  // elle-même, jamais contre ce que le client prétend avoir affiché.
  answers: answersSchema.default({}),

  // Consentement RGPD — obligatoire, jamais personnalisable par organisation.
  rgpdConsent: z.boolean(),

  // Honeypot: a field real visitors never see or fill (hidden off-screen in
  // the form) — bots that fill in every input trip it. Never persisted.
  honeypot: z.string().optional(),
});

export type SubmitAdoptionApplicationInput = z.input<typeof submitAdoptionApplicationSchema>;

const RATE_LIMIT_MAX_PER_HOUR = 5;

/**
 * Keeps only the answers the organization's current form config actually
 * asks for, and checks every question it marks `required` has a non-empty
 * answer — a client-sent key for a question the organization never selected
 * is silently dropped rather than persisted, since the client's own list of
 * displayed questions can't be trusted. A question that's species-restricted
 * or a "si oui/si non" follow-up to another question (see isQuestionVisible)
 * is skipped entirely — neither required nor stored — when its condition
 * isn't met, the same condition the public form itself uses to hide/show it.
 */
function sanitizeAnswers(
  organization: { adoptionFormQuestionKeys: string[] | null; adoptionFormFreeQuestions: { label: string }[] | null },
  answers: Record<string, string | string[]>,
  desiredSpecies: string | undefined,
): Record<string, string | string[]> {
  const sanitized: Record<string, string | string[]> = {};

  for (const key of organization.adoptionFormQuestionKeys ?? []) {
    const question = findAdoptionQuestion(key);
    if (!question) continue; // a key the bank no longer recognizes — never persisted
    if (!isQuestionVisible(question, { desiredSpecies, answers })) continue;
    const value = answers[key];
    const isEmpty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (question.required && isEmpty) {
      throw new Error(`Le champ « ${question.label} » est obligatoire.`);
    }
    if (!isEmpty) sanitized[key] = value;
  }

  const freeQuestions = organization.adoptionFormFreeQuestions ?? [];
  freeQuestions.forEach((_, index) => {
    const key = `libre_${index + 1}`;
    const value = answers[key];
    if (typeof value === "string" && value) sanitized[key] = value;
  });

  return sanitized;
}

/**
 * Public: anyone can submit an adoption application for an organization —
 * this is the public-facing adoption form, so deliberately no auth check.
 * Two lightweight anti-spam measures given the total absence of auth here:
 * a honeypot field, and a per-IP rate limit.
 */
export async function submitAdoptionApplication(input: SubmitAdoptionApplicationInput) {
  const { honeypot, answers, rgpdConsent, ...rest } = submitAdoptionApplicationSchema.parse(input);

  // A filled honeypot means a bot, not a real visitor — silently no-op
  // instead of throwing, so the bot has no signal it was caught.
  if (honeypot) {
    return null;
  }

  if (!rgpdConsent) {
    throw new Error("Vous devez accepter que votre profil soit conservé pour être recontacté·e.");
  }

  const data = rest;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, data.organizationId),
  });
  if (!organization) throw new Error("Organisation introuvable.");

  const sanitizedAnswers = sanitizeAnswers(organization, answers, data.desiredSpecies);

  const ipAddress = await getClientIp();
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
      answers: sanitizedAnswers,
      rgpdConsentAt: new Date(),
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
 * Admin, or bénévole with the "candidature" permission: fetches a single
 * adoption application (contains the applicant's personal details).
 */
export async function getAdoptionApplication(
  input: z.infer<typeof getAdoptionApplicationSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { applicationId, organizationId } = getAdoptionApplicationSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "candidature");

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
 * Admin, or bénévole with the "candidature" permission: accepts/refuses/
 * withdraws an adoption application, and records which animal was adopted.
 */
export async function updateAdoptionApplicationStatus(
  input: z.infer<typeof updateStatusSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { applicationId, organizationId, status, reviewNotes, targetAnimalId } =
    updateStatusSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "candidature");

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

const updateAdoptionFormConfigSchema = z.object({
  organizationId: z.string().uuid(),
  questionKeys: z.array(z.string()),
  freeQuestions: z.array(z.object({ label: z.string().min(1).max(200) })).max(2),
});

/** Admin-only: which bank questions (see src/lib/adoption-question-bank.ts) and free questions appear on this organization's public adoption form. */
export async function updateAdoptionFormConfig(
  input: z.infer<typeof updateAdoptionFormConfigSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, questionKeys, freeQuestions } = updateAdoptionFormConfigSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  // Drops any key the bank no longer recognizes, so a stale client payload
  // can never persist an unknown/retired question key.
  const validKeys = questionKeys.filter((key) => findAdoptionQuestion(key));

  const [updated] = await db
    .update(organizations)
    .set({ adoptionFormQuestionKeys: validKeys, adoptionFormFreeQuestions: freeQuestions, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();
  if (!updated) throw new Error("Organisation introuvable.");
  return updated;
}
