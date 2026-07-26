"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAnimal } from "@/server/actions/animals";
import { SPECIES_LABELS, SEX_LABELS } from "@/lib/animal-labels";
import type { Animal, AnimalSex, AnimalSpecies } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";

const SPECIES_OPTIONS = Object.entries(SPECIES_LABELS) as [AnimalSpecies, string][];
const SEX_OPTIONS = Object.entries(SEX_LABELS) as [AnimalSex, string][];

export function AnimalEditForm({
  organizationId,
  animal,
}: {
  organizationId: string;
  animal: Animal;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(animal.name);
  const [species, setSpecies] = useState<AnimalSpecies>(animal.species);
  const [sex, setSex] = useState<AnimalSex>(animal.sex);
  const [breed, setBreed] = useState(animal.breed ?? "");
  const [coat, setCoat] = useState(animal.coat ?? "");
  const [icadNumber, setIcadNumber] = useState(animal.icadNumber ?? "");
  const [icadUpdatedAt, setIcadUpdatedAt] = useState(animal.icadUpdatedAt ?? "");
  const [birthDate, setBirthDate] = useState(animal.birthDate ?? "");
  const [description, setDescription] = useState(animal.description ?? "");
  const [intakeDate, setIntakeDate] = useState(animal.intakeDate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateAnimal({
        animalId: animal.id,
        organizationId,
        name,
        species,
        sex,
        breed: breed || undefined,
        coat: coat || undefined,
        icadNumber: icadNumber || undefined,
        icadUpdatedAt: icadUpdatedAt || undefined,
        birthDate: birthDate || undefined,
        description: description || undefined,
        intakeDate,
      });
      toast.success("Fiche animal mise à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Nom" htmlFor="edit-name">
        <Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <FieldRow>
        <Field label="Espèce" htmlFor="edit-species" className="flex-1">
          <Select id="edit-species" value={species} onChange={(e) => setSpecies(e.target.value as AnimalSpecies)}>
            {SPECIES_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sexe" htmlFor="edit-sex" className="flex-1">
          <Select id="edit-sex" value={sex} onChange={(e) => setSex(e.target.value as AnimalSex)}>
            {SEX_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Race" htmlFor="edit-breed" className="flex-1">
          <Input id="edit-breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
        </Field>
        <Field label="Pelage" htmlFor="edit-coat" className="flex-1">
          <Input id="edit-coat" value={coat} onChange={(e) => setCoat(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="N° ICAD" htmlFor="edit-icad" className="flex-1">
          <Input id="edit-icad" value={icadNumber} onChange={(e) => setIcadNumber(e.target.value)} />
        </Field>
        <Field label="Date de changement d'ICAD" htmlFor="edit-icad-updated" className="flex-1">
          <Input
            id="edit-icad-updated"
            type="date"
            value={icadUpdatedAt}
            onChange={(e) => setIcadUpdatedAt(e.target.value)}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Date de naissance" htmlFor="edit-birth-date" className="flex-1">
          <Input id="edit-birth-date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label="Date de prise en charge" htmlFor="edit-intake-date" className="flex-1">
          <Input
            id="edit-intake-date"
            type="date"
            required
            value={intakeDate}
            onChange={(e) => setIntakeDate(e.target.value)}
          />
        </Field>
      </FieldRow>

      <Field label="Description" htmlFor="edit-description">
        <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
