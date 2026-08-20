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
  a_l_adoption: "À l'adoption",
  visite_en_cours: "Visite en cours",
  reserve: "Réservé",
  adopte: "Adopté",
  archive: "Archivé",
};

// Only the bare-adjective statuses (the others are invariant prepositional
// phrases, e.g. "En soins") agree in number — used for the "8 réservés"
// style counts on the animaux list page.
const PLURAL_STATUS_LABELS: Partial<Record<AnimalStatus, string>> = {
  reserve: "Réservés",
  adopte: "Adoptés",
  archive: "Archivés",
};

export function statusLabelForCount(status: AnimalStatus, count: number): string {
  if (count > 1 && PLURAL_STATUS_LABELS[status]) {
    return PLURAL_STATUS_LABELS[status]!;
  }
  return STATUS_LABELS[status];
}

export const STATUS_BADGE_VARIANT: Record<
  AnimalStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "info"
> = {
  quarantaine: "warning",
  en_soins: "warning",
  en_famille_accueil: "default",
  a_l_adoption: "info",
  visite_en_cours: "default",
  reserve: "default",
  adopte: "success",
  archive: "secondary",
};
