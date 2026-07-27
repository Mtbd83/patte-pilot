"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Plus } from "lucide-react";
import { createAnimal, uploadAnimalPhoto } from "@/server/actions/animals";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { SPECIES_LABELS, SEX_LABELS, STATUS_LABELS } from "@/lib/animal-labels";
import type { AnimalSex, AnimalSpecies, AnimalStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { NewFosterFamilyModal } from "../familles-accueil/new-foster-family-modal";

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
  const [familyOptions, setFamilyOptions] = useState(fosterFamilies);
  const [newFamilyModalOpen, setNewFamilyModalOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

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

  const [firstVaccineDone, setFirstVaccineDone] = useState(false);
  const [firstVaccineDate, setFirstVaccineDate] = useState("");
  const [sterilizationDone, setSterilizationDone] = useState(false);
  const [sterilizationDate, setSterilizationDate] = useState("");
  const [boosterDone, setBoosterDone] = useState(false);
  const [boosterDate, setBoosterDate] = useState("");
  const [dewormingDone, setDewormingDone] = useState(false);
  const [dewormingDate, setDewormingDate] = useState("");
  const [externalTreatmentDone, setExternalTreatmentDone] = useState(false);
  const [externalTreatmentDate, setExternalTreatmentDate] = useState("");

  const needsFosterFamily = statusRequiresFosterFamily(status);

  const healthChecklistRows = [
    {
      id: "animal-first-vaccine",
      label: "Primo vaccin fait",
      dateLabel: "Date de la primo-vaccination",
      done: firstVaccineDone,
      setDone: setFirstVaccineDone,
      date: firstVaccineDate,
      setDate: setFirstVaccineDate,
    },
    {
      id: "animal-sterilization",
      label: "Stérilisation faite",
      dateLabel: "Date de la stérilisation",
      done: sterilizationDone,
      setDone: setSterilizationDone,
      date: sterilizationDate,
      setDate: setSterilizationDate,
    },
    {
      id: "animal-booster",
      label: "Rappel fait",
      dateLabel: "Date du rappel",
      done: boosterDone,
      setDone: setBoosterDone,
      date: boosterDate,
      setDate: setBoosterDate,
    },
    {
      id: "animal-deworming",
      label: "Vermifuge fait",
      dateLabel: "Date du vermifuge",
      done: dewormingDone,
      setDone: setDewormingDone,
      date: dewormingDate,
      setDate: setDewormingDate,
    },
    {
      id: "animal-external-treatment",
      label: "Déparasitage externe fait",
      dateLabel: "Date du déparasitage externe",
      done: externalTreatmentDone,
      setDone: setExternalTreatmentDone,
      date: externalTreatmentDate,
      setDate: setExternalTreatmentDate,
    },
  ];

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function reset() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
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
    setFirstVaccineDone(false);
    setFirstVaccineDate("");
    setSterilizationDone(false);
    setSterilizationDate("");
    setBoosterDone(false);
    setBoosterDate("");
    setDewormingDone(false);
    setDewormingDate("");
    setExternalTreatmentDone(false);
    setExternalTreatmentDate("");
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
      const animal = await createAnimal({
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
        firstVaccineDone,
        firstVaccineDate: firstVaccineDate || undefined,
        sterilizationDone,
        sterilizationDate: sterilizationDate || undefined,
        boosterDone,
        boosterDate: boosterDate || undefined,
        dewormingDone,
        dewormingDate: dewormingDate || undefined,
        externalTreatmentDone,
        externalTreatmentDate: externalTreatmentDate || undefined,
      });

      if (photoFile) {
        try {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          formData.set("animalId", animal.id);
          formData.set("file", photoFile);
          await uploadAnimalPhoto(formData);
        } catch (photoErr) {
          toast.error(
            photoErr instanceof Error
              ? `Animal ajouté, mais la photo n'a pas pu être envoyée : ${photoErr.message}`
              : "Animal ajouté, mais la photo n'a pas pu être envoyée.",
          );
          setOpen(false);
          reset();
          router.refresh();
          return;
        }
      }

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
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {photoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreviewUrl} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                id="animal-photo-input"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
              >
                {photoPreviewUrl ? "Changer la photo" : "Ajouter une photo"}
              </Button>
            </div>
          </div>

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
                <button
                  type="button"
                  onClick={() => setNewFamilyModalOpen(true)}
                  className="text-primary hover:underline"
                >
                  + Nouvelle famille d&apos;accueil
                </button>
              }
            >
              <Select
                id="animal-foster-family"
                required
                value={fosterFamilyId}
                onChange={(e) => setFosterFamilyId(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {familyOptions.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.firstName} {family.lastName}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">Checklist santé</legend>
            {healthChecklistRows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 sm:gap-4">
                <Label htmlFor={row.id} className="min-w-40">
                  <Checkbox id={row.id} checked={row.done} onChange={(e) => row.setDone(e.target.checked)} />
                  {row.label}
                </Label>
                <Input
                  type="date"
                  aria-label={row.dateLabel}
                  value={row.date}
                  onChange={(e) => row.setDate(e.target.value)}
                  className="w-40"
                />
              </div>
            ))}
          </fieldset>

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

      <NewFosterFamilyModal
        organizationId={organizationId}
        open={newFamilyModalOpen}
        onClose={() => setNewFamilyModalOpen(false)}
        onCreated={(fosterFamily) => {
          setFamilyOptions((prev) => [...prev, fosterFamily]);
          setFosterFamilyId(fosterFamily.id);
        }}
      />
    </Card>
  );
}
