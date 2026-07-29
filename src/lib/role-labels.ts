import type { OrgRole } from "@/db/schema";

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Administrateur·rice",
  benevole: "Bénévole",
  famille_accueil: "Famille d'accueil",
};
