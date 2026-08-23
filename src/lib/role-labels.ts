import type { OrgRole } from "@/db/schema";

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Administrateur·rice",
  benevole: "Bénévole",
  famille_accueil: "Famille d'accueil",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  admin: "Accès complet à toutes les fonctionnalités de l'association, y compris la gestion des membres.",
  benevole: "Accès en lecture à tout par défaut ; les droits d'action se cochent individuellement ci-dessous.",
  famille_accueil: "Accès à ses propres animaux hébergés, à leur checklist santé et à ses demandes de matériel.",
};
