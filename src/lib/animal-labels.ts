import type { AnimalSex, AnimalSpecies, AnimalStatus } from "@/db/schema";

export const SPECIES_LABELS: Record<AnimalSpecies, string> = {
  chat: "Chat",
  chien: "Chien",
  lapin: "Lapin",
  autre: "Autre",
};

export const SEX_LABELS: Record<AnimalSex, string> = {
  male: "Mâle",
  femelle: "Femelle",
  inconnu: "Inconnu",
};

export const STATUS_LABELS: Record<AnimalStatus, string> = {
  quarantaine: "En quarantaine",
  en_soins: "En soins",
  en_famille_accueil: "En famille d'accueil",
  visite_en_cours: "Visite en cours",
  reserve: "Réservé",
  adopte: "Adopté",
  archive: "Archivé",
};

export const STATUS_BADGE_VARIANT: Record<
  AnimalStatus,
  "default" | "secondary" | "outline" | "success" | "warning"
> = {
  quarantaine: "warning",
  en_soins: "warning",
  en_famille_accueil: "default",
  visite_en_cours: "default",
  reserve: "default",
  adopte: "success",
  archive: "secondary",
};
