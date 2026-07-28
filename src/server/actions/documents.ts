"use server";

import { readFile } from "fs/promises";
import path from "path";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { animals, documents, organizations, adoptionApplications, users } from "@/db/schema";
import type { AnimalSpecies } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, ForbiddenError } from "@/lib/permissions";
import { sendEmail, organizationSmtpConfig } from "@/lib/mailer";
import { dateString } from "@/lib/validation";
import { generateAdoptionContractPdf } from "@/lib/adoption-contract-pdf";
import { isBoosterOwed, boosterDueDate } from "@/lib/animal-care";
import {
  renderEmailTemplate,
  textToHtml,
  DEFAULT_CERTIFICATE_EMAIL_SUBJECT,
  DEFAULT_CERTIFICATE_EMAIL_BODY,
  DEFAULT_CONTRACT_EMAIL_SUBJECT,
  DEFAULT_CONTRACT_EMAIL_BODY,
} from "@/lib/email-templates";

const CERTIFICATE_FILE_PATHS: Record<AnimalSpecies, string> = {
  chien: path.join(process.cwd(), "public", "documents", "certificat-engagement-chien.pdf"),
  chat: path.join(process.cwd(), "public", "documents", "certificat-engagement.pdf"),
  lapin: path.join(process.cwd(), "public", "documents", "certificat-engagement.pdf"),
  autre: path.join(process.cwd(), "public", "documents", "certificat-engagement.pdf"),
};

async function loadAnimalAndOrganization(animalId: string, organizationId: string) {
  const [animal, organization] = await Promise.all([
    db.query.animals.findFirst({
      where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
      with: { healthChecklist: true },
    }),
    db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) }),
  ]);
  if (!animal) throw new Error("Animal introuvable.");
  if (!organization) throw new Error("Organisation introuvable.");
  return { animal, organization };
}

/** First name of the admin composing the email — signs off the message as "{{expediteur}}". */
async function loadSenderFirstName(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user?.firstName ?? "";
}

/** First name of the applicant tied to this send, if any — fills "{{prenom}}". */
async function loadApplicantFirstName(adoptionApplicationId: string | undefined) {
  if (!adoptionApplicationId) return "";
  const application = await db.query.adoptionApplications.findFirst({
    where: eq(adoptionApplications.id, adoptionApplicationId),
  });
  return application?.firstName ?? "";
}

const frDate = (date: Date) => date.toLocaleDateString("fr-FR");

const previewCertificateEmailSchema = z.object({
  organizationId: z.string().uuid(),
  animalId: z.string().uuid(),
  adoptionApplicationId: z.string().uuid().optional(),
});

/**
 * Admin-only, read-only: composes the certificate email's subject/body from
 * the organization's saved template (or the default one) so it can be shown
 * in an editable field before sending.
 */
export async function previewCertificateEmail(
  input: z.infer<typeof previewCertificateEmailSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = previewCertificateEmailSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const { animal, organization } = await loadAnimalAndOrganization(
    data.animalId,
    data.organizationId,
  );
  const [prenom, expediteur] = await Promise.all([
    loadApplicantFirstName(data.adoptionApplicationId),
    loadSenderFirstName(session.user.id),
  ]);

  const today = new Date();
  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + 7);

  const vars = {
    prenom,
    animal: animal.name,
    date_jour: frDate(today),
    date_limite: frDate(deadline),
    expediteur,
  };

  return {
    subject: renderEmailTemplate(
      organization.certificateEmailSubject || DEFAULT_CERTIFICATE_EMAIL_SUBJECT,
      vars,
    ),
    body: renderEmailTemplate(
      organization.certificateEmailBody || DEFAULT_CERTIFICATE_EMAIL_BODY,
      vars,
    ),
  };
}

const sendEngagementCertificateSchema = z.object({
  organizationId: z.string().uuid(),
  animalId: z.string().uuid(),
  adoptionApplicationId: z.string().uuid().optional(),
  toEmail: z.string().email(),
  subject: z.string().min(1, "Le sujet est requis."),
  body: z.string().min(1, "Le corps du message est requis."),
});

/**
 * Admin-only: emails the engagement certificate as-is (no filling — it's a
 * generic legal document the adopter signs on their own) alongside the
 * subject/body composed (and possibly edited) from the organization's
 * template. The association must place the real file at
 * public/documents/certificat-engagement.pdf.
 */
