"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAnimalHealthChecklist } from "@/server/actions/animals";
import type { AnimalHealthChecklist } from "@/db/schema";

export function HealthChecklistForm({
  organizationId,
  animalId,
  checklist,
}: {
  organizationId: string;
  animalId: string;
  checklist: AnimalHealthChecklist;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstVaccineDone, setFirstVaccineDone] = useState(checklist.firstVaccineDone);
  const [firstVaccineDate, setFirstVaccineDate] = useState(checklist.firstVaccineDate ?? "");
  const [sterilizationDone, setSterilizationDone] = useState(checklist.sterilizationDone);
  const [sterilizationDate, setSterilizationDate] = useState(checklist.sterilizationDate ?? "");
  const [boosterDone, setBoosterDone] = useState(checklist.boosterDone);
  const [boosterDate, setBoosterDate] = useState(checklist.boosterDate ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateAnimalHealthChecklist({
        animalId,
        organizationId,
        firstVaccineDone,
        firstVaccineDate: firstVaccineDate || undefined,
        sterilizationDone,
        sterilizationDate: sterilizationDate || undefined,
        boosterDone,
        boosterDate: boosterDate || undefined,
      });
      toast.success("Checklist santé mise à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <label htmlFor="checklist-first-vaccine">
          <input
            id="checklist-first-vaccine"
            type="checkbox"
            checked={firstVaccineDone}
            onChange={(e) => setFirstVaccineDone(e.target.checked)}
          />
          Primo vaccin fait
        </label>
        <label htmlFor="checklist-first-vaccine-date">
          Date
          <input
            id="checklist-first-vaccine-date"
            type="date"
            value={firstVaccineDate}
            onChange={(e) => setFirstVaccineDate(e.target.value)}
            style={{ display: "block" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <label htmlFor="checklist-sterilization">
          <input
            id="checklist-sterilization"
            type="checkbox"
            checked={sterilizationDone}
            onChange={(e) => setSterilizationDone(e.target.checked)}
          />
          Stérilisation faite
        </label>
        <label htmlFor="checklist-sterilization-date">
          Date
          <input
            id="checklist-sterilization-date"
            type="date"
            value={sterilizationDate}
            onChange={(e) => setSterilizationDate(e.target.value)}
            style={{ display: "block" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <label htmlFor="checklist-booster">
          <input
            id="checklist-booster"
            type="checkbox"
            checked={boosterDone}
            onChange={(e) => setBoosterDone(e.target.checked)}
          />
          Rappel fait
        </label>
        <label htmlFor="checklist-booster-date">
          Date
          <input
            id="checklist-booster-date"
            type="date"
            value={boosterDate}
            onChange={(e) => setBoosterDate(e.target.value)}
            style={{ display: "block" }}
          />
        </label>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div>
        <button type="submit" disabled={pending}>
          Enregistrer la checklist
        </button>
      </div>
    </form>
  );
}
