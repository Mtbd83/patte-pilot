"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resendInvitation } from "@/server/actions/invitations";
import { Button } from "@/components/ui/button";

export function ResendInvitationButton({
  organizationId,
  invitationId,
}: {
  organizationId: string;
  invitationId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await resendInvitation({ organizationId, invitationId });
      toast.success("Invitation relancée");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      Relancer
    </Button>
  );
}
