"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createInvitation } from "@/server/actions/invitations";
import type { OrgRole } from "@/db/schema";

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
    return <button onClick={() => setOpen(true)}>Inviter un membre</button>;
  }

  return (
    <div
      role="dialog"
      aria-label="Inviter un membre"
      style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, marginTop: 16, maxWidth: 360 }}
    >
      <h2>Inviter un membre</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label htmlFor="invite-email">
          Email
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend>Rôles</legend>
          {ROLE_OPTIONS.map((option) => (
            <label key={option.value} htmlFor={`role-${option.value}`} style={{ display: "block" }}>
              <input
                id={`role-${option.value}`}
                type="checkbox"
                checked={roles.includes(option.value)}
                onChange={(e) => toggleRole(option.value, e.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={pending}>
            Envoyer l&apos;invitation
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
