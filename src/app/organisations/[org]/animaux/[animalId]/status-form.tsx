"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeAnimalStatus } from "@/server/actions/animals";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { STATUS_LABELS } from "@/lib/animal-labels";
import type { AnimalStatus } from "@/db/schema";

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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label htmlFor="status-select">Statut</label>
        <select
          id="status-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as AnimalStatus)}
          style={{ display: "block", width: "100%" }}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {needsFosterFamily && (
        <div>
          <label htmlFor="status-foster-family">Famille d&apos;accueil</label>
          <select
            id="status-foster-family"
            required
            value={fosterFamilyId}
            onChange={(e) => setFosterFamilyId(e.target.value)}
            style={{ display: "block", width: "100%" }}
          >
            <option value="">— Sélectionner —</option>
            {fosterFamilies.map((family) => (
              <option key={family.id} value={family.id}>
                {family.firstName} {family.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {status === "adopte" && (
        <label htmlFor="status-adoption-date">
          Date d&apos;adoption
          <input
            id="status-adoption-date"
            type="date"
            value={adoptionDate}
            onChange={(e) => setAdoptionDate(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div>
        <button type="submit" disabled={pending}>
          Changer le statut
        </button>
      </div>
    </form>
  );
}
