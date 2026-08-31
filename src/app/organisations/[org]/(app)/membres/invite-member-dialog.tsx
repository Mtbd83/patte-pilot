"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createInvitation } from "@/server/actions/invitations";
import type { OrgRole, OrgPermission } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/role-labels";
import { PERMISSION_LABELS } from "@/lib/permission-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

const ROLE_VALUES: OrgRole[] = ["benevole", "famille_accueil", "admin"];
const PERMISSION_VALUES: OrgPermission[] = [
  "prise_en_charge",
  "comptabilite",
  "candidature",
  "contrat",
  "gestion_famille_accueil",
  "campagne_sterilisation",
];

export function InviteMemberDialog({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [permissions, setPermissions] = useState<OrgPermission[]>([]);
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

  function reset() {
    setEmail("");
    setRoles([]);
    setPermissions([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (roles.length === 0) {
      setError("Sélectionnez au moins un rôle.");
      return;
    }

    setPending(true);
    try {
      await createInvitation({ organizationId, email, roles, benevolePermissions: permissions });
      toast.success("Invitation envoyée");
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const isBenevole = roles.includes("benevole");
  const hasCandidature = permissions.includes("candidature");

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="self-start">
        <UserPlus /> Inviter un membre
      </Button>
    );
  }

  return (
    <Card role="dialog" aria-label="Inviter un membre" className="max-w-sm">
      <CardHeader>
        <CardTitle>Inviter un membre</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <Field label="Email" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Rôles</legend>
            {ROLE_VALUES.map((role) => (
              <label key={role} htmlFor={`role-${role}`} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`role-${role}`}
                  checked={roles.includes(role)}
                  onChange={(e) => toggleRole(role, e.target.checked)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </fieldset>
          {isBenevole && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Droits du bénévole</legend>
              {PERMISSION_VALUES.map((permission) => {
                const disabled = permission === "contrat" && !hasCandidature;
                return (
                  <label
                    key={permission}
                    htmlFor={`permission-${permission}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Checkbox
                      id={`permission-${permission}`}
                      checked={permissions.includes(permission)}
                      disabled={disabled}
                      onChange={(e) => togglePermission(permission, e.target.checked)}
                    />
                    {PERMISSION_LABELS[permission]}
                  </label>
                );
              })}
            </fieldset>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" disabled={pending}>
            Envoyer l&apos;invitation
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Annuler
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
