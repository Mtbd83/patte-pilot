"use client";

import { useState } from "react";
import { submitAdoptionApplication } from "@/server/actions/adoption-applications";
import {
  HOUSING_ZONE_LABELS,
  HOUSING_TYPE_LABELS,
  RESIDENCY_STATUS_LABELS,
  LIVING_SITUATION_LABELS,
} from "@/lib/adoption-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type {
  AnimalSpecies,
  HousingType,
  HousingZone,
  LivingSituation,
  ResidencyStatus,
} from "@/db/schema";

const HOUSING_ZONE_OPTIONS = Object.entries(HOUSING_ZONE_LABELS) as [HousingZone, string][];
const HOUSING_TYPE_OPTIONS = Object.entries(HOUSING_TYPE_LABELS) as [HousingType, string][];
const RESIDENCY_STATUS_OPTIONS = Object.entries(RESIDENCY_STATUS_LABELS) as [ResidencyStatus, string][];
const LIVING_SITUATION_OPTIONS = Object.entries(LIVING_SITUATION_LABELS) as [LivingSituation, string][];
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
  fenceHeight: string;
  gardenAccessDetails: string;
  residencyStatus: ResidencyStatus | "";
  residencyDuration: string;
  livingSituation: LivingSituation | "";

  familySize: string;
  childrenCount: string;
  hasAllergies: boolean;
  activityLevel: string;
  familyAgrees: boolean;
  familyDisagreementReason: string;

  hasOtherAnimals: boolean;
  otherAnimalsDetails: string;

  caretakerPerson: string;
  sleepingArea: string;
  aloneTimePerDay: string;
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
  fenceHeight: "",
  gardenAccessDetails: "",
  residencyStatus: "",
  residencyDuration: "",
  livingSituation: "",
  familySize: "",
  childrenCount: "",
  hasAllergies: false,
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

