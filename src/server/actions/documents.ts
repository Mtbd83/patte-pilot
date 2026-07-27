"use server";

import { readFile } from "fs/promises";
import path from "path";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { animals, documents, organizations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, ForbiddenError } from "@/lib/permissions";
import { sendEmail, organizationSmtpConfig } from "@/lib/mailer";
import { dateString } from "@/lib/validation";
import { generateAdoptionContractPdf } from "@/lib/adoption-contract-pdf";

const CERTIFICATE_FILE_PATH = path.join(
  process.cwd(),
  "public",
  "documents",
  "certificat-engagement.pdf",
);

async function loadAnimalAndOrganization(animalId: string, organizationId: string) {
  const [animal, organization] = await Promise.all([
    db.query.animals.findFirst({
      where: and(eq(animals.id, animalId), eq(animals.organizationId, organizationId)),
    }),
    db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) }),
  ]);
  if (!animal) throw new Error("Animal introuvable.");
  if (!organization) throw new Error("Organisation introuvable.");
  return { animal, organization };
}

const sendEngagementCertificateSchema = z.object({
  organizationId: z.string().uuid(),
  animalId: z.string().uuid(),
  adoptionApplicationId: z.string().uuid().optional(),
  toEmail: z.string().email(),
});

/**
 * Admin-only: emails the engagement certificate as-is (no filling — it's a
 * generic legal document the adopter signs on their own). The association
 * must place the real file at public/documents/certificat-engagement.pdf.
 */
export async function sendEngagementCertificate(
  input: z.infer<typeof sendEngagementCertificateSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = sendEngagementCertificateSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const { organization } = await loadAnimalAndOrganization(data.animalId, data.organizationId);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(CERTIFICATE_FILE_PATH);
  } catch {
    throw new Error(
      "Le fichier du certificat d'engagement est introuvable. Ajoutez-le à public/documents/certificat-engagement.pdf.",
    );
  }

  await sendEmail({
    to: data.toEmail,
    subject: `Certificat d'engagement — ${organization.name}`,
    html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint le certificat d'engagement à compléter et signer avant l'adoption.</p><p>${organization.name}</p>`,
    attachments: [
      { filename: "certificat-engagement.pdf", content: fileBuffer, contentType: "application/pdf" },
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
});

export type GenerateContractInput = z.infer<typeof generateContractSchema>;

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

  await sendEmail({
    to: data.toEmail,
    subject: `Contrat d'adoption — ${animal.name} — ${organization.name}`,
    html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint le contrat d'adoption de ${animal.name}.</p><p>${organization.name}</p>`,
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
