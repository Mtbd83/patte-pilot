"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAnimal } from "@/server/actions/animals";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { SPECIES_LABELS, SEX_LABELS, STATUS_LABELS } from "@/lib/animal-labels";
import type { AnimalSex, AnimalSpecies, AnimalStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

const SPECIES_OPTIONS = Object.entries(SPECIES_LABELS) as [AnimalSpecies, string][];
const SEX_OPTIONS = Object.entries(SEX_LABELS) as [AnimalSex, string][];
const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [AnimalStatus, string][];

interface FosterFamilyOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function CreateAnimalDialog({
  organizationId,
  fosterFamilies,
}: {
  organizationId: string;
  fosterFamilies: FosterFamilyOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<AnimalSpecies>("chat");
  const [sex, setSex] = useState<AnimalSex>("inconnu");
  const [breed, setBreed] = useState("");
  const [coat, setCoat] = useState("");
  const [icadNumber, setIcadNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [description, setDescription] = useState("");
  const [intakeDate, setIntakeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<AnimalStatus>("quarantaine");
  const [fosterFamilyId, setFosterFamilyId] = useState("");

  const needsFosterFamily = statusRequiresFosterFamily(status);

  function reset() {
    setName("");
    setSpecies("chat");
    setSex("inconnu");
    setBreed("");
    setCoat("");
    setIcadNumber("");
    setBirthDate("");
    setDescription("");
    setIntakeDate(new Date().toISOString().slice(0, 10));
    setStatus("quarantaine");
    setFosterFamilyId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsFosterFamily && !fosterFamilyId) {
      setError("Une famille d'accueil est requise pour ce statut.");
      return;
    }

    setPending(true);
    try {
      await createAnimal({
        organizationId,
        name,
        species,
        sex,
        breed: breed || undefined,
        coat: coat || undefined,
        icadNumber: icadNumber || undefined,
        birthDate: birthDate || undefined,
        description: description || undefined,
        intakeDate,
        status,
        fosterFamilyId: fosterFamilyId || undefined,
      });
      toast.success("Animal ajouté");
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
        <Plus /> Ajouter un animal
      </Button>
    );
  }

  return (
    <Card role="dialog" aria-label="Ajouter un animal" className="max-w-lg">
      <CardHeader>
        <CardTitle>Ajouter un animal</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <Field label="Nom" htmlFor="animal-name">
            <Input id="animal-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <FieldRow>
            <Field label="Espèce" htmlFor="animal-species" className="flex-1">
              <Select
                id="animal-species"
                value={species}
                onChange={(e) => setSpecies(e.target.value as AnimalSpecies)}
              >
                {SPECIES_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sexe" htmlFor="animal-sex" className="flex-1">
              <Select id="animal-sex" value={sex} onChange={(e) => setSex(e.target.value as AnimalSex)}>
                {SEX_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Race" htmlFor="animal-breed" className="flex-1">
              <Input id="animal-breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
            </Field>
            <Field label="Pelage" htmlFor="animal-coat" className="flex-1">
              <Input id="animal-coat" value={coat} onChange={(e) => setCoat(e.target.value)} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="N° ICAD" htmlFor="animal-icad" className="flex-1">
              <Input id="animal-icad" value={icadNumber} onChange={(e) => setIcadNumber(e.target.value)} />
            </Field>
            <Field label="Date de naissance" htmlFor="animal-birth-date" className="flex-1">
              <Input
                id="animal-birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Description" htmlFor="animal-description">
            <Textarea
              id="animal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label="Date de prise en charge" htmlFor="animal-intake-date">
            <Input
              id="animal-intake-date"
              type="date"
              required
              value={intakeDate}
              onChange={(e) => setIntakeDate(e.target.value)}
            />
          </Field>

          <Field label="Statut" htmlFor="animal-status">
            <Select id="animal-status" value={status} onChange={(e) => setStatus(e.target.value as AnimalStatus)}>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          {needsFosterFamily && (
            <Field
              label="Famille d'accueil"
              htmlFor="animal-foster-family"
              hint={
                fosterFamilies.length === 0
                  ? "Aucune famille d'accueil disponible : créez-en une d'abord."
                  : undefined
              }
            >
              <Select
                id="animal-foster-family"
                required
                value={fosterFamilyId}
                onChange={(e) => setFosterFamilyId(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {fosterFamilies.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.firstName} {family.lastName}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" disabled={pending}>
            Ajouter l&apos;animal
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
