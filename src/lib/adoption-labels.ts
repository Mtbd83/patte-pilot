import type {
  AdoptionApplicationStatus,
  HousingType,
  HousingZone,
  LivingSituation,
  ResidencyStatus,
} from "@/db/schema";

export const ADOPTION_STATUS_LABELS: Record<AdoptionApplicationStatus, string> = {
  en_attente: "En attente",
  retenu: "Retenue",
  refuse: "Refusée",
  retire: "Retirée",
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
