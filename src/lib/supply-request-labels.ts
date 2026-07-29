import type { SupplyRequestCategory, SupplyRequestStatus } from "@/db/schema";

export const SUPPLY_REQUEST_CATEGORY_LABELS: Record<SupplyRequestCategory, string> = {
  croquettes_chat: "Croquettes chat",
  croquettes_chien: "Croquettes chien",
  litiere: "Litière",
  bac_litiere: "Bac à litière",
  cage_transport_chat: "Cage de transport chat",
  cage_transport_chien: "Cage de transport chien",
  griffoir: "Griffoir",
  panier: "Panier",
  autre: "Autre",
};

export const SUPPLY_REQUEST_STATUS_LABELS: Record<SupplyRequestStatus, string> = {
  en_cours: "En cours",
  pris_en_compte: "Pris en compte",
};
