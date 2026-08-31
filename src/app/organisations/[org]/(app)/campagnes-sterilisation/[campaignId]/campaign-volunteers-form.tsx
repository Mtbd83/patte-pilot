"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignCampaignVolunteer, unassignCampaignVolunteer } from "@/server/actions/sterilization-campaigns";
import { Checkbox } from "@/components/ui/checkbox";

interface VolunteerOption {
  id: string;
  label: string;
}

/**
 * Admin-only: assigns/revokes which bénévoles (among those holding the
 * "campagne_sterilisation" permission) can access this specific campaign.
 * Holding the permission alone only unlocks the tab — this is what actually
 * grants access to a given campaign.
 */
export function CampaignVolunteersForm({
  organizationId,
  campaignId,
  assignableVolunteers,
  assignedMemberIds,
}: {
  organizationId: string;
  campaignId: string;
  assignableVolunteers: VolunteerOption[];
  assignedMemberIds: string[];
}) {
  const router = useRouter();
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  async function handleToggle(memberId: string, checked: boolean) {
    setPendingMemberId(memberId);
    try {
      if (checked) {
        await assignCampaignVolunteer({ campaignId, organizationId, memberId });
      } else {
        await unassignCampaignVolunteer({ campaignId, organizationId, memberId });
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingMemberId(null);
    }
  }

  if (assignableVolunteers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun·e bénévole n&apos;a le droit &quot;Campagne stérilisation&quot; pour le moment — accordez-le
        depuis l&apos;onglet Membres.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {assignableVolunteers.map((volunteer) => (
        <label key={volunteer.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={assignedMemberIds.includes(volunteer.id)}
            disabled={pendingMemberId === volunteer.id}
            onChange={(e) => handleToggle(volunteer.id, e.target.checked)}
          />
          {volunteer.label}
        </label>
      ))}
    </div>
  );
}
