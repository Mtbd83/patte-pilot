"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteReportComment } from "@/server/actions/sterilization-reports";
import { Button } from "@/components/ui/button";

export function DeleteCommentButton({ organizationId, commentId }: { organizationId: string; commentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm("Supprimer définitivement ce commentaire ?")) return;

    setPending(true);
    try {
      await deleteReportComment({ commentId, organizationId });
      toast.success("Commentaire supprimé");
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
