"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateMemberRoles } from "@/server/actions/members";
import type { OrgRole, OrgPermission } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/role-labels";
import { PERMISSION_LABELS } from "@/lib/permission-labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const ROLE_VALUES: OrgRole[] = ["admin", "benevole", "famille_accueil"];
const PERMISSION_VALUES: OrgPermission[] = [
  "prise_en_charge",
  "comptabilite",
  "candidature",
  "contrat",
  "gestion_famille_accueil",
  "campagne_sterilisation",
];

export function MemberRolesForm({
  organizationId,
  memberId,
  currentRoles,
  currentPermissions,
}: {
  organizationId: string;
  memberId: string;
  currentRoles: OrgRole[];
  currentPermissions: OrgPermission[];
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<OrgRole[]>(currentRoles);
  const [permissions, setPermissions] = useState<OrgPermission[]>(currentPermissions);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: OrgRole, checked: boolean) {
    setRoles((prev) => (checked ? [...prev, role] : prev.filter((r) => r !== role)));
  }

  function togglePermission(permission: OrgPermission, checked: boolean) {
    setPermissions((prev) => {
      if (!checked) {
        const next = prev.filter((p) => p !== permission);
        // "Contrat" cannot stand without "Candidature".
        return permission === "candidature" ? next.filter((p) => p !== "contrat") : next;
      }
      return [...prev, permission];
    });
  }

  async function handleSave() {
    setError(null);
    if (roles.length === 0) {
      setError("Sélectionnez au moins un rôle.");
      return;
    }
    setPending(true);
    try {
      await updateMemberRoles({ organizationId, memberId, roles, permissions });
      toast.success("Rôles mis à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const isBenevole = roles.includes("benevole");
  const hasCandidature = permissions.includes("candidature");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        {ROLE_VALUES.map((role) => (
          <label key={role} className="flex items-center gap-1.5 text-sm">
            <Checkbox checked={roles.includes(role)} onChange={(e) => toggleRole(role, e.target.checked)} />
            {ROLE_LABELS[role]}
          </label>
        ))}
        <Button size="sm" onClick={handleSave} disabled={pending}>
          Enregistrer
        </Button>
      </div>
      {isBenevole && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          {PERMISSION_VALUES.map((permission) => {
            const disabled = permission === "contrat" && !hasCandidature;
            return (
              <label key={permission} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Checkbox
                  checked={permissions.includes(permission)}
                  disabled={disabled}
                  onChange={(e) => togglePermission(permission, e.target.checked)}
                />
                {PERMISSION_LABELS[permission]}
              </label>
            );
          })}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
