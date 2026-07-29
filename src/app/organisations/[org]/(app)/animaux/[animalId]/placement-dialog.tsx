"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { createAnimalPlacement, updateAnimalPlacement } from "@/server/actions/animals";
import type { AnimalPlacement } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";

interface FosterFamilyOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function PlacementDialog({
  organizationId,
  animalId,
  fosterFamilies,
  placement,
}: {
  organizationId: string;
  animalId: string;
  fosterFamilies: FosterFamilyOption[];
  /** Omitted = "add a new placement" mode; provided = "edit this one" mode. */
  placement?: AnimalPlacement;
}) {
  const router = useRouter();
  const isEdit = Boolean(placement);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fosterFamilyId, setFosterFamilyId] = useState(placement?.fosterFamilyId ?? fosterFamilies[0]?.id ?? "");
  const [startedAt, setStartedAt] = useState(
    placement ? placement.startedAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [endedAt, setEndedAt] = useState(placement?.endedAt ? placement.endedAt.toISOString().slice(0, 10) : "");
  const [notes, setNotes] = useState(placement?.notes ?? "");

  function handleOpen() {
    setFosterFamilyId(placement?.fosterFamilyId ?? fosterFamilies[0]?.id ?? "");
    setStartedAt(placement ? placement.startedAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEndedAt(placement?.endedAt ? placement.endedAt.toISOString().slice(0, 10) : "");
    setNotes(placement?.notes ?? "");
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (placement) {
        await updateAnimalPlacement({
          placementId: placement.id,
          animalId,
          organizationId,
          fosterFamilyId,
          startedAt,
          endedAt: endedAt || undefined,
          notes: notes || undefined,
        });
        toast.success("Placement mis à jour");
      } else {
        await createAnimalPlacement({
          animalId,
          organizationId,
          fosterFamilyId,
          startedAt,
          endedAt: endedAt || undefined,
          notes: notes || undefined,
        });
        toast.success("Placement ajouté");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const idPrefix = isEdit ? `edit-placement-${placement!.id}` : "add-placement";

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={handleOpen}>
          <Pencil /> Modifier
        </Button>
      ) : (
        <Button size="sm" onClick={handleOpen}>
          <Plus /> Ajouter un placement
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? "Modifier le placement" : "Ajouter un placement"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Famille d'accueil" htmlFor={`${idPrefix}-family`}>
            <Select id={`${idPrefix}-family`} required value={fosterFamilyId} onChange={(e) => setFosterFamilyId(e.target.value)}>
              {fosterFamilies.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.firstName} {family.lastName}
                </option>
              ))}
            </Select>
          </Field>

          <FieldRow>
            <Field label="Date de début" htmlFor={`${idPrefix}-start`} className="flex-1">
              <Input
                id={`${idPrefix}-start`}
                type="date"
                required
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </Field>
            <Field
              label="Date de fin"
              htmlFor={`${idPrefix}-end`}
              className="flex-1"
              hint="Laisser vide si le placement est toujours en cours."
            >
              <Input id={`${idPrefix}-end`} type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Notes (optionnel)" htmlFor={`${idPrefix}-notes`}>
            <Textarea id={`${idPrefix}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
