export interface AccountingExportRow {
  date: string;
  typeLabel: string;
  categoryLabel: string;
  amountLabel: string;
  animalName: string;
  comment: string;
}

function csvField(value: string) {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Semicolon-delimited (not comma) and CRLF line endings — the pairing
 * Excel's French locale expects to auto-split into columns instead of
 * dumping everything into a single cell.
 */
export function buildAccountingExportCsv(rows: AccountingExportRow[]): string {
  const header = ["Date", "Type", "Catégorie", "Montant", "Animal", "Commentaire"];
  const lines = [header.join(";")];
  for (const row of rows) {
    lines.push(
      [row.date, row.typeLabel, row.categoryLabel, row.amountLabel, row.animalName, row.comment]
        .map(csvField)
        .join(";"),
    );
  }
  return lines.join("\r\n");
}
