import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import type { AnimalSex, AnimalSpecies, ContractFieldPositions } from "@/db/schema";
import type { ContractCheckboxFieldKey } from "@/lib/contract-fields";

const SEX_LABELS: Record<AnimalSex, string> = {
  male: "Mâle",
  femelle: "Femelle",
  inconnu: "",
};

const SPECIES_LABELS: Record<AnimalSpecies, string> = {
  chat: "Chat",
  chien: "Chien",
  lapin: "Lapin",
  autre: "Autre",
};

export interface AdoptionContractAnimal {
  name: string;
  sex: AnimalSex;
  species: AnimalSpecies;
  breed?: string | null;
  birthDate?: string | null;
  icadNumber?: string | null;
  coat?: string | null;
}

export interface AdoptionContractAdopter {
  fullName: string;
  address: string;
  postalCode: string;
  city: string;
  phone1: string;
  phone2?: string;
  email: string;
}

export interface AdoptionContractData {
  animal: AdoptionContractAnimal;
  sterilizationDone: boolean;
  healthCertificateOk: boolean;
  adopter: AdoptionContractAdopter;
  vetFeesAmount: number;
  sterilizationFeesAmount?: number;
  freeDonationAmount?: number;
  freeDonationReason?: string;
  signaturePlace: string;
  signatureDate: string;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** Text value for every field in CONTRACT_TEXT_FIELDS (src/lib/contract-fields.ts), keyed the same way. */
function computeTextValues(data: AdoptionContractData): Record<string, string> {
  const especeLabel = [SPECIES_LABELS[data.animal.species], data.animal.breed]
    .filter(Boolean)
    .join(" ");

  return {
    nom: data.animal.name,
    dateNaissance: formatDate(data.animal.birthDate),
    icad: data.animal.icadNumber ?? "",
    pelage: data.animal.coat ?? "",
    espece: especeLabel,
    adopterName: data.adopter.fullName,
    adopterAddress: data.adopter.address,
    adopterPostalCode: data.adopter.postalCode,
    adopterCity: data.adopter.city,
    adopterPhone1: data.adopter.phone1,
    adopterPhone2: data.adopter.phone2 ?? "",
    adopterEmail: data.adopter.email,
    vetFees: data.vetFeesAmount.toFixed(0),
    sterilizationFees: data.sterilizationFeesAmount ? data.sterilizationFeesAmount.toFixed(0) : "",
    donationAmount: data.freeDonationAmount ? data.freeDonationAmount.toFixed(0) : "",
    donationReason: data.freeDonationAmount ? data.freeDonationReason ?? "" : "",
    signaturePlace: data.signaturePlace,
    signatureDate: formatDate(data.signatureDate),
  };
}

/** Which checkbox keys (src/lib/contract-fields.ts CONTRACT_CHECKBOX_FIELDS) should be marked. */
function computeActiveCheckboxes(data: AdoptionContractData): ContractCheckboxFieldKey[] {
  const active: ContractCheckboxFieldKey[] = [];
  if (data.animal.sex === "male") active.push("sexeMaleBox");
  if (data.animal.sex === "femelle") active.push("sexeFemelleBox");
  active.push(data.sterilizationDone ? "sterilizeOuiBox" : "sterilizeNonBox");
  active.push(data.healthCertificateOk ? "santeOuiBox" : "santeNonBox");
  return active;
}

// "nom" is the one field bolded in the original design — kept for visual continuity.
const BOLD_FIELDS = new Set(["nom"]);

/**
 * Fills the organization's own uploaded contract template (a flat,
 * non-fillable PDF — no AcroForm fields) by drawing text and checkbox marks
 * at the positions that organization mapped out for their document (see
 * src/app/.../parametres/contrat and ContractFieldPositions). A field with
 * no position — the org's document doesn't have it, or it hasn't been
 * mapped yet — is simply skipped rather than erroring.
 */
export async function generateAdoptionContractPdf(
  data: AdoptionContractData,
  templateBytes: Uint8Array,
  positions: ContractFieldPositions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  function drawAt(key: string, value: string, useFont: PDFFont) {
    const pos = positions[key];
    if (!pos || !value) return;
    const page = pdfDoc.getPage(pos.page);
    page.drawText(value, {
      x: pos.x,
      y: pos.y,
      size: pos.size ?? 10,
      font: useFont,
      color: rgb(0, 0, 0),
    });
  }

  const textValues = computeTextValues(data);
  for (const [key, value] of Object.entries(textValues)) {
    drawAt(key, value, BOLD_FIELDS.has(key) ? bold : font);
  }

  // "Payée en" (espèces / chèque / virement / CB) is left blank on purpose —
  // the adopter ticks the box themselves when signing, not the association.
  for (const key of computeActiveCheckboxes(data)) {
    drawAt(key, "X", bold);
  }

  return pdfDoc.save();
}

export { SEX_LABELS, SPECIES_LABELS };

/** Realistic placeholder data used to preview a field mapping before it's saved (no real candidature involved yet). */
export const SAMPLE_CONTRACT_DATA: AdoptionContractData = {
  animal: {
    name: "Filou",
    sex: "male",
    species: "chat",
    breed: "Européen",
    birthDate: "2023-04-12",
    icadNumber: "250000000000000",
    coat: "Tigré",
  },
  sterilizationDone: true,
  healthCertificateOk: true,
  adopter: {
    fullName: "Jeanne Dupont",
    address: "12 rue des Lilas",
    postalCode: "83000",
    city: "Toulon",
    phone1: "0600000000",
    phone2: "0400000000",
    email: "jeanne.dupont@example.com",
  },
  vetFeesAmount: 150,
  sterilizationFeesAmount: 80,
  freeDonationAmount: 20,
  freeDonationReason: "Soutien à l'association",
  signaturePlace: "Toulon",
  signatureDate: "2026-01-15",
};
