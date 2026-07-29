import type { Animal, AnimalHealthChecklist, AnimalStatus } from "@/db/schema";

/**
 * Display/triage order for animal lists — not alphabetical, not by status
 * enum declaration order, but by how actively an animal needs attention:
 * animals out in the world (foster/quarantine/care/visit/reserved) first,
 * closed-out ones (adopted/archived) last.
 */
export const ANIMAL_STATUS_ORDER: readonly AnimalStatus[] = [
  "en_famille_accueil",
  "a_l_adoption",
  "quarantaine",
  "en_soins",
  "visite_en_cours",
  "reserve",
  "adopte",
  "archive",
];

export function animalStatusRank(status: AnimalStatus): number {
  const rank = ANIMAL_STATUS_ORDER.indexOf(status);
  return rank === -1 ? ANIMAL_STATUS_ORDER.length : rank;
}

const BOOSTER_DELAY_DAYS = 30; // "1 mois après la primo-vaccination"

/** The expected booster ("rappel") date, one month after the first vaccine — only meaningful once the first vaccine is actually done. */
export function boosterDueDate(checklist: Pick<AnimalHealthChecklist, "firstVaccineDone" | "firstVaccineDate">): string | null {
  if (!checklist.firstVaccineDone || !checklist.firstVaccineDate) return null;
  const due = new Date(checklist.firstVaccineDate);
  due.setDate(due.getDate() + BOOSTER_DELAY_DAYS);
  return due.toISOString().slice(0, 10);
}

/** Statuses where the association is no longer the one responsible for the animal's care — the adopter takes it from here. */
const STATUSES_WITHOUT_BOOSTER_REMINDER: readonly AnimalStatus[] = ["adopte", "archive"];

/** True once the first vaccine is done but the booster itself still isn't — the booster is "owed" regardless of whether its due date has passed yet. Never true once adopted/archived: it's the adopter's responsibility from then on. */
export function isBoosterOwed(
  checklist: Pick<AnimalHealthChecklist, "firstVaccineDone" | "boosterDone">,
  status?: AnimalStatus,
): boolean {
  if (status && STATUSES_WITHOUT_BOOSTER_REMINDER.includes(status)) return false;
  return checklist.firstVaccineDone && !checklist.boosterDone;
}

/** Owed AND past its expected due date — the case that should be flagged in red. */
export function isBoosterOverdue(
  checklist: Pick<AnimalHealthChecklist, "firstVaccineDone" | "firstVaccineDate" | "boosterDone">,
  status?: AnimalStatus,
): boolean {
  if (!isBoosterOwed(checklist, status)) return false;
  const due = boosterDueDate(checklist);
  if (!due) return false;
  return due < new Date().toISOString().slice(0, 10);
}

/** Owed, due within the next `days` (defaults to 14), whether or not it's already overdue. */
export function isBoosterDueWithin(
  checklist: Pick<AnimalHealthChecklist, "firstVaccineDone" | "firstVaccineDate" | "boosterDone">,
  days = 14,
  status?: AnimalStatus,
): boolean {
  if (!isBoosterOwed(checklist, status)) return false;
  const due = boosterDueDate(checklist);
  if (!due) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return due <= limit.toISOString().slice(0, 10);
}

export interface NextAction {
  label: string;
  urgent: boolean;
}

/**
 * What an admin should do next for this animal, derived from its status
 * (and, for "adopte", whether the ICAD change was actually recorded). The
 * booster reminder is checked separately by the caller — it can apply on
 * top of any of these.
 */
export function statusNextAction(
  animal: Pick<Animal, "status" | "icadUpdatedAt">,
): NextAction | null {
  switch (animal.status) {
    case "en_famille_accueil":
      return { label: "Créer l'annonce", urgent: false };
    case "a_l_adoption":
      return { label: "Trouver un·e adoptant·e", urgent: false };
    case "adopte":
      return animal.icadUpdatedAt
        ? null
        : { label: "Changer le n° ICAD", urgent: false };
    default:
      return null;
  }
}
