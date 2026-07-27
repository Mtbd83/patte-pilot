import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import type { AnimalSex, AnimalSpecies } from "@/db/schema";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "documents",
  "contrat-adoption-template.pdf",
);

// Page height of the template (A4, points) — used to convert the top-down
// coordinates measured off the template (via `pdftotext -bbox`) into
// pdf-lib's bottom-up coordinate system.
const PAGE_HEIGHT = 841.92;
function fromTop(yFromTop: number) {
  return PAGE_HEIGHT - yFromTop;
}
// The printed blank lines sit ~6pt above the baseline implied by the
// adjacent label's own text box, so text drawn straight on fromTop() reads
// as struck through by the line. Fields that fill in a blank line need this
// extra lift; checkbox marks (drawn inside a box, no line) don't.
function fromTopLine(yFromTop: number) {
  return fromTop(yFromTop) + 6;
}

/**
 * Text field positions measured off public/documents/contrat-adoption-template.pdf
 * via `pdftotext -bbox` (then converted with fromTop()/fromTopLine()); each
 * `x` sits just to the right of the printed label/blank line it fills in.
 * Checkbox centers were read directly from the PDF's content stream (`qpdf
 * --qdf`, the `re` rectangle operators) for exact placement — text-gap
 * estimates were consistently a few points off. If the template is ever
 * replaced, re-measure with the same tools and update these (render both to
 * PNG with pdftoppm and compare).
 */
const FIELDS = {
  nom: { x: 55, y: fromTopLine(214.9) },
  dateNaissance: { x: 432, y: fromTopLine(214.9) },

  icad: { x: 150, y: fromTopLine(234.3) },
  pelage: { x: 404, y: fromTopLine(234.3) },

  espece: { x: 295, y: fromTopLine(288.2) },

  adopterName: { x: 86, y: fromTopLine(327.3) },
  adopterAddress: { x: 70, y: fromTopLine(346.7) },
  adopterPostalCode: { x: 85, y: fromTopLine(376.0) },
  adopterCity: { x: 338, y: fromTopLine(376.0) },
  adopterPhone1: { x: 88, y: fromTopLine(400.5) },
  adopterPhone2: { x: 378, y: fromTopLine(400.5) },
  adopterEmail: { x: 90, y: fromTopLine(424.9) },

  vetFees: { x: 360, y: fromTopLine(449.4), size: 9 },
  sterilizationFees: { x: 254, y: fromTopLine(459.0), size: 9 },

  donationAmount: { x: 102, y: fromTopLine(493.3), size: 9 },
  donationReason: { x: 257, y: fromTopLine(493.3) },

  signaturePlace: { x: 53, y: fromTopLine(542.1) },
  signatureDate: { x: 281, y: fromTopLine(542.1) },
} as const;

/** A single glyph's draw origin (bottom-left) that centers it in an 11.3x11.3 checkbox. */
function checkboxOrigin(centerX: number, centerY: number) {
  return { x: centerX - 3.6, y: centerY - 3.6 };
}

const CHECKBOXES = {
  sexeMaleBox: checkboxOrigin(205.75, 634.4),
  sexeFemelleBox: checkboxOrigin(249.55, 635.2),
  sterilizeOuiBox: checkboxOrigin(118.35, 586.26),
  sterilizeNonBox: checkboxOrigin(161.25, 586.0),
  santeOuiBox: checkboxOrigin(158.0, 562.05),
  santeNonBox: checkboxOrigin(199.4, 561.75),
} as const;

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

/**
 * Fills the association's real contract template (a flat, non-fillable PDF
 * — no AcroForm fields) by drawing text and checkbox marks on top of it at
 * measured coordinates, rather than generating a page from scratch. This
 * keeps the association's actual letterhead, logo and layout intact.
 */
export async function generateAdoptionContractPdf(data: AdoptionContractData): Promise<Uint8Array> {
  const templateBytes = await readFile(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  function text(value: string, pos: { x: number; y: number; size?: number }, useFont: PDFFont = font) {
    if (!value) return;
    page.drawText(value, { x: pos.x, y: pos.y, size: pos.size ?? 10, font: useFont, color: rgb(0, 0, 0) });
  }

  function check(pos: { x: number; y: number }) {
    page.drawText("X", { x: pos.x, y: pos.y, size: 10, font: bold, color: rgb(0, 0, 0) });
  }

  text(data.animal.name, FIELDS.nom, bold);
  if (data.animal.sex === "male") check(CHECKBOXES.sexeMaleBox);
  if (data.animal.sex === "femelle") check(CHECKBOXES.sexeFemelleBox);
  text(formatDate(data.animal.birthDate), FIELDS.dateNaissance);

  text(data.animal.icadNumber ?? "", FIELDS.icad);
  text(data.animal.coat ?? "", FIELDS.pelage);

  check(data.sterilizationDone ? CHECKBOXES.sterilizeOuiBox : CHECKBOXES.sterilizeNonBox);
  check(data.healthCertificateOk ? CHECKBOXES.santeOuiBox : CHECKBOXES.santeNonBox);
  const especeLabel = [SPECIES_LABELS[data.animal.species], data.animal.breed]
    .filter(Boolean)
    .join(" ");
  text(especeLabel, FIELDS.espece);

  text(data.adopter.fullName, FIELDS.adopterName);
  text(data.adopter.address, FIELDS.adopterAddress);
  text(data.adopter.postalCode, FIELDS.adopterPostalCode);
  text(data.adopter.city, FIELDS.adopterCity);
  text(data.adopter.phone1, FIELDS.adopterPhone1);
  text(data.adopter.phone2 ?? "", FIELDS.adopterPhone2);
  text(data.adopter.email, FIELDS.adopterEmail);

  text(data.vetFeesAmount.toFixed(0), FIELDS.vetFees);
  if (data.sterilizationFeesAmount) {
    text(data.sterilizationFeesAmount.toFixed(0), FIELDS.sterilizationFees);
  }
  if (data.freeDonationAmount) {
    text(data.freeDonationAmount.toFixed(0), FIELDS.donationAmount);
    text(data.freeDonationReason ?? "", FIELDS.donationReason, font);
  }

  // "Payée en" (espèces / chèque / virement / CB) is left blank on purpose —
  // the adopter ticks the box themselves when signing, not the association.

  text(data.signaturePlace, FIELDS.signaturePlace);
  text(formatDate(data.signatureDate), FIELDS.signatureDate);

  return pdfDoc.save();
}

// Re-exported so labels stay available to callers that don't otherwise need
// the whole module (e.g. previously imported from here for the from-scratch
// renderer).
export { SEX_LABELS, SPECIES_LABELS };
