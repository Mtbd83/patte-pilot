"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateMemberRoles } from "@/server/actions/members";
import type { OrgRole } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "admin", label: "Administrateur·rice" },
  { value: "benevole", label: "Bénévole" },
  { value: "famille_accueil", label: "Famille d'accueil" },
];

export function MemberRolesForm({
  organizationId,
  memberId,
  currentRoles,
}: {
  organizationId: string;
  memberId: string;
  currentRoles: OrgRole[];
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<OrgRole[]>(currentRoles);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: OrgRole, checked: boolean) {
    setRoles((prev) => (checked ? [...prev, role] : prev.filter((r) => r !== role)));
  }

  async function handleSave() {
    setError(null);
    if (roles.length === 0) {
      setError("Sélectionnez au moins un rôle.");
      return;
    }
    setPending(true);
    try {
      await updateMemberRoles({ organizationId, memberId, roles });
      toast.success("Rôles mis à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        {ROLE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={roles.includes(option.value)}
              onChange={(e) => toggleRole(option.value, e.target.checked)}
            />
            {option.label}
          </label>
        ))}
        <Button size="sm" onClick={handleSave} disabled={pending}>
          Enregistrer
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
