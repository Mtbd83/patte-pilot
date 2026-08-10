import {
  statusNextAction,
  animalStatusRank,
  boosterDueDate,
  isBoosterOwed,
  isBoosterOverdue,
  isBoosterDueWithin,
} from "@/lib/animal-care";
import type { AnimalStatus } from "@/db/schema";

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("animalStatusRank", () => {
  it("orders statuses à l'adoption, en famille d'accueil, quarantaine, en soins, visite, réservé, adopté, archivé", () => {
    const order: AnimalStatus[] = [
      "a_l_adoption",
      "en_famille_accueil",
      "quarantaine",
      "en_soins",
      "visite_en_cours",
      "reserve",
      "adopte",
      "archive",
    ];
    const ranks = order.map(animalStatusRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // Strictly increasing — no ties within the listed statuses.
    expect(new Set(ranks).size).toBe(order.length);
  });
});

describe("statusNextAction", () => {
  it("suggests nothing while in quarantine", () => {
    expect(statusNextAction({ status: "quarantaine", icadUpdatedAt: null })).toBeNull();
  });

  it("suggests creating the listing once placed with a foster family", () => {
    expect(statusNextAction({ status: "en_famille_accueil", icadUpdatedAt: null })).toEqual({
      label: "Créer l'annonce",
      urgent: false,
    });
  });

  it("suggests finding an adopter once up for adoption", () => {
    expect(statusNextAction({ status: "a_l_adoption", icadUpdatedAt: null })).toEqual({
      label: "Trouver un·e adoptant·e",
      urgent: false,
    });
  });

  it("suggests updating the ICAD number after adoption, until it's done", () => {
    expect(statusNextAction({ status: "adopte", icadUpdatedAt: null })).toEqual({
      label: "Changer le n° ICAD",
      urgent: false,
    });
    expect(statusNextAction({ status: "adopte", icadUpdatedAt: "2026-01-15" })).toBeNull();
  });

  it.each<AnimalStatus>(["en_soins", "visite_en_cours", "reserve", "archive"])(
    "suggests nothing for %s",
    (status) => {
      expect(statusNextAction({ status, icadUpdatedAt: null })).toBeNull();
    },
  );
});

describe("booster ('rappel') scheduling", () => {
  it("is due one month after the first vaccine, before the first booster is done", () => {
    const checklist = {
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-10),
      boosterDone: false,
      boosterDate: null,
    };
    expect(boosterDueDate(checklist)).toBe(isoDaysFromNow(20));
    expect(isBoosterOwed(checklist)).toBe(true);
  });

  it("keeps recurring every year for as long as the animal isn't adopted/archived", () => {
    const boosterDate = isoDaysFromNow(-355);
    const expectedDue = (() => {
      const d = new Date(boosterDate);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    })();
    const checklist = {
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-400),
      boosterDone: true,
      boosterDate,
    };

    expect(boosterDueDate(checklist)).toBe(expectedDue);
    expect(isBoosterOwed(checklist, "en_famille_accueil")).toBe(true);
    expect(isBoosterDueWithin(checklist, 14, "en_famille_accueil")).toBe(true);

    // Once adopted (or archived), it's no longer the association's concern.
    expect(isBoosterOwed(checklist, "adopte")).toBe(false);
    expect(isBoosterDueWithin(checklist, 14, "adopte")).toBe(false);
  });

  it("is null once booster is marked done but its date is missing", () => {
    expect(
      boosterDueDate({
        firstVaccineDone: true,
        firstVaccineDate: isoDaysFromNow(-400),
        boosterDone: true,
        boosterDate: null,
      }),
    ).toBeNull();
  });

  it("flags overdue only once the (first or recurring) due date has actually passed", () => {
    const notYetOverdue = {
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-10),
      boosterDone: false,
      boosterDate: null,
    };
    expect(isBoosterOverdue(notYetOverdue)).toBe(false);

    const recurringOverdue = {
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-400),
      boosterDone: true,
      boosterDate: isoDaysFromNow(-370), // due date was 5 days ago
    };
    expect(isBoosterOverdue(recurringOverdue)).toBe(true);
  });
});
