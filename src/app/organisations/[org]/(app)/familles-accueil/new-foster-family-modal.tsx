"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createFosterFamily } from "@/server/actions/foster-families";
import type { FosterFamily } from "@/db/schema";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldRow } from "@/components/ui/field";

/**
 * The same foster-family creation form as the standalone page dialog, but as
 * an overlay so it can be opened from inside another already-open form (e.g.
 * the "Ajouter un animal" dialog) without losing what's been typed there.
 */
export function NewFosterFamilyModal({
  organizationId,
  open,
  onClose,
  onCreated,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (fosterFamily: FosterFamily) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hasCats, setHasCats] = useState(false);
  const [hasDogs, setHasDogs] = useState(false);
  const [hasRabbits, setHasRabbits] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setHasCats(false);
    setHasDogs(false);
    setHasRabbits(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fosterFamily = await createFosterFamily({
        organizationId,
        firstName,
        lastName,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        hasCats,
        hasDogs,
        hasRabbits,
      });
      toast.success("Famille d'accueil ajoutée");
      onCreated(fosterFamily);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Nouvelle famille d'accueil">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FieldRow>
          <Field label="Prénom" htmlFor="nff-first-name" className="flex-1">
            <Input id="nff-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Nom" htmlFor="nff-last-name" className="flex-1">
            <Input id="nff-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </FieldRow>

        <Field label="Adresse" htmlFor="nff-address">
          <Input id="nff-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>

        <FieldRow>
          <Field label="Téléphone" htmlFor="nff-phone" className="flex-1">
            <Input id="nff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="nff-email" className="flex-1">
            <Input id="nff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </FieldRow>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Autres animaux déjà présents</legend>
          <label htmlFor="nff-has-cats" className="flex items-center gap-2 text-sm">
            <Checkbox id="nff-has-cats" checked={hasCats} onChange={(e) => setHasCats(e.target.checked)} />
            Chats
          </label>
          <label htmlFor="nff-has-dogs" className="flex items-center gap-2 text-sm">
            <Checkbox id="nff-has-dogs" checked={hasDogs} onChange={(e) => setHasDogs(e.target.checked)} />
            Chiens
          </label>
          <label htmlFor="nff-has-rabbits" className="flex items-center gap-2 text-sm">
            <Checkbox id="nff-has-rabbits" checked={hasRabbits} onChange={(e) => setHasRabbits(e.target.checked)} />
            Lapins
          </label>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Ajouter
          </Button>
          <Button type="button" variant="outline" onClick={handleClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
