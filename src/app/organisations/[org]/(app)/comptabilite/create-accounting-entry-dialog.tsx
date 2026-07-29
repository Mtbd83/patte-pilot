"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAccountingEntry } from "@/server/actions/accounting";
import type { AccountingCategory, AccountingType } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { AccountingEntryFormFields, type AnimalOption } from "./accounting-entry-form-fields";

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
          <AccountingEntryFormFields
            idPrefix="entry"
            date={date}
            onDateChange={setDate}
            type={type}
            onTypeChange={setType}
            category={category}
            onCategoryChange={setCategory}
            amount={amount}
            onAmountChange={setAmount}
            animalId={animalId}
            onAnimalIdChange={setAnimalId}
            comment={comment}
            onCommentChange={setComment}
            animals={animals}
          />

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
