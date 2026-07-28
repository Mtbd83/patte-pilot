"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { uploadImage, uploadDocument } from "@/lib/uploads";

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
  iban: z.string().max(34).optional(),
  treasurerName: z.string().max(200).optional(),
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

const updateOrganizationEmailSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  smtpUser: z.string().email("Adresse email invalide."),
  smtpAppPassword: z.string().min(1).optional(),
});

export type UpdateOrganizationEmailSettingsInput = z.infer<typeof updateOrganizationEmailSettingsSchema>;

/**
 * Admin-only: sets the organization's own outgoing mailbox (an email
 * address + Gmail app password) — every email this app sends on the
 * organization's behalf goes through it, so recipients see the
 * association's own address, not a shared one. The app password is
 * write-only: never returned, and left unchanged if omitted so re-saving
 * the address alone doesn't require re-entering it.
 */
export async function updateOrganizationEmailSettings(input: UpdateOrganizationEmailSettingsInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, smtpUser, smtpAppPassword } =
    updateOrganizationEmailSettingsSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const [updated] = await db
    .update(organizations)
    .set({
      smtpUser,
      ...(smtpAppPassword ? { smtpAppPassword: smtpAppPassword.replace(/\s+/g, "") } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning({ id: organizations.id, smtpUser: organizations.smtpUser });
  if (!updated) throw new Error("Échec de la mise à jour de l'adresse d'envoi.");
  return updated;
}

const updateOrganizationEmailTemplatesSchema = z.object({
  organizationId: z.string().uuid(),
  certificateEmailSubject: z.string().min(1, "Le sujet est requis.").max(255),
  certificateEmailBody: z.string().min(1, "Le corps du message est requis."),
  contractEmailSubject: z.string().min(1, "Le sujet est requis.").max(255),
  contractEmailBody: z.string().min(1, "Le corps du message est requis."),
});

export type UpdateOrganizationEmailTemplatesInput = z.infer<
  typeof updateOrganizationEmailTemplatesSchema
>;

/**
 * Admin-only: saves the organization's own wording for the certificate and
 * contract emails (see src/lib/email-templates.ts for the {{token}} syntax
 * and the default text used before an organization has saved its own).
 */
export async function updateOrganizationEmailTemplates(
  input: UpdateOrganizationEmailTemplatesInput,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, ...rest } = updateOrganizationEmailTemplatesSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const [updated] = await db
    .update(organizations)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour des modèles d'emails.");
  return updated;
}

/** Admin-only: uploads (or replaces) the organization's logo. */
export async function uploadOrganizationLogo(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const organizationId = formData.get("organizationId");
  const file = formData.get("file");
  if (typeof organizationId !== "string" || !(file instanceof File)) {
    throw new Error("Requête invalide.");
  }

  await requireAdmin(session.user.id, organizationId);

  const logoUrl = await uploadImage(file, `logos/${organizationId}`);

  const [updated] = await db
    .update(organizations)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du logo.");
  return updated;
}

const CERTIFICATE_SPECIES = ["default", "chien"] as const;
type CertificateSpecies = (typeof CERTIFICATE_SPECIES)[number];
const CERTIFICATE_COLUMN: Record<CertificateSpecies, "certificateFileUrl" | "certificateFileUrlChien"> = {
  default: "certificateFileUrl",
  chien: "certificateFileUrlChien",
};

/**
 * Admin-only: uploads (or replaces) the organization's own engagement
 * certificate PDF — sent as-is, no filling (see sendEngagementCertificate).
 * `species` "default" covers chat/lapin/autre; "chien" is an optional
 * override.
 */
export async function updateOrganizationCertificate(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const organizationId = formData.get("organizationId");
  const species = formData.get("species");
  const file = formData.get("file");
  if (
    typeof organizationId !== "string" ||
    typeof species !== "string" ||
    !CERTIFICATE_SPECIES.includes(species as CertificateSpecies) ||
    !(file instanceof File)
  ) {
    throw new Error("Requête invalide.");
  }

  await requireAdmin(session.user.id, organizationId);

  const certificateFileUrl = await uploadDocument(
    file,
    `documents/${organizationId}/certificat-${species}`,
  );

  const [updated] = await db
    .update(organizations)
    .set({ [CERTIFICATE_COLUMN[species as CertificateSpecies]]: certificateFileUrl, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du certificat.");
  return updated;
}
