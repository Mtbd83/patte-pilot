import type { SterilizationNeed, ReportFinderStatus, ReportManagementStatus } from "@/db/schema";

export const STERILIZATION_NEED_LABELS: Record<SterilizationNeed, string> = {
  oui: "Oui",
  non: "Non",
  ne_sait_pas: "Ne sait pas",
};

export const REPORT_FINDER_STATUS_LABELS: Record<ReportFinderStatus, string> = {
  trouve: "Trouvé",
  perdu: "Perdu",
  errant: "Errant",
};

export const REPORT_MANAGEMENT_STATUS_LABELS: Record<ReportManagementStatus, string> = {
  en_cours: "En cours",
  pris_en_compte: "Pris en compte",
  ferme: "Fermé",
  archive: "Archivé",
};

export const REPORT_MANAGEMENT_STATUS_BADGE_VARIANT: Record<
  ReportManagementStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "info"
> = {
  en_cours: "warning",
  pris_en_compte: "info",
  ferme: "success",
  archive: "secondary",
};

/** Hex colors for the map markers, keyed by management status — kept separate from the Badge variants above since Leaflet needs raw colors, not Tailwind classes. */
export const REPORT_MANAGEMENT_STATUS_MAP_COLORS: Record<ReportManagementStatus, string> = {
  en_cours: "#d97706",
  pris_en_compte: "#2563eb",
  ferme: "#16a34a",
  archive: "#6b7280",
};
