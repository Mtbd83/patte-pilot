import type { SterilizationPartner } from "@/db/schema";

export const STERILIZATION_PARTNER_LABELS: Record<SterilizationPartner, string> = {
  spa: "SPA",
  fondation_brigitte_bardot: "Fondation Brigitte Bardot",
  trente_millions_damis: "30 Millions d'Amis",
  autre: "Autre",
};

/** Only the two sexes a voucher can be logged under — never "inconnu". */
export const VOUCHER_SEX_LABELS = {
  male: "Mâle",
  femelle: "Femelle",
} as const;
