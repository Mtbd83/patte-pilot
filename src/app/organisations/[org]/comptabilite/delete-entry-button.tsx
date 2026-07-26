"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAccountingEntry } from "@/server/actions/accounting";

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
    <button onClick={handleClick} disabled={pending}>
      Supprimer
    </button>
  );
}