export function AdoptionApplicationForm({ organizationId }: { organizationId: string }) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
        lastName: form.lastName,
        firstName: form.firstName,
        city: form.city || undefined,
        phone: form.phone,
        email: form.email,
        age: form.age ? Number(form.age) : undefined,
        spouseAge: form.spouseAge ? Number(form.spouseAge) : undefined,
        profession: form.profession || undefined,
        spouseProfession: form.spouseProfession || undefined,

        housingZone: form.housingZone || undefined,
        housingType: form.housingType || undefined,
        gardenAreaM2: form.gardenAreaM2 ? Number(form.gardenAreaM2) : undefined,
        fenceHeight: form.fenceHeight || undefined,
        gardenAccessDetails: form.gardenAccessDetails || undefined,
        residencyStatus: form.residencyStatus || undefined,
        residencyDuration: form.residencyDuration || undefined,
        livingSituation: form.livingSituation || undefined,

        familySize: form.familySize ? Number(form.familySize) : undefined,
        childrenCount: form.childrenCount ? Number(form.childrenCount) : 0,
        hasAllergies: form.hasAllergies,
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
      <div>
        <h2>Merci !</h2>
        <p>
          Votre candidature a bien été envoyée. L&apos;association reviendra vers vous
          prochainement.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}
    >
      <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <legend>Vos coordonnées</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <label htmlFor="ad-first-name" style={{ flex: 1 }}>
              Prénom
              <input
                id="ad-first-name"
                required
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <label htmlFor="ad-last-name" style={{ flex: 1 }}>
              Nom
              <input
                id="ad-last-name"
                required
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
          <label htmlFor="ad-city">
            Ville
            <input
              id="ad-city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <label htmlFor="ad-phone" style={{ flex: 1 }}>
              Téléphone
              <input
                id="ad-phone"
                required
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <label htmlFor="ad-email" style={{ flex: 1 }}>
              Adresse mail
              <input
                id="ad-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <label htmlFor="ad-age" style={{ flex: 1 }}>
              Quel âge avez-vous ?
              <input
                id="ad-age"
                type="number"
                min="0"
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <label htmlFor="ad-spouse-age" style={{ flex: 1 }}>
              Ainsi que votre conjoint·e ? (si applicable)
              <input
                id="ad-spouse-age"
                type="number"
                min="0"
                value={form.spouseAge}
                onChange={(e) => set("spouseAge", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <label htmlFor="ad-profession" style={{ flex: 1 }}>
              Quelle est votre profession ?
              <input
                id="ad-profession"
                value={form.profession}
                onChange={(e) => set("profession", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <label htmlFor="ad-spouse-profession" style={{ flex: 1 }}>
              Et celle de votre conjoint·e ? (si applicable)
              <input
                id="ad-spouse-profession"
                value={form.spouseProfession}
                onChange={(e) => set("spouseProfession", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <legend>Votre logement</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="ad-housing-zone">Votre logement est en zone</label>
              <select
                id="ad-housing-zone"
                value={form.housingZone}
                onChange={(e) => set("housingZone", e.target.value as HousingZone)}
                style={{ display: "block", width: "100%" }}
              >
                <option value="">—</option>
                {HOUSING_ZONE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="ad-housing-type">Votre logement est un/une</label>
              <select
                id="ad-housing-type"
                value={form.housingType}
                onChange={(e) => set("housingType", e.target.value as HousingType)}
                style={{ display: "block", width: "100%" }}
              >
                <option value="">—</option>
                {HOUSING_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <label htmlFor="ad-garden-area" style={{ flex: 1 }}>
              Superficie du jardin (m²)
              <input
                id="ad-garden-area"
                type="number"
                min="0"
                value={form.gardenAreaM2}
                onChange={(e) => set("gardenAreaM2", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <label htmlFor="ad-fence-height" style={{ flex: 1 }}>
              Hauteur des clôtures (précisez si pas clôturé)
              <input
                id="ad-fence-height"
                value={form.fenceHeight}
                onChange={(e) => set("fenceHeight", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
          <label htmlFor="ad-garden-access">
            Votre animal aura-t-il accès à votre jardin ? Si NAC, pourra-t-il être mis en liberté
            ?
            <textarea
              id="ad-garden-access"
              value={form.gardenAccessDetails}
              onChange={(e) => set("gardenAccessDetails", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="ad-residency-status">Vous êtes</label>
              <select
                id="ad-residency-status"
                value={form.residencyStatus}
                onChange={(e) => set("residencyStatus", e.target.value as ResidencyStatus)}
                style={{ display: "block", width: "100%" }}
              >
                <option value="">—</option>
                {RESIDENCY_STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label htmlFor="ad-residency-duration" style={{ flex: 1 }}>
              Depuis combien de temps vivez-vous à cet endroit ?
              <input
                id="ad-residency-duration"
                value={form.residencyDuration}
                onChange={(e) => set("residencyDuration", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
          <div>
            <label htmlFor="ad-living-situation">Vivez-vous</label>
            <select
              id="ad-living-situation"
              value={form.livingSituation}
              onChange={(e) => set("livingSituation", e.target.value as LivingSituation)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">—</option>
              {LIVING_SITUATION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <legend>Votre foyer</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <label htmlFor="ad-family-size" style={{ flex: 1 }}>
              De combien de personnes se compose la famille ?
              <input
                id="ad-family-size"
                type="number"
                min="1"
                value={form.familySize}
                onChange={(e) => set("familySize", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <label htmlFor="ad-children-count" style={{ flex: 1 }}>
              Dont combien d&apos;enfants ?
              <input
                id="ad-children-count"
                type="number"
                min="0"
                value={form.childrenCount}
                onChange={(e) => set("childrenCount", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
          <label htmlFor="ad-allergies">
            <input
              id="ad-allergies"
              type="checkbox"
              checked={form.hasAllergies}
              onChange={(e) => set("hasAllergies", e.target.checked)}
            />{" "}
            Y a-t-il des cas d&apos;allergie dans la famille ?
          </label>
          <label htmlFor="ad-activity-level">
            Quel est le niveau d&apos;activité de la famille ?
            <input
              id="ad-activity-level"
              value={form.activityLevel}
              onChange={(e) => set("activityLevel", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <div>
            <label htmlFor="ad-family-agrees">
              Toute la famille est-elle d&apos;accord pour accueillir l&apos;animal ?
            </label>
            <select
              id="ad-family-agrees"
              value={form.familyAgrees ? "oui" : "non"}
              onChange={(e) => set("familyAgrees", e.target.value === "oui")}
              style={{ display: "block", width: "100%" }}
            >
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </div>
          {!form.familyAgrees && (
            <label htmlFor="ad-family-disagreement">
              Si non, pourquoi ?
              <textarea
                id="ad-family-disagreement"
                value={form.familyDisagreementReason}
                onChange={(e) => set("familyDisagreementReason", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <legend>Animaux déjà présents</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label htmlFor="ad-has-other-animals">
            <input
              id="ad-has-other-animals"
              type="checkbox"
              checked={form.hasOtherAnimals}
              onChange={(e) => set("hasOtherAnimals", e.target.checked)}
            />{" "}
            Avez-vous d&apos;autres animaux ?
          </label>
          {form.hasOtherAnimals && (
            <label htmlFor="ad-other-animals-details">
              Précisez vos animaux (type / race / âge / si stérilisé / dernière date de vaccin)
              <textarea
                id="ad-other-animals-details"
                value={form.otherAnimalsDetails}
                onChange={(e) => set("otherAnimalsDetails", e.target.value)}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <legend>Organisation du quotidien</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label htmlFor="ad-caretaker">
            Qui se chargera de soigner (et sortir si chien) l&apos;animal ?
            <input
              id="ad-caretaker"
              value={form.caretakerPerson}
              onChange={(e) => set("caretakerPerson", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="ad-sleeping-area">
            Dans quel espace l&apos;animal dormira ?
            <input
              id="ad-sleeping-area"
              value={form.sleepingArea}
              onChange={(e) => set("sleepingArea", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="ad-alone-time">
            Combien de temps l&apos;animal restera seul par jour ?
            <input
              id="ad-alone-time"
              value={form.aloneTimePerDay}
              onChange={(e) => set("aloneTimePerDay", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          {form.desiredSpecies === "chien" && (
            <>
              <label htmlFor="ad-dog-walks">
                Si c&apos;est un chien : combien de fois par jour allez-vous le promener ?
                <input
                  id="ad-dog-walks"
                  type="number"
                  min="0"
                  value={form.dogWalksPerDay}
                  onChange={(e) => set("dogWalksPerDay", e.target.value)}
                  style={{ display: "block", width: "100%" }}
                />
              </label>
              <label htmlFor="ad-dog-midday">
                <input
                  id="ad-dog-midday"
                  type="checkbox"
                  checked={form.dogMiddayWalkPossible}
                  onChange={(e) => set("dogMiddayWalkPossible", e.target.checked)}
                />{" "}
                Si vous travaillez toute la journée, quelqu&apos;un pourra-t-il le sortir entre
                midi et deux ?
              </label>
            </>
          )}
          <label htmlFor="ad-vacation-plan">
            Que ferez-vous de votre animal pendant les weekends / vacances ?
            <textarea
              id="ad-vacation-plan"
              value={form.vacationPlan}
              onChange={(e) => set("vacationPlan", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <legend>Votre souhait d&apos;adoption</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label htmlFor="ad-desired-species">Type d&apos;animal souhaité</label>
            <select
              id="ad-desired-species"
              value={form.desiredSpecies}
              onChange={(e) => set("desiredSpecies", e.target.value as AnimalSpecies)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">—</option>
              {SPECIES_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label htmlFor="ad-specific-animal">
            Un coup de cœur pour un animal précis ? Précisez son prénom
            <input
              id="ad-specific-animal"
              value={form.specificAnimalName}
              onChange={(e) => set("specificAnimalName", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="ad-additional-comments">
            Si vous souhaitez nous partager quelque chose, c&apos;est le moment !
            <textarea
              id="ad-additional-comments"
              value={form.additionalComments}
              onChange={(e) => set("additionalComments", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>
      </fieldset>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div>
        <button type="submit" disabled={pending}>
          Envoyer ma candidature
        </button>
      </div>
    </form>
  );
}
