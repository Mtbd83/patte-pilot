import type {
  AdoptionApplicationStatus,
  HousingType,
  HousingZone,
  LivingSituation,
  ResidencyStatus,
  ActivityLevel,
  AloneTime,
} from "@/db/schema";

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

export const HOUSING_ZONE_LABELS: Record<HousingZone, string> = {
  urbaine: "Urbaine",
  peri_urbaine: "Péri-urbaine",
  rurale: "Rurale",
};

export const HOUSING_TYPE_LABELS: Record<HousingType, string> = {
  maison: "Maison",
  appartement: "Appartement",
  autre: "Autre",
};

export const RESIDENCY_STATUS_LABELS: Record<ResidencyStatus, string> = {
  proprietaire: "Propriétaire",
  locataire: "Locataire",
};

export const LIVING_SITUATION_LABELS: Record<LivingSituation, string> = {
  seul: "Seul·e",
  en_couple: "En couple",
  colocation: "En colocation",
  en_famille: "En famille",
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  intense: "Intense",
  modere: "Modéré",
  faible: "Faible",
};

export const ALONE_TIME_LABELS: Record<AloneTime, string> = {
  presque_aucune: "Presque aucune",
  moins_2h: "- de 2h",
  "2h_4h": "2h à 4h",
  "4h_6h": "4h à 6h",
  "8h_plus": "8h ou plus",
};
