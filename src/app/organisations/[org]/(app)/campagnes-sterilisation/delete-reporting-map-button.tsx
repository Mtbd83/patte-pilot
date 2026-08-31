"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteReportingMap } from "@/server/actions/sterilization-reports";
import { Button } from "@/components/ui/button";

export function DeleteReportingMapButton({
  organizationId,
  mapId,
  city,
  redirectTo,
}: {
  organizationId: string;
  mapId: string;
  city: string;
  /** If provided (e.g. from the map's own detail page, which can't be refreshed once the map is gone), navigates there instead of calling router.refresh(). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Supprimer définitivement la carte de signalement de ${city} et tous ses signalements ?`)) {
      return;
    }

    setPending(true);
    try {
      await deleteReportingMap({ mapId, organizationId });
      toast.success("Carte de signalement supprimée");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
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