export async function sendEngagementCertificate(
  input: z.infer<typeof sendEngagementCertificateSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = sendEngagementCertificateSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const { animal, organization } = await loadAnimalAndOrganization(data.animalId, data.organizationId);

  const certificatePath = CERTIFICATE_FILE_PATHS[animal.species];
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(certificatePath);
  } catch {
    throw new Error(
      `Le fichier du certificat d'engagement est introuvable. Ajoutez-le à public/documents/${path.basename(certificatePath)}.`,
    );
  }

  await sendEmail({
    to: data.toEmail,
    subject: data.subject,
    html: textToHtml(data.body),
    attachments: [
      { filename: path.basename(certificatePath), content: fileBuffer, contentType: "application/pdf" },
    ],
    fromName: organization.name,
    replyTo: organization.contactEmail ?? undefined,
    organizationSmtp: organizationSmtpConfig(organization),
  });

  const [document] = await db
    .insert(documents)
    .values({
      organizationId: data.organizationId,
      animalId: data.animalId,
      adoptionApplicationId: data.adoptionApplicationId,
      type: "certificat_engagement",
      status: "envoye",
      sentToEmail: data.toEmail,
      sentAt: new Date(),
    })
    .returning();
  if (!document) throw new Error("Échec de l'enregistrement de l'envoi.");
  return document;
}

const generateContractSchema = z.object({
  organizationId: z.string().uuid(),
  animalId: z.string().uuid({ message: "Sélectionnez un animal." }),
  adoptionApplicationId: z.string().uuid().optional(),
  toEmail: z.string().email("L'email du destinataire est invalide."),

  adopterFullName: z.string().min(1, "Le nom de l'adoptant·e est requis.").max(200),
  // Not collected by the public adoption form, so left to the admin's
  // discretion — the contract is still valid with this line left blank.
  adopterAddress: z.string().optional(),
  adopterPostalCode: z.string().min(1, "Le code postal est requis.").max(10),
  adopterCity: z.string().min(1, "La ville est requise.").max(120),
  adopterPhone1: z.string().min(1, "Le téléphone est requis.").max(30),
  adopterPhone2: z.string().max(30).optional(),

  sterilizationDone: z.boolean(),
  healthCertificateOk: z.boolean(),

  vetFeesAmount: z.coerce.number().min(0),
  sterilizationFeesAmount: z.coerce.number().min(0).optional(),
  freeDonationAmount: z.coerce.number().min(0).optional(),
  freeDonationReason: z.string().optional(),

  signaturePlace: z.string().min(1, "Le lieu de signature est requis.").max(150),
  signatureDate: dateString,

  // Composed (and possibly edited) client-side from previewContractEmail —
  // optional here since the PDF preview path doesn't need them, required at
  // actual send time (checked in generateAndSendAdoptionContract).
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
});

export type GenerateContractInput = z.infer<typeof generateContractSchema>;

const previewContractEmailSchema = z.object({
  organizationId: z.string().uuid(),
  animalId: z.string().uuid({ message: "Sélectionnez un animal." }),
  adoptionApplicationId: z.string().uuid().optional(),
  sterilizationDone: z.boolean(),
  vetFeesAmount: z.coerce.number().min(0),
  helloAssoLink: z.string().optional(),
});

/**
 * Admin-only, read-only: composes the contract email's subject/body from
 * the organization's saved template (or the default one) so it can be shown
 * in an editable field before sending. Kept separate from the PDF-generation
 * schema since it only needs a handful of the contract's fields.
 */
export async function previewContractEmail(input: z.infer<typeof previewContractEmailSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = previewContractEmailSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const { animal, organization } = await loadAnimalAndOrganization(
    data.animalId,
    data.organizationId,
  );
  const [prenom, expediteur] = await Promise.all([
    loadApplicantFirstName(data.adoptionApplicationId),
    loadSenderFirstName(session.user.id),
  ]);

  const rappelVaccin = animal.healthChecklist
    ? isBoosterOwed(animal.healthChecklist, animal.status)
    : false;
  const dueDate = rappelVaccin && animal.healthChecklist ? boosterDueDate(animal.healthChecklist) : null;

  const vars = {
    prenom,
    animal: animal.name,
    montant: `${data.vetFeesAmount.toFixed(2)} €`,
    iban: organization.iban ?? "",
    helloasso_lien: data.helloAssoLink ?? "",
    tresoriere: organization.treasurerName ?? "",
    expediteur,
    date_rappel_vaccin: dueDate ? frDate(new Date(dueDate)) : "",
  };
  const flags = {
    caution_sterilisation: !data.sterilizationDone,
    rappel_vaccin: rappelVaccin,
  };

  return {
    subject: renderEmailTemplate(
      organization.contractEmailSubject || DEFAULT_CONTRACT_EMAIL_SUBJECT,
      vars,
      flags,
    ),
    body: renderEmailTemplate(
      organization.contractEmailBody || DEFAULT_CONTRACT_EMAIL_BODY,
      vars,
      flags,
    ),
  };
}

