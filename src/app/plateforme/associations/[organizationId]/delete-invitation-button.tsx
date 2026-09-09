"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteInvitationAsPlatformManager } from "@/server/actions/platform";
import { Button } from "@/components/ui/button";

export function DeleteInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm("Annuler définitivement cette invitation ?")) return;

    setPending(true);
    try {
      await deleteInvitationAsPlatformManager({ invitationId });
      toast.success("Invitation supprimée");
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
