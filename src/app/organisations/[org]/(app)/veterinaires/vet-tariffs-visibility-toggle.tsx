"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateVetTariffsVisibility } from "@/server/actions/veterinarians";
import { Checkbox } from "@/components/ui/checkbox";

export function VetTariffsVisibilityToggle({
  organizationId,
  visible,
}: {
  organizationId: string;
  visible: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setPending(true);
    try {
      await updateVetTariffsVisibility({ organizationId, visible: next });
      toast.success(next ? "Tarifs visibles par les familles d'accueil" : "Tarifs masqués aux familles d'accueil");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <label htmlFor="vet-tariffs-visibility" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Checkbox
        id="vet-tariffs-visibility"
        checked={visible}
        disabled={pending}
        onChange={handleChange}
      />
      Rendre les tarifs visibles aux familles d&apos;accueil
    </label>
  );
}
