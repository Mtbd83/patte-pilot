"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeAnimalStatus } from "@/server/actions/animals";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { STATUS_LABELS } from "@/lib/animal-labels";
import type { AnimalStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { NewFosterFamilyModal } from "../../familles-accueil/new-foster-family-modal";

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
  const [placementChangeDate, setPlacementChangeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [familyOptions, setFamilyOptions] = useState(fosterFamilies);
  const [newFamilyModalOpen, setNewFamilyModalOpen] = useState(false);

  const needsFosterFamily = statusRequiresFosterFamily(status);
  const nextFosterFamilyId = needsFosterFamily ? fosterFamilyId || null : null;
  // Only relevant when this submit will actually close the current
  // placement for a reason other than adoption (a genuine family change,
  // or ending care via "archive") — mirrors the server's own condition.
  const showPlacementChangeDate =
    status !== "adopte" && currentFosterFamilyId !== null && currentFosterFamilyId !== nextFosterFamilyId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Only the submit button being disabled isn't enough to stop a
    // re-submission — e.g. pressing Enter in one of the date fields below
    // still fires this handler directly. Without this guard, a second
    // request could fire while the first is still in flight.
    if (pending) return;
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
        placementChangeDate: showPlacementChangeDate ? placementChangeDate : undefined,
      });
      toast.success("Statut mis à jour");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Statut" htmlFor="status-select">
        <Select
          id="status-select"
          value={status}
          disabled={pending}
          onChange={(e) => setStatus(e.target.value as AnimalStatus)}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {needsFosterFamily && (
        <Field
          label="Famille d'accueil"
          htmlFor="status-foster-family"
          hint={
            <button
              type="button"
              onClick={() => setNewFamilyModalOpen(true)}
              disabled={pending}
              className="text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              + Nouvelle famille d&apos;accueil
            </button>
          }
        >
          <Select
            id="status-foster-family"
            required
            disabled={pending}
            value={fosterFamilyId}
            onChange={(e) => setFosterFamilyId(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {familyOptions.map((family) => (
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
            disabled={pending}
            onChange={(e) => setAdoptionDate(e.target.value)}
          />
        </Field>
      )}

      {showPlacementChangeDate && (
        <Field
          label="Date du changement"
          htmlFor="status-placement-change-date"
          hint="Termine le placement en cours et démarre le nouveau à cette date."
        >
          <Input
            id="status-placement-change-date"
            type="date"
            value={placementChangeDate}
            disabled={pending}
            onChange={(e) => setPlacementChangeDate(e.target.value)}
          />
        </Field>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Mise à jour…" : "Changer le statut"}
        </Button>
      </div>

      <NewFosterFamilyModal
        organizationId={organizationId}
        open={newFamilyModalOpen}
        onClose={() => setNewFamilyModalOpen(false)}
        onCreated={(fosterFamily) => {
          setFamilyOptions((prev) => [...prev, fosterFamily]);
          setFosterFamilyId(fosterFamily.id);
        }}
      />
    </form>
  );
}
