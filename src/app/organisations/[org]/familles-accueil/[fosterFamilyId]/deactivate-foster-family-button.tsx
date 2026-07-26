"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deactivateFosterFamily } from "@/server/actions/foster-families";

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
    <div>
      <button onClick={handleClick} disabled={pending}>
        Désactiver cette famille d&apos;accueil
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
