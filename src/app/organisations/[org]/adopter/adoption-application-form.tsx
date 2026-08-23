"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { submitAdoptionApplication } from "@/server/actions/adoption-applications";
import {
  HOUSING_ZONE_LABELS,
  HOUSING_TYPE_LABELS,
  RESIDENCY_STATUS_LABELS,
  LIVING_SITUATION_LABELS,
  ACTIVITY_LEVEL_LABELS,
  ALONE_TIME_LABELS,
} from "@/lib/adoption-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type {
  AnimalSpecies,
  AnimalStatus,
  HousingType,
  HousingZone,
  LivingSituation,
  ResidencyStatus,
  ActivityLevel,
  AloneTime,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const HOUSING_ZONE_OPTIONS = Object.entries(HOUSING_ZONE_LABELS) as [HousingZone, string][];
const HOUSING_TYPE_OPTIONS = Object.entries(HOUSING_TYPE_LABELS) as [HousingType, string][];
const RESIDENCY_STATUS_OPTIONS = Object.entries(RESIDENCY_STATUS_LABELS) as [ResidencyStatus, string][];
const LIVING_SITUATION_OPTIONS = Object.entries(LIVING_SITUATION_LABELS) as [LivingSituation, string][];
const ACTIVITY_LEVEL_OPTIONS = Object.entries(ACTIVITY_LEVEL_LABELS) as [ActivityLevel, string][];
const ALONE_TIME_OPTIONS = Object.entries(ALONE_TIME_LABELS) as [AloneTime, string][];
const SPECIES_OPTIONS = Object.entries(SPECIES_LABELS) as [AnimalSpecies, string][];

interface FormState {
  lastName: string;
  firstName: string;
  city: string;
  phone: string;
  email: string;
  age: string;
  spouseAge: string;
  profession: string;
  spouseProfession: string;

  housingZone: HousingZone | "";
  housingType: HousingType | "";
  gardenAreaM2: string;
  apartmentAreaM2: string;
  fenceHeight: string;
  gardenAccessDetails: string;
  residencyStatus: ResidencyStatus | "";
  residencyDuration: string;
  livingSituation: LivingSituation | "";

  familySize: string;
  childrenCount: string;
  allergiesDetails: string;
  activityLevel: ActivityLevel | "";
  familyAgrees: boolean;
  familyDisagreementReason: string;

  hasOtherAnimals: boolean;
  otherAnimalsDetails: string;

  caretakerPerson: string;
  sleepingArea: string;
  aloneTimePerDay: AloneTime | "";
  dogWalksPerDay: string;
  dogMiddayWalkPossible: boolean;
  vacationPlan: string;

  desiredSpecies: AnimalSpecies | "";
  specificAnimalName: string;
  additionalComments: string;
}

const INITIAL_STATE: FormState = {
  lastName: "",
  firstName: "",
  city: "",
  phone: "",
  email: "",
  age: "",
  spouseAge: "",
  profession: "",
  spouseProfession: "",
  housingZone: "",
  housingType: "",
  gardenAreaM2: "",
  apartmentAreaM2: "",
  fenceHeight: "",
  gardenAccessDetails: "",
  residencyStatus: "",
  residencyDuration: "",
  livingSituation: "",
  familySize: "",
  childrenCount: "",
  allergiesDetails: "",
  activityLevel: "",
  familyAgrees: true,
  familyDisagreementReason: "",
  hasOtherAnimals: false,
  otherAnimalsDetails: "",
  caretakerPerson: "",
  sleepingArea: "",
  aloneTimePerDay: "",
  dogWalksPerDay: "",
  dogMiddayWalkPossible: false,
  vacationPlan: "",
  desiredSpecies: "",
  specificAnimalName: "",
  additionalComments: "",
};

interface AdoptableAnimal {
  id: string;
  name: string;
  species: AnimalSpecies;
  status: AnimalStatus;
}

