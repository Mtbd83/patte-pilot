import type { OrgPermission } from "@/db/schema";

export const PERMISSION_LABELS: Record<OrgPermission, string> = {
  prise_en_charge: "Prise en charge",
  comptabilite: "Comptabilité",
  candidature: "Candidature",
  contrat: "Contrat",
  gestion_famille_accueil: "Gestion famille d'accueil",
  campagne_sterilisation: "Campagne stérilisation",
};

export const PERMISSION_DESCRIPTIONS: Record<OrgPermission, string> = {
  prise_en_charge:
    "Ajouter des animaux et modifier toutes leurs informations ; attribuer une famille d'accueil déjà existante.",
  comptabilite:
    "Accès complet à la comptabilité (ajout, modification, lecture) ainsi qu'aux informations comptables sur les fiches animaux.",
  candidature:
    "Accès à l'ensemble d'une candidature d'adoption, hors envoi du certificat d'engagement et du contrat.",
  contrat:
    "En plus de Candidature : envoi du certificat d'engagement et du contrat d'adoption. Nécessite le droit Candidature.",
  gestion_famille_accueil:
    "Ajouter, modifier ou supprimer une famille d'accueil, et gérer l'historique de ses placements.",
  campagne_sterilisation:
    "Accès à l'onglet Campagne de stérilisation, limité aux campagnes auxquelles un·e admin l'a assigné·e.",
};
