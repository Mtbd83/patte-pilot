import type { AccountingCategory, AccountingType } from "@/db/schema";

export const ACCOUNTING_TYPE_LABELS: Record<AccountingType, string> = {
  entree: "Entrée",
  sortie: "Sortie",
};

export const ACCOUNTING_CATEGORY_LABELS: Record<AccountingCategory, string> = {
  nourriture: "Nourriture",
  veterinaire: "Vétérinaire",
  equipement: "Équipement",
  frais_adoption: "Frais d'adoption",
  don: "Don",
  adhesion: "Adhésion",
  autre: "Autre",
};

/** Which categories make sense for each entry type — a "sortie" doesn't take "don", an "entree" doesn't take "veterinaire". */
export const ACCOUNTING_CATEGORIES_BY_TYPE: Record<AccountingType, AccountingCategory[]> = {
  entree: ["frais_adoption", "don", "adhesion", "autre"],
  sortie: ["nourriture", "veterinaire", "equipement", "autre"],
};

export const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
