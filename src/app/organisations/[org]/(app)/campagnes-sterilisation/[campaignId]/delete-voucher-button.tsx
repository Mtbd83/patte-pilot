"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSterilizationVoucher } from "@/server/actions/sterilization-campaigns";
import { Button } from "@/components/ui/button";

export function DeleteVoucherButton({
  organizationId,
  voucherId,
  voucherNumber,
}: {
  organizationId: string;
  voucherId: string;
  voucherNumber: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Supprimer définitivement le bon n°${voucherNumber} ?`)) return;

    setPending(true);
    try {
      await deleteSterilizationVoucher({ voucherId, organizationId });
      toast.success("Bon supprimé");
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
