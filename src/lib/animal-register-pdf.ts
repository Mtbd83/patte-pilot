import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 841.89; // A4 landscape, in points.
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const ROW_HEIGHT = 18;
const FOOTER_TEXT = "Généré par PattePilot";
const FOOTER_ICON_HEIGHT = 14;

const COLUMNS = [
  { label: "Animal", width: 160 },
  { label: "N° ICAD", width: 140 },
  { label: "Date d'entrée", width: 110 },
  { label: "Date d'adoption", width: 110 },
  { label: "Date de changement ICAD", width: 160 },
] as const;

export interface AnimalRegisterRow {
  animalName: string;
  icadNumber: string;
  intakeDate: string;
  adoptionDate: string;
  icadUpdatedAt: string;
}

/** Truncates text with an ellipsis so it never overruns its column's width. */
function fitText(text: string, maxWidth: number, font: PDFFont, size: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/**
 * The legally-required "registre d'entrée et de sortie des animaux" —
 * every animal, its ICAD number, when it came in, when (if) it was
 * adopted, and when its ICAD registration was last updated.
 */
export async function generateAnimalRegisterPdf({
  organizationName,
  periodDescription,
  rows,
}: {
  organizationName: string;
  periodDescription: string;
  rows: AnimalRegisterRow[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const iconBytes = await readFile(path.join(process.cwd(), "public", "icon_192_192.png"));
  const icon = await pdfDoc.embedPng(iconBytes);

  function drawFooter(target: PDFPage) {
    const iconWidth = (FOOTER_ICON_HEIGHT / icon.height) * icon.width;
    const textWidth = font.widthOfTextAtSize(FOOTER_TEXT, 8);
    const gap = 5;
    const totalWidth = textWidth + gap + iconWidth;
    const footerY = MARGIN / 2 - FOOTER_ICON_HEIGHT / 2;

    target.drawText(FOOTER_TEXT, {
      x: PAGE_WIDTH - MARGIN - totalWidth,
      y: footerY + (FOOTER_ICON_HEIGHT - 8) / 2,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.55),
    });
    target.drawImage(icon, {
      x: PAGE_WIDTH - MARGIN - iconWidth,
      y: footerY,
      width: iconWidth,
      height: FOOTER_ICON_HEIGHT,
    });
  }

  function addPage() {
    const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawFooter(newPage);
    return newPage;
  }

  let page = addPage();
  let y = PAGE_HEIGHT - MARGIN;

  function drawColumnHeaders() {
    let x = MARGIN;
    for (const col of COLUMNS) {
      page.drawText(col.label, { x, y, size: 9, font: bold, color: rgb(0.35, 0.35, 0.35) });
      x += col.width;
    }
    y -= 12;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 14;
  }

  page.drawText(`Registre de placement — ${organizationName}`, { x: MARGIN, y, size: 16, font: bold });
  y -= 20;
  page.drawText(periodDescription, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 26;

  drawColumnHeaders();

  if (rows.length === 0) {
    page.drawText("Aucun animal pour cette période.", { x: MARGIN, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
  }

  for (const row of rows) {
    if (y < MARGIN + ROW_HEIGHT) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN;
      drawColumnHeaders();
    }

    let x = MARGIN;
    const values = [row.animalName, row.icadNumber, row.intakeDate, row.adoptionDate, row.icadUpdatedAt];
    for (const [i, col] of COLUMNS.entries()) {
      const text = fitText(values[i] ?? "", col.width - 6, font, 8);
      page.drawText(text, { x, y, size: 8, font });
      x += col.width;
    }
    y -= ROW_HEIGHT;
  }

  return pdfDoc.save();
}
