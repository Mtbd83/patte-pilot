"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateAdoptionApplicationStatus } from "@/server/actions/adoption-applications";
import { ADOPTION_STATUS_LABELS, ADOPTION_STATUS_BADGE_VARIANT } from "@/lib/adoption-labels";
import type { AdoptionApplicationStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const STATUS_OPTIONS = Object.entries(ADOPTION_STATUS_LABELS) as [AdoptionApplicationStatus, string][];

export function InlineStatusForm({
  organizationId,
  applicationId,
  currentStatus,
  currentTargetAnimalId,
  animals,
}: {
  organizationId: string;
  applicationId: string;
  currentStatus: AdoptionApplicationStatus;
  currentTargetAnimalId: string | null;
  animals: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<AdoptionApplicationStatus>(currentStatus);
  const [targetAnimalId, setTargetAnimalId] = useState(currentTargetAnimalId ?? "");
  const [pending, setPending] = useState(false);

  function cancelEdit() {
    setStatus(currentStatus);
    setTargetAnimalId(currentTargetAnimalId ?? "");
    setEditing(false);
  }

  async function handleSave() {
    setPending(true);
    try {
      await updateAdoptionApplicationStatus({
        applicationId,
        organizationId,
        status,
        targetAnimalId: targetAnimalId || null,
      });
      toast.success("Statut mis à jour");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={ADOPTION_STATUS_BADGE_VARIANT[currentStatus]}>
          {ADOPTION_STATUS_LABELS[currentStatus]}
        </Badge>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Modifier le statut"
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Modifier le statut</span>
        <button
          type="button"
          onClick={cancelEdit}
          aria-label="Annuler"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Select
        aria-label="Statut"
        value={status}
        onChange={(e) => setStatus(e.target.value as AdoptionApplicationStatus)}
        className="h-8 text-xs"
      >
        {STATUS_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      {status === "retenu" && (
        <Select
          aria-label="Animal adopté"
          value={targetAnimalId}
          onChange={(e) => setTargetAnimalId(e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">— Animal adopté —</option>
          {animals.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.name}
            </option>
          ))}
        </Select>
      )}
      <Button size="sm" onClick={handleSave} disabled={pending}>
        Enregistrer
      </Button>
    </div>
  );
}
