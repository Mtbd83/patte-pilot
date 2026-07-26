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
