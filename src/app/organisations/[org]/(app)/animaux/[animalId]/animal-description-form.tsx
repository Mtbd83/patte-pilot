"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAnimalDescription } from "@/server/actions/animals";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

/** Lets the responsible famille d'accueil note the animal's personality/needs, without full edit access to the rest of the sheet. */
export function AnimalDescriptionForm({
  organizationId,
  animalId,
  description,
}: {
  organizationId: string;
  animalId: string;
  description: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(description ?? "");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await updateAnimalDescription({ organizationId, animalId, description: value || undefined });
      toast.success("Description mise à jour");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Field label="Description" htmlFor="fa-description">
        <Textarea
          id="fa-description"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Caractère, besoins particuliers, habitudes..."
        />
      </Field>
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        Enregistrer
      </Button>
    </form>
  );
}
