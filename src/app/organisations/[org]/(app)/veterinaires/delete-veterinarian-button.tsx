"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteVeterinarian } from "@/server/actions/veterinarians";
import { Button } from "@/components/ui/button";

export function DeleteVeterinarianButton({
  organizationId,
  veterinarianId,
  veterinarianName,
}: {
  organizationId: string;
  veterinarianId: string;
  veterinarianName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Supprimer définitivement ${veterinarianName} et ses tarifs ?`)) return;

    setPending(true);
    try {
      await deleteVeterinarian({ veterinarianId, organizationId });
      toast.success("Vétérinaire supprimé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      Supprimer
    </Button>
  );
}
