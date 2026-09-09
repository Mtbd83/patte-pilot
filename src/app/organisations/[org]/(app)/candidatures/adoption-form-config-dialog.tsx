"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { updateAdoptionFormConfig } from "@/server/actions/adoption-applications";
import {
  ADOPTION_QUESTION_BANK,
  ADOPTION_QUESTION_CATEGORY_LABELS,
  findAdoptionQuestion,
  type AdoptionQuestion,
} from "@/lib/adoption-question-bank";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type { AnimalSpecies } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";

const MAX_FREE_QUESTIONS = 2;

const QUESTIONS_BY_CATEGORY = new Map<AdoptionQuestion["category"], AdoptionQuestion[]>();
for (const question of ADOPTION_QUESTION_BANK) {
  const list = QUESTIONS_BY_CATEGORY.get(question.category) ?? [];
  list.push(question);
  QUESTIONS_BY_CATEGORY.set(question.category, list);
}

/**
 * Admin-only: which bank questions (see src/lib/adoption-question-bank.ts)
 * appear on this organization's public adoption form, plus up to two fully
 * custom free-text questions it writes itself.
 */
export function AdoptionFormConfigDialog({
  organizationId,
  currentQuestionKeys,
  currentFreeQuestions,
}: {
  organizationId: string;
  currentQuestionKeys: string[];
  currentFreeQuestions: { label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [questionKeys, setQuestionKeys] = useState<string[]>(currentQuestionKeys);
  // Always exactly MAX_FREE_QUESTIONS slots in the UI — an empty label means "unused".
  const [freeLabels, setFreeLabels] = useState<string[]>(
    Array.from({ length: MAX_FREE_QUESTIONS }, (_, i) => currentFreeQuestions[i]?.label ?? ""),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleQuestion(key: string, checked: boolean) {
    setQuestionKeys((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  }

  async function handleSave() {
    setError(null);
    setPending(true);
    try {
      const freeQuestions = freeLabels
        .map((label) => label.trim())
        .filter((label) => label.length > 0)
        .map((label) => ({ label }));
      await updateAdoptionFormConfig({ organizationId, questionKeys, freeQuestions });
      toast.success("Formulaire d'adoption mis à jour");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings /> Paramétrer le formulaire
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Formulaire d'adoption"
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">
            Le formulaire public affiche toujours l&apos;identité du candidat et l&apos;animal
            recherché. Choisissez ici les questions supplémentaires à poser, tirées d&apos;une
            banque commune à toutes les associations, plus jusqu&apos;à {MAX_FREE_QUESTIONS}{" "}
            questions entièrement libres.
          </p>

          {Array.from(QUESTIONS_BY_CATEGORY.entries()).map(([category, questions]) => (
            <div key={category} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{ADOPTION_QUESTION_CATEGORY_LABELS[category]}</p>
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                {questions.map((question) => (
                  <label key={question.key} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      className="mt-0.5"
                      checked={questionKeys.includes(question.key)}
                      onChange={(e) => toggleQuestion(question.key, e.target.checked)}
                    />
                    <span>
                      {question.label}
                      {question.options && (
                        <span className="block text-xs">
                          Choix : {question.options.map((option) => option.label).join(" / ")}
                        </span>
                      )}
                      {question.dependsOnSpecies && (
                        <span className="block text-xs">
                          N&apos;apparaît sur le formulaire que si l&apos;animal souhaité choisi est :{" "}
                          {question.dependsOnSpecies.map((species) => SPECIES_LABELS[species as AnimalSpecies]).join(" / ")}
                        </span>
                      )}
                      {question.dependsOnAnswer && (
                        <span className="block text-xs">
                          N&apos;apparaît que si la réponse à «{" "}
                          {findAdoptionQuestion(question.dependsOnAnswer.questionKey)?.label} » est :{" "}
                          {question.dependsOnAnswer.values
                            .map(
                              (value) =>
                                findAdoptionQuestion(question.dependsOnAnswer!.questionKey)?.options?.find(
                                  (option) => option.value === value,
                                )?.label ?? value,
                            )
                            .join(" / ")}
                        </span>
                      )}
                      {question.hint && <span className="block text-xs italic">{question.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Questions libres (facultatif)</p>
            {freeLabels.map((label, index) => (
              <Field key={index} label={`Question libre ${index + 1}`} htmlFor={`free-question-${index}`}>
                <Input
                  id={`free-question-${index}`}
                  value={label}
                  onChange={(e) =>
                    setFreeLabels((prev) => prev.map((l, i) => (i === index ? e.target.value : l)))
                  }
                />
              </Field>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={pending}>
              Enregistrer
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
