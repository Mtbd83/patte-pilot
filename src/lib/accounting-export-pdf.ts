import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 841.89; // A4 landscape, in points — six columns need the extra room.
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const ROW_HEIGHT = 18;
const FOOTER_TEXT = "Généré par PattePilot";
const FOOTER_ICON_HEIGHT = 14;

const COLUMNS = [
  { label: "Date", width: 70 },
  { label: "Type", width: 60 },
  { label: "Catégorie", width: 110 },
  { label: "Montant", width: 80 },
  { label: "Animal", width: 130 },
  { label: "Commentaire", width: 250 },
] as const;

export interface AccountingExportRow {
  date: string;
  typeLabel: string;
  categoryLabel: string;
  amountLabel: string;
  animalName: string;
  comment: string;
}

export interface AccountingExportSummary {
  totalIn: string;
  totalOut: string;
  balance: string;
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

/** A fresh, from-scratch tabular PDF (not a filled template) for exporting the filtered entry list. */
export async function generateAccountingExportPdf({
  organizationName,
  filterDescription,
  summary,
  rows,
}: {
  organizationName: string;
  filterDescription: string;
  summary: AccountingExportSummary;
  rows: AccountingExportRow[];
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

  page.drawText(`Comptabilité — ${organizationName}`, { x: MARGIN, y, size: 16, font: bold });
  y -= 20;
  page.drawText(filterDescription, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 22;

  const statY = y;
  page.drawText(`Total entrées : ${summary.totalIn} €`, { x: MARGIN, y: statY, size: 11, font: bold });
  page.drawText(`Total sorties : ${summary.totalOut} €`, { x: MARGIN + 220, y: statY, size: 11, font: bold });
  page.drawText(`Solde : ${summary.balance} €`, { x: MARGIN + 440, y: statY, size: 11, font: bold });
  y -= 28;

  drawColumnHeaders();

  if (rows.length === 0) {
    page.drawText("Aucune écriture pour ces filtres.", { x: MARGIN, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
  }

  for (const row of rows) {
    if (y < MARGIN + ROW_HEIGHT) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN;
      drawColumnHeaders();
    }

    let x = MARGIN;
    const values = [row.date, row.typeLabel, row.categoryLabel, row.amountLabel, row.animalName, row.comment];
    for (const [i, col] of COLUMNS.entries()) {
      const text = fitText(values[i] ?? "", col.width - 6, font, 8);
      page.drawText(text, { x, y, size: 8, font });
      x += col.width;
    }
    y -= ROW_HEIGHT;
  }

  return pdfDoc.save();
}
