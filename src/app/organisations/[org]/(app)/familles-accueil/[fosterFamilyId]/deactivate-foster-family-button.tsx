"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deactivateFosterFamily } from "@/server/actions/foster-families";
import { Button } from "@/components/ui/button";

export function DeactivateFosterFamilyButton({
  organizationId,
  fosterFamilyId,
}: {
  organizationId: string;
  fosterFamilyId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPending(true);
    try {
      await deactivateFosterFamily({ fosterFamilyId, organizationId });
      toast.success("Famille d'accueil désactivée");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="destructive" onClick={handleClick} disabled={pending} className="self-start">
        Désactiver cette famille d&apos;accueil
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
