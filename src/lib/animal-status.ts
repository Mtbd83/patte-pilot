import type { AnimalStatus } from "@/db/schema";

/**
 * Statuses during which an animal must be physically hosted somewhere and is
 * therefore expected to carry a foster family link (animals.currentFosterFamilyId).
 * "adopte" and "archive" close out the animal's current placement instead.
 */
export const STATUSES_REQUIRING_FOSTER_FAMILY: readonly AnimalStatus[] = [
  "quarantaine",
  "en_soins",
  "en_famille_accueil",
  "visite_en_cours",
  "reserve",
];

export function statusRequiresFosterFamily(status: AnimalStatus): boolean {
  return STATUSES_REQUIRING_FOSTER_FAMILY.includes(status);
}
