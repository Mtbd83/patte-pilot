"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createFosterFamily } from "@/server/actions/foster-families";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export function CreateFosterFamilyDialog({
  organizationId,
  linkableUsers,
}: {
  organizationId: string;
  linkableUsers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
  const [linkedUserId, setLinkedUserId] = useState("");

  function reset() {
    setFirstName("");
    setLastName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setHasCats(false);
    setHasDogs(false);
    setHasRabbits(false);
    setLinkedUserId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createFosterFamily({
        organizationId,
        firstName,
        lastName,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        hasCats,
        hasDogs,
        hasRabbits,
        linkedUserId: linkedUserId || undefined,
      });
      toast.success("Famille d'accueil ajoutée");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="self-start">
        <Plus /> Ajouter une famille d&apos;accueil
      </Button>
    );
  }

  return (
    <Card role="dialog" aria-label="Ajouter une famille d'accueil" className="max-w-md">
      <CardHeader>
        <CardTitle>Ajouter une famille d&apos;accueil</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <FieldRow>
            <Field label="Prénom" htmlFor="ff-first-name" className="flex-1">
              <Input id="ff-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Nom" htmlFor="ff-last-name" className="flex-1">
              <Input id="ff-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Adresse" htmlFor="ff-address">
            <Input id="ff-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <FieldRow>
            <Field label="Téléphone" htmlFor="ff-phone" className="flex-1">
              <Input id="ff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="ff-email" className="flex-1">
              <Input id="ff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Compte utilisateur lié" htmlFor="ff-linked-user">
            <Select id="ff-linked-user" value={linkedUserId} onChange={(e) => setLinkedUserId(e.target.value)}>
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
            <label htmlFor="ff-has-cats" className="flex items-center gap-2 text-sm">
              <Checkbox id="ff-has-cats" checked={hasCats} onChange={(e) => setHasCats(e.target.checked)} />
              Chats
            </label>
            <label htmlFor="ff-has-dogs" className="flex items-center gap-2 text-sm">
              <Checkbox id="ff-has-dogs" checked={hasDogs} onChange={(e) => setHasDogs(e.target.checked)} />
              Chiens
            </label>
            <label htmlFor="ff-has-rabbits" className="flex items-center gap-2 text-sm">
              <Checkbox id="ff-has-rabbits" checked={hasRabbits} onChange={(e) => setHasRabbits(e.target.checked)} />
              Lapins
            </label>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" disabled={pending}>
            Ajouter
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
