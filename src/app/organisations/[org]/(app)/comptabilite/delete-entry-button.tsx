"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAccountingEntry } from "@/server/actions/accounting";
import { Button } from "@/components/ui/button";

export function DeleteEntryButton({
  organizationId,
  entryId,
}: {
  organizationId: string;
  entryId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await deleteAccountingEntry({ entryId, organizationId });
      toast.success("Écriture supprimée");
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
