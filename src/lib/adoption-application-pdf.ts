import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28; // A4 portrait, in points.
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TEXT = "Généré par PattePilot";
const FOOTER_ICON_HEIGHT = 14;
const LABEL_COLOR = rgb(0.4, 0.4, 0.4);
const VALUE_COLOR = rgb(0.1, 0.1, 0.1);

export interface AdoptionApplicationPdfInfo {
  organizationName: string;
  applicantName: string;
  statusLabel: string;
  submittedOn: string;
  city: string;
  phone: string;
  email: string;
  age: number | null;
  spouseAge: number | null;
  profession: string | null;
  spouseProfession: string | null;
}

export interface AdoptionApplicationPdfSection {
  title: string;
  rows: { label: string; value: string }[];
}

/** Splits `text` into lines that each fit within `maxWidth` at the given font/size — pdf-lib has no built-in wrapping. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let currentLine = "";
    for (const word of paragraph.split(" ")) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

/** One adoption application ("candidature"), formatted for sharing outside the app — same content as its detail page. */
export async function generateAdoptionApplicationPdf({
  info,
  sections,
}: {
  info: AdoptionApplicationPdfInfo;
  sections: AdoptionApplicationPdfSection[];
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

  /** Starts a new page (with footer) if there isn't room left for `neededHeight` above the margin. */
  function ensureSpace(neededHeight: number) {
    if (y - neededHeight < MARGIN) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawHeading(text: string, size: number, targetFont: PDFFont, color = rgb(0, 0, 0)) {
    ensureSpace(size + 6);
    page.drawText(text, { x: MARGIN, y, size, font: targetFont, color });
    y -= size + 6;
  }

  /** Label (small, gray) above its value (wrapped as needed) — handles both short fields and long free-text answers gracefully. */
  function drawField(label: string, value: string) {
    const labelSize = 9;
    const valueSize = 11;
    const valueLines = wrapText(value || "—", font, valueSize, CONTENT_WIDTH);
    const blockHeight = labelSize + 4 + valueLines.length * (valueSize + 3) + 8;

    ensureSpace(blockHeight);
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: labelSize, font: bold, color: LABEL_COLOR });
    y -= labelSize + 5;
    for (const line of valueLines) {
      ensureSpace(valueSize + 3);
      page.drawText(line, { x: MARGIN, y, size: valueSize, font, color: VALUE_COLOR });
      y -= valueSize + 3;
    }
    y -= 8;
  }

  function drawSectionTitle(title: string) {
    ensureSpace(30);
    y -= 6;
    page.drawText(title, { x: MARGIN, y, size: 13, font: bold, color: rgb(0, 0, 0) });
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.75,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 16;
  }

  // --- Header ---
  drawHeading(`Candidature d'adoption — ${info.applicantName}`, 18, bold);
  drawHeading(
    `${info.organizationName} · Déposée le ${info.submittedOn} · Statut : ${info.statusLabel}`,
    10,
    font,
    LABEL_COLOR,
  );
  y -= 10;

  // --- Coordonnées ---
  drawSectionTitle("Coordonnées");
  drawField("Ville", info.city || "—");
  drawField("Téléphone", info.phone);
  drawField("Email", info.email);
  drawField("Âge", info.age != null ? `${info.age}${info.spouseAge ? ` (conjoint·e : ${info.spouseAge})` : ""}` : "—");
  if (info.profession || info.spouseProfession) {
    drawField(
      "Profession",
      `${info.profession || "—"}${info.spouseProfession ? ` (conjoint·e : ${info.spouseProfession})` : ""}`,
    );
  }

  // --- Every section (souhait d'adoption, logement/foyer/animaux/quotidien, libres), already resolved by the caller ---
  for (const section of sections) {
    if (section.rows.length === 0) continue;
    drawSectionTitle(section.title);
    for (const row of section.rows) {
      drawField(row.label, row.value);
    }
  }

  return pdfDoc.save();
}
