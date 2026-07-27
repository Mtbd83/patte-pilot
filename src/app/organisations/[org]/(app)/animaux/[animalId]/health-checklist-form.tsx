"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAnimalHealthChecklist } from "@/server/actions/animals";
import type { AnimalHealthChecklist } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
  const [dewormingDone, setDewormingDone] = useState(checklist.dewormingDone);
  const [dewormingDate, setDewormingDate] = useState(checklist.dewormingDate ?? "");
  const [externalTreatmentDone, setExternalTreatmentDone] = useState(checklist.externalTreatmentDone);
  const [externalTreatmentDate, setExternalTreatmentDate] = useState(checklist.externalTreatmentDate ?? "");

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
        dewormingDone,
        dewormingDate: dewormingDate || undefined,
        externalTreatmentDone,
        externalTreatmentDate: externalTreatmentDate || undefined,
      });
      toast.success("Checklist santé mise à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const rows = [
    {
      id: "checklist-first-vaccine",
      label: "Primo vaccin fait",
      dateLabel: "Date de la primo-vaccination",
      done: firstVaccineDone,
      setDone: setFirstVaccineDone,
      date: firstVaccineDate,
      setDate: setFirstVaccineDate,
    },
    {
      id: "checklist-sterilization",
      label: "Stérilisation faite",
      dateLabel: "Date de la stérilisation",
      done: sterilizationDone,
      setDone: setSterilizationDone,
      date: sterilizationDate,
      setDate: setSterilizationDate,
    },
    {
      id: "checklist-booster",
      label: "Rappel fait",
      dateLabel: "Date du rappel",
      done: boosterDone,
      setDone: setBoosterDone,
      date: boosterDate,
      setDate: setBoosterDate,
    },
    {
      id: "checklist-deworming",
      label: "Vermifuge fait",
      dateLabel: "Date du vermifuge",
      done: dewormingDone,
      setDone: setDewormingDone,
      date: dewormingDate,
      setDate: setDewormingDate,
    },
    {
      id: "checklist-external-treatment",
      label: "Déparasitage externe fait",
      dateLabel: "Date du déparasitage externe",
      done: externalTreatmentDone,
      setDone: setExternalTreatmentDone,
      date: externalTreatmentDate,
      setDate: setExternalTreatmentDate,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Label htmlFor={row.id} className="min-w-40">
            <Checkbox id={row.id} checked={row.done} onChange={(e) => row.setDone(e.target.checked)} />
            {row.label}
          </Label>
          <Input
            type="date"
            aria-label={row.dateLabel}
            value={row.date}
            onChange={(e) => row.setDate(e.target.value)}
            className="w-40"
          />
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer la checklist
        </Button>
      </div>
    </form>
  );
}
