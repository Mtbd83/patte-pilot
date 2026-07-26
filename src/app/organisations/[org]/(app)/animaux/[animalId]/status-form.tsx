"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeAnimalStatus } from "@/server/actions/animals";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { STATUS_LABELS } from "@/lib/animal-labels";
import type { AnimalStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [AnimalStatus, string][];

interface FosterFamilyOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function StatusForm({
  organizationId,
  animalId,
  currentStatus,
  currentFosterFamilyId,
  fosterFamilies,
}: {
  organizationId: string;
  animalId: string;
  currentStatus: AnimalStatus;
  currentFosterFamilyId: string | null;
  fosterFamilies: FosterFamilyOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<AnimalStatus>(currentStatus);
  const [fosterFamilyId, setFosterFamilyId] = useState(currentFosterFamilyId ?? "");
  const [adoptionDate, setAdoptionDate] = useState(() => new Date().toISOString().slice(0, 10));

  const needsFosterFamily = statusRequiresFosterFamily(status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsFosterFamily && !fosterFamilyId) {
      setError("Une famille d'accueil est requise pour ce statut.");
      return;
    }

    setPending(true);
    try {
      await changeAnimalStatus({
        animalId,
        organizationId,
        status,
        fosterFamilyId: needsFosterFamily ? fosterFamilyId : undefined,
        adoptionDate: status === "adopte" ? adoptionDate : undefined,
      });
      toast.success("Statut mis à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Statut" htmlFor="status-select">
        <Select id="status-select" value={status} onChange={(e) => setStatus(e.target.value as AnimalStatus)}>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {needsFosterFamily && (
        <Field label="Famille d'accueil" htmlFor="status-foster-family">
          <Select
            id="status-foster-family"
            required
            value={fosterFamilyId}
            onChange={(e) => setFosterFamilyId(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {fosterFamilies.map((family) => (
              <option key={family.id} value={family.id}>
                {family.firstName} {family.lastName}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {status === "adopte" && (
        <Field label="Date d'adoption" htmlFor="status-adoption-date">
          <Input
            id="status-adoption-date"
            type="date"
            value={adoptionDate}
            onChange={(e) => setAdoptionDate(e.target.value)}
          />
        </Field>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Changer le statut
        </Button>
      </div>
    </form>
  );
}
