import type { AdoptionApplicationStatus } from "@/db/schema";

export const ADOPTION_STATUS_LABELS: Record<AdoptionApplicationStatus, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  retenu: "Retenue",
  refuse: "Refusée",
  retire: "Retirée",
};

export const ADOPTION_STATUS_BADGE_VARIANT: Record<
  AdoptionApplicationStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "info" | "destructive"
> = {
  en_attente: "warning",
  en_cours: "info",
  retenu: "success",
  refuse: "destructive",
  retire: "secondary",
};

/** Row background per status, so the candidatures table is scannable at a glance. */
export const ADOPTION_STATUS_ROW_CLASS: Record<AdoptionApplicationStatus, string> = {
  en_attente: "",
  en_cours: "bg-sky-50 dark:bg-sky-500/10",
  retenu: "bg-emerald-50 dark:bg-emerald-500/10",
  refuse: "bg-red-50 dark:bg-red-500/10",
  retire: "bg-secondary/60",
};
