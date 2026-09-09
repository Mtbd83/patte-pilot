"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { submitAdoptionApplication } from "@/server/actions/adoption-applications";
import {
  ADOPTION_QUESTION_BANK,
  ADOPTION_QUESTION_CATEGORY_LABELS,
  isQuestionVisible,
  type AdoptionQuestion,
} from "@/lib/adoption-question-bank";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type { AnimalSpecies, AnimalStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const SPECIES_OPTIONS = Object.entries(SPECIES_LABELS) as [AnimalSpecies, string][];

interface CoreFormState {
  lastName: string;
  firstName: string;
  city: string;
  phone: string;
  email: string;
  age: string;
  spouseAge: string;
  profession: string;
  spouseProfession: string;
  desiredSpecies: AnimalSpecies | "";
  specificAnimalName: string;
}

const INITIAL_CORE_STATE: CoreFormState = {
  lastName: "",
  firstName: "",
  city: "",
  phone: "",
  email: "",
  age: "",
  spouseAge: "",
  profession: "",
  spouseProfession: "",
  desiredSpecies: "",
  specificAnimalName: "",
};

interface AdoptableAnimal {
  id: string;
  name: string;
  species: AnimalSpecies;
  status: AnimalStatus;
}

type Answers = Record<string, string | string[]>;

/** One question from the bank (or a free question), rendered by its declared type. */
function QuestionField({
  question,
  value,
  onChange,
}: {
  question: AdoptionQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  switch (question.type) {
    case "texte_court":
      return (
        <Input
          id={`q-${question.key}`}
          value={(value as string) ?? ""}
          required={question.required}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "texte_long":
      return (
        <Textarea
          id={`q-${question.key}`}
          value={(value as string) ?? ""}
          required={question.required}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "nombre":
      return (
        <Input
          id={`q-${question.key}`}
          type="number"
          min="0"
          value={(value as string) ?? ""}
          required={question.required}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "choix_unique":
      return (
        <Select
          id={`q-${question.key}`}
          value={(value as string) ?? ""}
          required={question.required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {question.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    case "choix_multiple": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-2">
          {question.options?.map((option) => (
            <label key={option.value} htmlFor={`q-${question.key}-${option.value}`} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`q-${question.key}-${option.value}`}
                checked={selected.includes(option.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, option.value]
                      : selected.filter((v) => v !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }
  }
}

export function AdoptionApplicationForm({
  organizationId,
  organizationName,
  adoptionFormQuestionKeys,
  adoptionFormFreeQuestions,
  adoptableAnimals,
}: {
  organizationId: string;
  organizationName: string;
  adoptionFormQuestionKeys: string[] | null;
  adoptionFormFreeQuestions: { label: string }[] | null;
  adoptableAnimals: AdoptableAnimal[];
}) {
  const [core, setCore] = useState<CoreFormState>(INITIAL_CORE_STATE);
  const [answers, setAnswers] = useState<Answers>({});
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Drives the "pick from the list" select below — separate from
  // core.specificAnimalName (the actual free-text field submitted) so a
  // manual edit after picking doesn't leave a stale reserved-animal warning.
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const selectedAnimal = adoptableAnimals.find((a) => a.id === selectedAnimalId);
  const visibleAnimals = core.desiredSpecies
    ? adoptableAnimals.filter((a) => a.species === core.desiredSpecies)
    : adoptableAnimals;
  // Honeypot: real visitors never see or focus this field (hidden off-screen
  // below); bots that fill in every input on the page trip it.
  const [honeypot, setHoneypot] = useState("");

  function setCoreField<K extends keyof CoreFormState>(key: K, value: CoreFormState[K]) {
    setCore((prev) => ({ ...prev, [key]: value }));
  }

  function setAnswer(key: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  const selectedQuestions = ADOPTION_QUESTION_BANK.filter(
    (q) =>
      (adoptionFormQuestionKeys ?? []).includes(q.key) &&
      isQuestionVisible(q, { desiredSpecies: core.desiredSpecies, answers }),
  );
  const questionsByCategory = new Map<AdoptionQuestion["category"], AdoptionQuestion[]>();
  for (const question of selectedQuestions) {
    const list = questionsByCategory.get(question.category) ?? [];
    list.push(question);
    questionsByCategory.set(question.category, list);
  }
  const freeQuestions = adoptionFormFreeQuestions ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await submitAdoptionApplication({
        organizationId,
        honeypot,
        lastName: core.lastName,
        firstName: core.firstName,
        city: core.city,
        phone: core.phone,
        email: core.email,
        age: core.age ? Number(core.age) : undefined,
        spouseAge: core.spouseAge ? Number(core.spouseAge) : undefined,
        profession: core.profession || undefined,
        spouseProfession: core.spouseProfession || undefined,
        desiredSpecies: core.desiredSpecies || undefined,
        specificAnimalName: core.specificAnimalName || undefined,
        answers,
        rgpdConsent,
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
        name="champ_reference_interne"
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
              <Input id="ad-first-name" required value={core.firstName} onChange={(e) => setCoreField("firstName", e.target.value)} />
            </Field>
            <Field label="Nom" htmlFor="ad-last-name" className="flex-1" required>
              <Input id="ad-last-name" required value={core.lastName} onChange={(e) => setCoreField("lastName", e.target.value)} />
            </Field>
          </FieldRow>
          <Field label="Ville" htmlFor="ad-city" required>
            <Input id="ad-city" required value={core.city} onChange={(e) => setCoreField("city", e.target.value)} />
          </Field>
          <FieldRow>
            <Field label="Téléphone" htmlFor="ad-phone" className="flex-1" required>
              <Input id="ad-phone" required value={core.phone} onChange={(e) => setCoreField("phone", e.target.value)} />
            </Field>
            <Field label="Adresse mail" htmlFor="ad-email" className="flex-1" required>
              <Input id="ad-email" type="email" required value={core.email} onChange={(e) => setCoreField("email", e.target.value)} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Quel âge avez-vous ?" htmlFor="ad-age" className="flex-1" required>
              <Input id="ad-age" required type="number" min="0" value={core.age} onChange={(e) => setCoreField("age", e.target.value)} />
            </Field>
            <Field label="Ainsi que votre conjoint·e ? (si applicable)" htmlFor="ad-spouse-age" className="flex-1">
              <Input
                id="ad-spouse-age"
                type="number"
                min="0"
                value={core.spouseAge}
                onChange={(e) => setCoreField("spouseAge", e.target.value)}
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Quelle est votre profession ?" htmlFor="ad-profession" className="flex-1" required>
              <Input id="ad-profession" required value={core.profession} onChange={(e) => setCoreField("profession", e.target.value)} />
            </Field>
            <Field label="Et celle de votre conjoint·e ? (si applicable)" htmlFor="ad-spouse-profession" className="flex-1">
              <Input
                id="ad-spouse-profession"
                value={core.spouseProfession}
                onChange={(e) => setCoreField("spouseProfession", e.target.value)}
              />
            </Field>
          </FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quel animal recherchez-vous ?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Type d'animal souhaité" htmlFor="ad-desired-species" required>
            <Select
              id="ad-desired-species"
              value={core.desiredSpecies}
              required
              onChange={(e) => {
                const species = e.target.value as AnimalSpecies;
                setCoreField("desiredSpecies", species);
                // The "coup de cœur" list below is filtered by this species
                // — clear a pick that no longer matches it.
                if (selectedAnimal && selectedAnimal.species !== species) {
                  setSelectedAnimalId("");
                  setCoreField("specificAnimalName", "");
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
                setCoreField("specificAnimalName", animal?.name ?? "");
              }}
            >
              <option value="">— Animaux à l&apos;adoption —</option>
              {visibleAnimals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name}
                  {animal.status === "reserve" && " (⚠️ réservé)"}
                  {animal.status === "visite_en_cours" && " (⚠️ visite en cours)"}
                </option>
              ))}
            </Select>
          </Field>
          {selectedAnimal?.status === "reserve" && (
            <Badge variant="warning" className="self-start">
              Attention : cet animal est actuellement réservé par une autre famille.
            </Badge>
          )}
          {selectedAnimal?.status === "visite_en_cours" && (
            <Badge variant="warning" className="self-start">
              Attention : une visite est en cours pour cet animal avec une autre famille.
            </Badge>
          )}
          <Field
            label="Ou précisez librement (nom, race, description...)"
            htmlFor="ad-specific-animal"
          >
            <Input
              id="ad-specific-animal"
              value={core.specificAnimalName}
              onChange={(e) => {
                setSelectedAnimalId("");
                setCoreField("specificAnimalName", e.target.value);
              }}
            />
          </Field>
          {(questionsByCategory.get("souhait") ?? []).map((question) => (
            <Field key={question.key} label={question.label} htmlFor={`q-${question.key}`} hint={question.hint} required={question.required}>
              <QuestionField
                question={question}
                value={answers[question.key]}
                onChange={(value) => setAnswer(question.key, value)}
              />
            </Field>
          ))}
        </CardContent>
      </Card>

      {Array.from(questionsByCategory.entries())
        .filter(([category]) => category !== "souhait")
        .map(([category, questions]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{ADOPTION_QUESTION_CATEGORY_LABELS[category]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {questions.map((question) => (
              <Field key={question.key} label={question.label} htmlFor={`q-${question.key}`} hint={question.hint} required={question.required}>
                <QuestionField
                  question={question}
                  value={answers[question.key]}
                  onChange={(value) => setAnswer(question.key, value)}
                />
              </Field>
            ))}
          </CardContent>
        </Card>
      ))}

      {freeQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Autre</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {freeQuestions.map((freeQuestion, index) => {
              const key = `libre_${index + 1}`;
              return (
                <Field key={key} label={freeQuestion.label} htmlFor={`q-${key}`}>
                  <Textarea
                    id={`q-${key}`}
                    value={(answers[key] as string) ?? ""}
                    onChange={(e) => setAnswer(key, e.target.value)}
                  />
                </Field>
              );
            })}
          </CardContent>
        </Card>
      )}

      <label htmlFor="ad-rgpd-consent" className="flex items-start gap-2 text-sm">
        <Checkbox
          id="ad-rgpd-consent"
          required
          checked={rgpdConsent}
          onChange={(e) => setRgpdConsent(e.target.checked)}
        />
        <span>
          J&apos;accepte que {organizationName} conserve mon profil de candidat·e afin de me
          recontacter pour une future adoption, conformément à sa politique de confidentialité.
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} size="lg" className="self-start">
        Envoyer ma candidature
      </Button>
    </form>
  );
}
