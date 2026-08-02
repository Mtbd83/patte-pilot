"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAnimalPlacement } from "@/server/actions/animals";
import { Button } from "@/components/ui/button";

export function DeletePlacementButton({
  organizationId,
  animalId,
  placementId,
  familyName,
}: {
  organizationId: string;
  animalId: string;
  placementId: string;
  familyName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Supprimer définitivement ce placement chez ${familyName} ?`)) return;

    setPending(true);
    try {
      await deleteAnimalPlacement({ placementId, animalId, organizationId });
      toast.success("Placement supprimé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      Supprimer
    </Button>
  );
}
