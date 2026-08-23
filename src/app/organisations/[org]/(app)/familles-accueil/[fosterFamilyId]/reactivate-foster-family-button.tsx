"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reactivateFosterFamily } from "@/server/actions/foster-families";
import { Button } from "@/components/ui/button";

export function ReactivateFosterFamilyButton({
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
      await reactivateFosterFamily({ fosterFamilyId, organizationId });
      toast.success("Famille d'accueil réactivée");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={handleClick} disabled={pending} className="self-start">
        Réactiver cette famille d&apos;accueil
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
