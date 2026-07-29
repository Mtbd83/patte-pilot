"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markSupplyRequestReceived, treatSupplyRequest } from "@/server/actions/supply-requests";
import { Button } from "@/components/ui/button";

export function SupplyRequestRow({
  organizationId,
  requestId,
  status,
}: {
  organizationId: string;
  requestId: string;
  status: "en_cours" | "pris_en_compte";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleMarkReceived() {
    setPending(true);
    try {
      await markSupplyRequestReceived({ requestId, organizationId });
      toast.success("Demande marquée comme prise en compte");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleTreat() {
    setPending(true);
    try {
      await treatSupplyRequest({ requestId, organizationId });
      toast.success("Demande traitée");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  if (status === "en_cours") {
    return (
      <Button variant="outline" size="sm" onClick={handleMarkReceived} disabled={pending}>
        Pris en compte
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleTreat} disabled={pending}>
      Traité
    </Button>
  );
}
