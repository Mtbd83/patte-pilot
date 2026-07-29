import { statusNextAction, animalStatusRank } from "@/lib/animal-care";
import type { AnimalStatus } from "@/db/schema";

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
