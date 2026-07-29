import { statusNextAction } from "@/lib/animal-care";
import type { AnimalStatus } from "@/db/schema";

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