export function AdoptionApplicationForm({
  organizationId,
  adoptableAnimals,
}: {
  organizationId: string;
  adoptableAnimals: AdoptableAnimal[];
}) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Drives the "pick from the list" select below — separate from
  // form.specificAnimalName (the actual free-text field submitted) so a
  // manual edit after picking doesn't leave a stale reserved-animal warning.
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const selectedAnimal = adoptableAnimals.find((a) => a.id === selectedAnimalId);
  const visibleAnimals = form.desiredSpecies
    ? adoptableAnimals.filter((a) => a.species === form.desiredSpecies)
    : adoptableAnimals;
  // Honeypot: real visitors never see or focus this field (hidden off-screen
  // below); bots that fill in every input on the page trip it.
  const [honeypot, setHoneypot] = useState("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await submitAdoptionApplication({
        organizationId,
        honeypot,
        lastName: form.lastName,
        firstName: form.firstName,
        city: form.city,
        phone: form.phone,
        email: form.email,
        age: form.age ? Number(form.age) : undefined,
        spouseAge: form.spouseAge ? Number(form.spouseAge) : undefined,
        profession: form.profession || undefined,
        spouseProfession: form.spouseProfession || undefined,

        housingZone: form.housingZone || undefined,
        housingType: form.housingType || undefined,
        gardenAreaM2: form.gardenAreaM2 ? Number(form.gardenAreaM2) : undefined,
        apartmentAreaM2: form.apartmentAreaM2 ? Number(form.apartmentAreaM2) : undefined,
        fenceHeight: form.fenceHeight || undefined,
        gardenAccessDetails: form.gardenAccessDetails || undefined,
        residencyStatus: form.residencyStatus || undefined,
        residencyDuration: form.residencyDuration || undefined,
        livingSituation: form.livingSituation || undefined,

        familySize: form.familySize ? Number(form.familySize) : undefined,
        childrenCount: form.childrenCount ? Number(form.childrenCount) : 0,
        allergiesDetails: form.allergiesDetails || undefined,
        activityLevel: form.activityLevel || undefined,
        familyAgrees: form.familyAgrees,
        familyDisagreementReason: form.familyAgrees
          ? undefined
          : form.familyDisagreementReason || undefined,

        hasOtherAnimals: form.hasOtherAnimals,
        otherAnimalsDetails: form.hasOtherAnimals ? form.otherAnimalsDetails || undefined : undefined,

        caretakerPerson: form.caretakerPerson || undefined,
        sleepingArea: form.sleepingArea || undefined,
        aloneTimePerDay: form.aloneTimePerDay || undefined,
        dogWalksPerDay:
          form.desiredSpecies === "chien" && form.dogWalksPerDay
            ? Number(form.dogWalksPerDay)
            : undefined,
        dogMiddayWalkPossible:
          form.desiredSpecies === "chien" ? form.dogMiddayWalkPossible : undefined,
        vacationPlan: form.vacationPlan || undefined,

        desiredSpecies: form.desiredSpecies || undefined,
        specificAnimalName: form.specificAnimalName || undefined,
        additionalComments: form.additionalComments || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <PartyPopper className="size-8 text-primary" />
          <h2 className="text-lg font-semibold">Merci !</h2>
          <p className="text-sm text-muted-foreground">
            {"Votre candidature a bien été envoyée. L'association reviendra vers vous prochainement si votre profil correspond à un de nos protégés. Si vous n'avez pas de nouvelle de nous d'ici 2 semaines, considérez qe votre profil n'a pas été retenu pour le moment."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Honeypot — invisible and unreachable by keyboard for real visitors, so only bots fill it in. */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Vos coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldRow>
            <Field label="Prénom" htmlFor="ad-first-name" className="flex-1" required>
              <Input id="ad-first-name" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="Nom" htmlFor="ad-last-name" className="flex-1" required>
              <Input id="ad-last-name" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
          </FieldRow>
          <Field label="Ville" htmlFor="ad-city" required>
            <Input id="ad-city" required value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <FieldRow>
            <Field label="Téléphone" htmlFor="ad-phone" className="flex-1" required>
              <Input id="ad-phone" required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Adresse mail" htmlFor="ad-email" className="flex-1" required>
              <Input id="ad-email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Quel âge avez-vous ?" htmlFor="ad-age" className="flex-1" required>
              <Input id="ad-age" required type="number" min="0" value={form.age} onChange={(e) => set("age", e.target.value)} />
            </Field>
            <Field label="Ainsi que votre conjoint·e ? (si applicable)" htmlFor="ad-spouse-age" className="flex-1">
              <Input
                id="ad-spouse-age"
                type="number"
                min="0"
                value={form.spouseAge}
                onChange={(e) => set("spouseAge", e.target.value)}
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Quelle est votre profession ?" htmlFor="ad-profession" className="flex-1" required>
              <Input id="ad-profession" required value={form.profession} onChange={(e) => set("profession", e.target.value)} />
            </Field>
            <Field label="Et celle de votre conjoint·e ? (si applicable)" htmlFor="ad-spouse-profession" className="flex-1">
              <Input
                id="ad-spouse-profession"
                value={form.spouseProfession}
                onChange={(e) => set("spouseProfession", e.target.value)}
              />
            </Field>
          </FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Votre logement</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldRow>
            <Field label="Votre logement est en zone" htmlFor="ad-housing-zone" className="flex-1" required>
              <Select
                id="ad-housing-zone"
                value={form.housingZone}
                onChange={(e) => set("housingZone", e.target.value as HousingZone)}
                required
              >
                <option value="">—</option>
                {HOUSING_ZONE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Votre logement est un/une" htmlFor="ad-housing-type" className="flex-1" required>
              <Select
                id="ad-housing-type"
                value={form.housingType}
                onChange={(e) => set("housingType", e.target.value as HousingType)}
                required
              >
                <option value="">—</option>
                {HOUSING_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>
          {form.housingType === "appartement" ? (
            <Field label="Superficie de l'appartement (m²)" htmlFor="ad-apartment-area" required>
              <Input
                id="ad-apartment-area"
                type="number"
                required
                min="0"
                value={form.apartmentAreaM2}
                onChange={(e) => set("apartmentAreaM2", e.target.value)}
              />
            </Field>
          ) : (
            <>
              <FieldRow>
                <Field
                  label="Superficie du jardin (m²)"
                  htmlFor="ad-garden-area"
                  className="flex-1"
                  required={form.housingType === "maison"}
                >
                  <Input
                    id="ad-garden-area"
                    type="number"
                    required={form.housingType === "maison" ? true: false}
                    min="0"
                    value={form.gardenAreaM2}
                    onChange={(e) => set("gardenAreaM2", e.target.value)}
                  />
                </Field>
                <Field
                  label="Hauteur des clôtures (précisez si pas clôturé)"
                  htmlFor="ad-fence-height"
                  className="flex-1"
                  required={form.housingType === "maison"}
                >
                  <Input id="ad-fence-height" required={form.housingType === "maison" ? true: false} value={form.fenceHeight} onChange={(e) => set("fenceHeight", e.target.value)} />
                </Field>
              </FieldRow>
              <Field
                label="Votre animal aura-t-il accès à votre jardin ? Si NAC, pourra-t-il être mis en liberté ?"
                htmlFor="ad-garden-access"
              >
                <Textarea
                  id="ad-garden-access"
                  value={form.gardenAccessDetails}
                  onChange={(e) => set("gardenAccessDetails", e.target.value)}
                />
              </Field>
            </>
          )}
          <FieldRow>
            <Field label="Vous êtes" htmlFor="ad-residency-status" className="flex-1" required>
              <Select
                id="ad-residency-status"
                value={form.residencyStatus}
                required
                onChange={(e) => set("residencyStatus", e.target.value as ResidencyStatus)}
              >
                <option value="">—</option>
                {RESIDENCY_STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Depuis combien de temps vivez-vous à cet endroit ?" htmlFor="ad-residency-duration" className="flex-1">
              <Input
                id="ad-residency-duration"
                value={form.residencyDuration}
                onChange={(e) => set("residencyDuration", e.target.value)}
              />
            </Field>
          </FieldRow>
          <Field label="Vivez-vous" htmlFor="ad-living-situation" required>
            <Select
              id="ad-living-situation"
              value={form.livingSituation}
              required
              onChange={(e) => set("livingSituation", e.target.value as LivingSituation)}
            >
              <option value="">—</option>
              {LIVING_SITUATION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Votre foyer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldRow>
            <Field label="De combien de personnes se compose la famille ?" htmlFor="ad-family-size" className="flex-1" required>
              <Input
                id="ad-family-size"
                type="number"
                required
                min="1"
                value={form.familySize}
                onChange={(e) => set("familySize", e.target.value)}
              />
            </Field>
            <Field label="Dont combien d'enfants ?" htmlFor="ad-children-count" className="flex-1" required>
              <Input
                id="ad-children-count"
                type="number"
                required
                min="0"
                value={form.childrenCount}
                onChange={(e) => set("childrenCount", e.target.value)}
              />
            </Field>
          </FieldRow>
          <Field label="Y a-t-il des cas d'allergie dans la famille ?" htmlFor="ad-allergies" hint="Si oui, précisez à quoi. Laissez vide sinon.">
            <Textarea
              id="ad-allergies"
              value={form.allergiesDetails}
              onChange={(e) => set("allergiesDetails", e.target.value)}
            />
          </Field>
          <Field label="Quel est le niveau d'activité de la famille ?" htmlFor="ad-activity-level" required>
            <Select
              id="ad-activity-level"
              value={form.activityLevel}
              required
              onChange={(e) => set("activityLevel", e.target.value as ActivityLevel)}
            >
              <option value="">—</option>
              {ACTIVITY_LEVEL_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Toute la famille est-elle d'accord pour accueillir l'animal ?" htmlFor="ad-family-agrees" required>
            <Select
              id="ad-family-agrees"
              value={form.familyAgrees ? "oui" : "non"}
              required
              onChange={(e) => set("familyAgrees", e.target.value === "oui")}
            >
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </Select>
          </Field>
          {!form.familyAgrees && (
            <Field label="Si non, pourquoi ?" htmlFor="ad-family-disagreement" required>
              <Textarea
                id="ad-family-disagreement"
                required
                value={form.familyDisagreementReason}
                onChange={(e) => set("familyDisagreementReason", e.target.value)}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Animaux déjà présents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label htmlFor="ad-has-other-animals" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="ad-has-other-animals"
              checked={form.hasOtherAnimals}
              onChange={(e) => set("hasOtherAnimals", e.target.checked)}
            />
            Avez-vous d&apos;autres animaux ?
          </label>
          {form.hasOtherAnimals && (
            <Field
              label="Précisez vos animaux (type / race / âge / si stérilisé / dernière date de vaccin)"
              htmlFor="ad-other-animals-details"
              required
            >
              <Textarea
                id="ad-other-animals-details"
                value={form.otherAnimalsDetails}
                required
                onChange={(e) => set("otherAnimalsDetails", e.target.value)}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organisation du quotidien</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Qui se chargera de soigner (et sortir si chien) l'animal ?" htmlFor="ad-caretaker" required>
            <Input id="ad-caretaker" required value={form.caretakerPerson} onChange={(e) => set("caretakerPerson", e.target.value)} />
          </Field>
          <Field label="Dans quel espace l'animal dormira ?" htmlFor="ad-sleeping-area" required>
            <Input id="ad-sleeping-area" required value={form.sleepingArea} onChange={(e) => set("sleepingArea", e.target.value)} />
          </Field>
          <Field label="Combien de temps l'animal restera seul par jour ?" htmlFor="ad-alone-time" required>
            <Select
              id="ad-alone-time"
              value={form.aloneTimePerDay}
              required
              onChange={(e) => set("aloneTimePerDay", e.target.value as AloneTime)}
            >
              <option value="">—</option>
              {ALONE_TIME_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {form.desiredSpecies === "chien" && (
            <>
              <Field label="Si c'est un chien : combien de fois par jour allez-vous le promener ?" htmlFor="ad-dog-walks">
                <Input
                  id="ad-dog-walks"
                  type="number"
                  min="0"
                  value={form.dogWalksPerDay}
                  onChange={(e) => set("dogWalksPerDay", e.target.value)}
                />
              </Field>
              <label htmlFor="ad-dog-midday" className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="ad-dog-midday"
                  checked={form.dogMiddayWalkPossible}
                  onChange={(e) => set("dogMiddayWalkPossible", e.target.checked)}
                />
                Si vous travaillez toute la journée, quelqu&apos;un pourra-t-il le sortir entre midi et deux ?
              </label>
            </>
          )}
          <Field label="Que ferez-vous de votre animal pendant les weekends / vacances ?" htmlFor="ad-vacation-plan" required>
            <Textarea id="ad-vacation-plan" required value={form.vacationPlan} onChange={(e) => set("vacationPlan", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Votre souhait d&apos;adoption</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Type d'animal souhaité" htmlFor="ad-desired-species" required>
            <Select
              id="ad-desired-species"
              value={form.desiredSpecies}
              required
              onChange={(e) => {
                const species = e.target.value as AnimalSpecies;
                set("desiredSpecies", species);
                // The "coup de cœur" list below is filtered by this species
                // — clear a pick that no longer matches it.
                if (selectedAnimal && selectedAnimal.species !== species) {
                  setSelectedAnimalId("");
                  set("specificAnimalName", "");
                }
              }}
            >
              <option value="">—</option>
              {SPECIES_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Un coup de cœur pour un animal précis ?"
            htmlFor="ad-specific-animal-select"
            hint="Liste filtrée selon le type d'animal choisi ci-dessus. Si l'animal qui vous intéresse n'y apparaît pas, c'est qu'il a déjà été adopté."
          >
            <Select
              id="ad-specific-animal-select"
              value={selectedAnimalId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedAnimalId(id);
                const animal = adoptableAnimals.find((a) => a.id === id);
                set("specificAnimalName", animal?.name ?? "");
              }}
            >
              <option value="">— Animaux à l&apos;adoption —</option>
              {visibleAnimals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name}
                  {animal.status === "reserve" ? " (⚠️ réservé)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          {selectedAnimal?.status === "reserve" && (
            <Badge variant="warning" className="self-start">
              Attention : cet animal est actuellement réservé par une autre famille.
            </Badge>
          )}
          <Field
            label="Ou précisez librement (nom, race, description...)"
            htmlFor="ad-specific-animal"
          >
            <Input
              id="ad-specific-animal"
              value={form.specificAnimalName}
              onChange={(e) => {
                setSelectedAnimalId("");
                set("specificAnimalName", e.target.value);
              }}
            />
          </Field>
          <Field label="Si vous souhaitez nous partager quelque chose, c'est le moment !" htmlFor="ad-additional-comments">
            <Textarea
              id="ad-additional-comments"
              value={form.additionalComments}
              onChange={(e) => set("additionalComments", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} size="lg" className="self-start">
        Envoyer ma candidature
      </Button>
    </form>
  );
}
