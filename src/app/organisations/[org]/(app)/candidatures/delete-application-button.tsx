"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAdoptionApplication } from "@/server/actions/adoption-applications";
import { Button } from "@/components/ui/button";

export function DeleteApplicationButton({
  organizationId,
  applicationId,
  applicantName,
}: {
  organizationId: string;
  applicationId: string;
  applicantName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Supprimer définitivement la candidature de ${applicantName} ?`)) return;

    setPending(true);
    try {
      await deleteAdoptionApplication({ applicationId, organizationId });
      toast.success("Candidature supprimée");
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
