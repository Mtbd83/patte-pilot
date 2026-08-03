export interface AnimalRegisterRow {
  animalName: string;
  icadNumber: string;
  intakeDate: string;
  adoptionDate: string;
  icadUpdatedAt: string;
}

function csvField(value: string) {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Semicolon-delimited (not comma) and CRLF line endings — the pairing
 * Excel's French locale expects to auto-split into columns instead of
 * dumping everything into a single cell.
 */
export function buildAnimalRegisterCsv(rows: AnimalRegisterRow[]): string {
  const header = ["Animal", "N° ICAD", "Date d'entrée", "Date d'adoption", "Date de changement ICAD"];
  const lines = [header.join(";")];
  for (const row of rows) {
    lines.push(
      [row.animalName, row.icadNumber, row.intakeDate, row.adoptionDate, row.icadUpdatedAt]
        .map(csvField)
        .join(";"),
    );
  }
  return lines.join("\r\n");
}
