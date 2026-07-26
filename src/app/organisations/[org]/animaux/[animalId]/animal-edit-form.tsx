"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAnimal } from "@/server/actions/animals";
import { SPECIES_LABELS, SEX_LABELS } from "@/lib/animal-labels";
import type { Animal, AnimalSex, AnimalSpecies } from "@/db/schema";

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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label htmlFor="edit-name">
        Nom
        <input
          id="edit-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="edit-species">Espèce</label>
          <select
            id="edit-species"
            value={species}
            onChange={(e) => setSpecies(e.target.value as AnimalSpecies)}
            style={{ display: "block", width: "100%" }}
          >
            {SPECIES_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="edit-sex">Sexe</label>
          <select
            id="edit-sex"
            value={sex}
            onChange={(e) => setSex(e.target.value as AnimalSex)}
            style={{ display: "block", width: "100%" }}
          >
            {SEX_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="edit-breed" style={{ flex: 1 }}>
          Race
          <input
            id="edit-breed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="edit-coat" style={{ flex: 1 }}>
          Pelage
          <input
            id="edit-coat"
            value={coat}
            onChange={(e) => setCoat(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="edit-icad" style={{ flex: 1 }}>
          N° ICAD
          <input
            id="edit-icad"
            value={icadNumber}
            onChange={(e) => setIcadNumber(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="edit-icad-updated" style={{ flex: 1 }}>
          Date de changement d&apos;ICAD
          <input
            id="edit-icad-updated"
            type="date"
            value={icadUpdatedAt}
            onChange={(e) => setIcadUpdatedAt(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="edit-birth-date" style={{ flex: 1 }}>
          Date de naissance
          <input
            id="edit-birth-date"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="edit-intake-date" style={{ flex: 1 }}>
          Date de prise en charge
          <input
            id="edit-intake-date"
            type="date"
            required
            value={intakeDate}
            onChange={(e) => setIntakeDate(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <label htmlFor="edit-description">
        Description
        <textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div>
        <button type="submit" disabled={pending}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}