/** Shared by preview and send: validates, checks admin access, and renders the PDF bytes. */
async function buildContractPdfBytes(input: GenerateContractInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const parsed = generateContractSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Certains champs du formulaire sont invalides.");
  }
  const data = parsed.data;
  await requireAdmin(session.user.id, data.organizationId);

  const { animal, organization } = await loadAnimalAndOrganization(
    data.animalId,
    data.organizationId,
  );

  const pdfBytes = await generateAdoptionContractPdf({
    animal: {
      name: animal.name,
      sex: animal.sex,
      species: animal.species,
      breed: animal.breed,
      birthDate: animal.birthDate,
      icadNumber: animal.icadNumber,
      coat: animal.coat,
    },
    sterilizationDone: data.sterilizationDone,
    healthCertificateOk: data.healthCertificateOk,
    adopter: {
      fullName: data.adopterFullName,
      address: data.adopterAddress ?? "",
      postalCode: data.adopterPostalCode,
      city: data.adopterCity,
      phone1: data.adopterPhone1,
      phone2: data.adopterPhone2,
      email: data.toEmail,
    },
    vetFeesAmount: data.vetFeesAmount,
    sterilizationFeesAmount: data.sterilizationFeesAmount,
    freeDonationAmount: data.freeDonationAmount,
    freeDonationReason: data.freeDonationReason,
    signaturePlace: data.signaturePlace,
    signatureDate: data.signatureDate,
  });

  return { pdfBytes, animal, organization, data };
}

/**
 * Admin-only: renders the contract PDF without emailing or logging it, so
 * it can be checked in the browser before actually sending it to the
 * adopter. Returns the PDF base64-encoded since binary values don't cross
 * the server-action boundary directly.
 */
export async function previewAdoptionContract(input: GenerateContractInput) {
  const { pdfBytes } = await buildContractPdfBytes(input);
  return { pdfBase64: Buffer.from(pdfBytes).toString("base64") };
}

/**
 * Admin-only: fills the adoption contract from the animal's record and the
 * adopter/financial details given, emails the generated PDF, and logs it in
 * `documents`. The PDF itself isn't persisted anywhere (no blob storage
 * configured) — it's regenerated on demand if needed again.
 */
export async function generateAndSendAdoptionContract(input: GenerateContractInput) {
  const { pdfBytes, animal, organization, data } = await buildContractPdfBytes(input);

  if (!data.emailSubject || !data.emailBody) {
    throw new Error("Le sujet et le corps de l'email sont requis — générez l'aperçu du mail.");
  }

  await sendEmail({
    to: data.toEmail,
    subject: data.emailSubject,
    html: textToHtml(data.emailBody),
    attachments: [
      {
        filename: `contrat-adoption-${animal.name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
    fromName: organization.name,
    replyTo: organization.contactEmail ?? undefined,
    organizationSmtp: organizationSmtpConfig(organization),
  });

  const [document] = await db
    .insert(documents)
    .values({
      organizationId: data.organizationId,
      animalId: data.animalId,
      adoptionApplicationId: data.adoptionApplicationId,
      type: "contrat_adoption",
      status: "envoye",
      sentToEmail: data.toEmail,
      sentAt: new Date(),
    })
    .returning();
  if (!document) throw new Error("Échec de l'enregistrement de l'envoi.");
  return document;
}

const listDocumentsSchema = z.object({
  organizationId: z.string().uuid(),
  animalId: z.string().uuid().optional(),
  adoptionApplicationId: z.string().uuid().optional(),
});

/** Any member: lists generated/sent documents, optionally scoped to an animal or application. */
export async function listDocuments(input: z.infer<typeof listDocumentsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, animalId, adoptionApplicationId } = listDocumentsSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  const conditions = [eq(documents.organizationId, organizationId)];
  if (animalId) conditions.push(eq(documents.animalId, animalId));
  if (adoptionApplicationId) {
    conditions.push(eq(documents.adoptionApplicationId, adoptionApplicationId));
  }

  return db.query.documents.findMany({
    where: and(...conditions),
    orderBy: desc(documents.createdAt),
  });
}
