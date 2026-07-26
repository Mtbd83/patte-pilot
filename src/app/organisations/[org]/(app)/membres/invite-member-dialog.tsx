"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createInvitation } from "@/server/actions/invitations";
import type { OrgRole } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "benevole", label: "Bénévole" },
  { value: "famille_accueil", label: "Famille d'accueil" },
  { value: "admin", label: "Administrateur·rice" },
];

export function InviteMemberDialog({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: OrgRole, checked: boolean) {
    setRoles((prev) => (checked ? [...prev, role] : prev.filter((r) => r !== role)));
  }

  function reset() {
    setEmail("");
    setRoles([]);
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
      await createInvitation({ organizationId, email, roles });
      toast.success("Invitation envoyée");
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

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
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`role-${option.value}`}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id={`role-${option.value}`}
                  checked={roles.includes(option.value)}
                  onChange={(e) => toggleRole(option.value, e.target.checked)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
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
