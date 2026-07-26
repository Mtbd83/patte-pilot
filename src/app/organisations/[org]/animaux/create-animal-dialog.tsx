"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAnimal } from "@/server/actions/animals";
import { statusRequiresFosterFamily } from "@/lib/animal-status";
import { SPECIES_LABELS, SEX_LABELS, STATUS_LABELS } from "@/lib/animal-labels";
import type { AnimalSex, AnimalSpecies, AnimalStatus } from "@/db/schema";

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
    return <button onClick={() => setOpen(true)}>Ajouter un animal</button>;
  }

  return (
    <div
      role="dialog"
      aria-label="Ajouter un animal"
      style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, marginTop: 16, maxWidth: 480 }}
    >
      <h2>Ajouter un animal</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label htmlFor="animal-name">
          Nom
          <input
            id="animal-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="animal-species">Espèce</label>
            <select
              id="animal-species"
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
            <label htmlFor="animal-sex">Sexe</label>
            <select
              id="animal-sex"
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
          <label htmlFor="animal-breed" style={{ flex: 1 }}>
            Race
            <input
              id="animal-breed"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="animal-coat" style={{ flex: 1 }}>
            Pelage
            <input
              id="animal-coat"
              value={coat}
              onChange={(e) => setCoat(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <label htmlFor="animal-icad" style={{ flex: 1 }}>
            N° ICAD
            <input
              id="animal-icad"
              value={icadNumber}
              onChange={(e) => setIcadNumber(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="animal-birth-date" style={{ flex: 1 }}>
            Date de naissance
            <input
              id="animal-birth-date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>

        <label htmlFor="animal-description">
          Description
          <textarea
            id="animal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <label htmlFor="animal-intake-date">
          Date de prise en charge
          <input
            id="animal-intake-date"
            type="date"
            required
            value={intakeDate}
            onChange={(e) => setIntakeDate(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <div>
          <label htmlFor="animal-status">Statut</label>
          <select
            id="animal-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AnimalStatus)}
            style={{ display: "block", width: "100%" }}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {needsFosterFamily && (
          <div>
            <label htmlFor="animal-foster-family">Famille d&apos;accueil</label>
            <select
              id="animal-foster-family"
              required
              value={fosterFamilyId}
              onChange={(e) => setFosterFamilyId(e.target.value)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">— Sélectionner —</option>
              {fosterFamilies.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.firstName} {family.lastName}
                </option>
              ))}
            </select>
            {fosterFamilies.length === 0 && (
              <p style={{ color: "crimson", fontSize: 14 }}>
                Aucune famille d&apos;accueil disponible : créez-en une d&apos;abord.
              </p>
            )}
          </div>
        )}

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={pending}>
            Ajouter l&apos;animal
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
