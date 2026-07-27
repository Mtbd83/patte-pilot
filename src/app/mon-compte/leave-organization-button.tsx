"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { leaveOrganization } from "@/server/actions/account";
import { Button } from "@/components/ui/button";

export function LeaveOrganizationButton({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Quitter "${organizationName}" ? Vous perdrez l'accès à cette association.`)) {
      return;
    }

    setPending(true);
    try {
      await leaveOrganization({ organizationId });
      toast.success(`Vous avez quitté "${organizationName}"`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      Quitter
    </Button>
  );
}
