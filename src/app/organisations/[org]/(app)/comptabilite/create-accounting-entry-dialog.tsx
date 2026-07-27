"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAccountingEntry } from "@/server/actions/accounting";
import { ACCOUNTING_TYPE_LABELS, ACCOUNTING_CATEGORY_LABELS } from "@/lib/accounting-labels";
import type { AccountingCategory, AccountingType } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

const TYPE_OPTIONS = Object.entries(ACCOUNTING_TYPE_LABELS) as [AccountingType, string][];
const CATEGORY_OPTIONS = Object.entries(ACCOUNTING_CATEGORY_LABELS) as [AccountingCategory, string][];

interface AnimalOption {
  id: string;
  name: string;
}

export function CreateAccountingEntryDialog({
  organizationId,
  animals,
}: {
  organizationId: string;
  animals: AnimalOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<AccountingType>("sortie");
  const [category, setCategory] = useState<AccountingCategory>("autre");
  const [amount, setAmount] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [comment, setComment] = useState("");

  function reset() {
    setDate(new Date().toISOString().slice(0, 10));
    setType("sortie");
    setCategory("autre");
    setAmount("");
    setAnimalId("");
    setComment("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createAccountingEntry({
        organizationId,
        date,
        type,
        category,
        amount: Number(amount),
        animalId: animalId || undefined,
        comment: comment || undefined,
      });
      toast.success("Écriture ajoutée");
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
        <Plus /> Ajouter une écriture
      </Button>
    );
  }

  return (
    <Card role="dialog" aria-label="Ajouter une écriture" className="max-w-md">
      <CardHeader>
        <CardTitle>Ajouter une écriture</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <Field label="Date" htmlFor="entry-date">
            <Input id="entry-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <FieldRow>
            <Field label="Type" htmlFor="entry-type" className="flex-1">
              <Select id="entry-type" value={type} onChange={(e) => setType(e.target.value as AccountingType)}>
                {TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Catégorie" htmlFor="entry-category" className="flex-1">
              <Select
                id="entry-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as AccountingCategory)}
              >
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>

          <Field label="Montant (€)" htmlFor="entry-amount">
            <Input
              id="entry-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>

          <Field label="Animal lié (optionnel)" htmlFor="entry-animal">
            <Select id="entry-animal" value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
              <option value="">— Aucun —</option>
              {animals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Commentaire" htmlFor="entry-comment">
            <Input id="entry-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" disabled={pending}>
            Ajouter
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
