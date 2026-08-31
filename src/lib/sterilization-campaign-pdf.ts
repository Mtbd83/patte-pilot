import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28; // A4 portrait, in points.
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const ROW_HEIGHT = 18;
const FOOTER_TEXT = "Généré par PattePilot";
const FOOTER_ICON_HEIGHT = 14;

const COLUMNS = [
  { label: "N° de bon", width: 90 },
  { label: "N° d'identification", width: 180 },
  { label: "Date", width: 100 },
  { label: "Genre", width: 90 },
] as const;

export interface SterilizationVoucherRow {
  voucherNumber: string;
  identificationNumber: string;
  date: string;
  sex: string;
}

export interface SterilizationCampaignPdfInfo {
  organizationName: string;
  city: string;
  partnerLabel: string;
  vetName: string;
  vetAddress: string | null;
  vetPhone: string | null;
  voucherQuotaTotal: number;
  voucherQuotaMale: number | null;
  voucherQuotaFemale: number | null;
  usedCount: number;
  usedMale: number;
  usedFemale: number;
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

/** One sterilization campaign, its info as a header block, then its logged vouchers as a table. */
export async function generateSterilizationCampaignPdf({
  info,
  rows,
}: {
  info: SterilizationCampaignPdfInfo;
  rows: SterilizationVoucherRow[];
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

  function drawLineOfText(text: string, size: number, targetFont: PDFFont, color = rgb(0, 0, 0)) {
    page.drawText(text, { x: MARGIN, y, size, font: targetFont, color });
    y -= size + 6;
  }

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

  // --- Header: the campaign's own info ---
  drawLineOfText(`Campagne de stérilisation — ${info.city}`, 16, bold);
  drawLineOfText(`${info.organizationName} · Partenaire : ${info.partnerLabel}`, 10, font, rgb(0.4, 0.4, 0.4));

  const vetLine = [info.vetName, info.vetAddress, info.vetPhone].filter(Boolean).join(" · ");
  drawLineOfText(`Vétérinaire : ${vetLine}`, 10, font, rgb(0.4, 0.4, 0.4));

  const quotaLine =
    info.voucherQuotaMale != null && info.voucherQuotaFemale != null
      ? `Quota : ${info.voucherQuotaTotal} bons (dont ${info.voucherQuotaMale} mâles, ${info.voucherQuotaFemale} femelles prévus)`
      : `Quota : ${info.voucherQuotaTotal} bons`;
  drawLineOfText(quotaLine, 10, font, rgb(0.4, 0.4, 0.4));

  drawLineOfText(
    `Bons utilisés : ${info.usedCount} / ${info.voucherQuotaTotal} — ${info.usedMale} mâle(s), ${info.usedFemale} femelle(s)`,
    10,
    font,
    rgb(0.4, 0.4, 0.4),
  );
  y -= 12;

  drawColumnHeaders();

  if (rows.length === 0) {
    page.drawText("Aucun bon enregistré pour cette campagne.", { x: MARGIN, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
  }

  for (const row of rows) {
    if (y < MARGIN + ROW_HEIGHT) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN;
      drawColumnHeaders();
    }

    let x = MARGIN;
    const values = [row.voucherNumber, row.identificationNumber, row.date, row.sex];
    for (const [i, col] of COLUMNS.entries()) {
      const text = fitText(values[i] ?? "", col.width - 6, font, 8);
      page.drawText(text, { x, y, size: 8, font });
      x += col.width;
    }
    y -= ROW_HEIGHT;
  }

  return pdfDoc.save();
}
