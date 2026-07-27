"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateFosterFamily } from "@/server/actions/foster-families";
import type { FosterFamily } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";

export function FosterFamilyEditForm({
  organizationId,
  fosterFamily,
  linkableUsers,
}: {
  organizationId: string;
  fosterFamily: FosterFamily;
  linkableUsers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(fosterFamily.firstName);
  const [lastName, setLastName] = useState(fosterFamily.lastName);
  const [address, setAddress] = useState(fosterFamily.address ?? "");
  const [phone, setPhone] = useState(fosterFamily.phone ?? "");
  const [email, setEmail] = useState(fosterFamily.email ?? "");
  const [hasCats, setHasCats] = useState(fosterFamily.hasCats);
  const [hasDogs, setHasDogs] = useState(fosterFamily.hasDogs);
  const [hasRabbits, setHasRabbits] = useState(fosterFamily.hasRabbits);
  const [linkedUserId, setLinkedUserId] = useState(fosterFamily.linkedUserId ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateFosterFamily({
        fosterFamilyId: fosterFamily.id,
        organizationId,
        firstName,
        lastName,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        hasCats,
        hasDogs,
        hasRabbits,
        linkedUserId: linkedUserId || null,
      });
      toast.success("Famille d'accueil mise à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldRow>
        <Field label="Prénom" htmlFor="ff-edit-first-name" className="flex-1">
          <Input id="ff-edit-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Nom" htmlFor="ff-edit-last-name" className="flex-1">
          <Input id="ff-edit-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </FieldRow>

      <Field label="Adresse" htmlFor="ff-edit-address">
        <Input id="ff-edit-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>

      <FieldRow>
        <Field label="Téléphone" htmlFor="ff-edit-phone" className="flex-1">
          <Input id="ff-edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="ff-edit-email" className="flex-1">
          <Input id="ff-edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </FieldRow>

      <Field label="Compte utilisateur lié" htmlFor="ff-edit-linked-user">
        <Select
          id="ff-edit-linked-user"
          value={linkedUserId}
          onChange={(e) => setLinkedUserId(e.target.value)}
        >
          <option value="">— Aucun —</option>
          {linkableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Permet à cette famille d&apos;accueil de gérer la checklist des soins des animaux qui lui sont confiés.
        </p>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Autres animaux déjà présents</legend>
        <label htmlFor="ff-edit-has-cats" className="flex items-center gap-2 text-sm">
          <Checkbox id="ff-edit-has-cats" checked={hasCats} onChange={(e) => setHasCats(e.target.checked)} />
          Chats
        </label>
        <label htmlFor="ff-edit-has-dogs" className="flex items-center gap-2 text-sm">
          <Checkbox id="ff-edit-has-dogs" checked={hasDogs} onChange={(e) => setHasDogs(e.target.checked)} />
          Chiens
        </label>
        <label htmlFor="ff-edit-has-rabbits" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="ff-edit-has-rabbits"
            checked={hasRabbits}
            onChange={(e) => setHasRabbits(e.target.checked)}
          />
          Lapins
        </label>
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
