"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSterilizationCampaignModule } from "@/server/actions/organizations";
import { Checkbox } from "@/components/ui/checkbox";

export function SterilizationModuleToggle({
  organizationId,
  enabled,
}: {
  organizationId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setPending(true);
    try {
      await updateSterilizationCampaignModule({ organizationId, enabled: next });
      toast.success(next ? "Module activé" : "Module désactivé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <label htmlFor="sterilization-module-toggle" className="flex items-center gap-2 text-sm">
      <Checkbox
        id="sterilization-module-toggle"
        checked={enabled}
        disabled={pending}
        onChange={handleChange}
      />
      Activer le module &quot;Campagne de stérilisation Chat Libre&quot;
    </label>
  );
}
