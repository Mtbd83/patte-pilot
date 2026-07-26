import type { AccountingCategory, AccountingType } from "@/db/schema";

export const ACCOUNTING_TYPE_LABELS: Record<AccountingType, string> = {
  entree: "Entrée",
  sortie: "Sortie",
};

export const ACCOUNTING_CATEGORY_LABELS: Record<AccountingCategory, string> = {
  nourriture: "Nourriture",
  veterinaire: "Vétérinaire",
  equipement: "Équipement",
  autre: "Autre",
};
