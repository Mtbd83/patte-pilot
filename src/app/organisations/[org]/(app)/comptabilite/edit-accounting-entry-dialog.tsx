"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateAccountingEntry } from "@/server/actions/accounting";
import type { AccountingCategory, AccountingEntry, AccountingType } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AccountingEntryFormFields, type AnimalOption } from "./accounting-entry-form-fields";

export function EditAccountingEntryDialog({
  organizationId,
  entry,
  animals,
}: {
  organizationId: string;
  entry: AccountingEntry;
  animals: AnimalOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeded fresh from `entry` every time the dialog opens (not once at mount)
  // so a stale client instance can never submit another row's data — see
  // handleOpen below.
  const [date, setDate] = useState(entry.date);
  const [type, setType] = useState<AccountingType>(entry.type);
  const [category, setCategory] = useState<AccountingCategory>(entry.category);
  const [amount, setAmount] = useState(entry.amount);
  const [animalId, setAnimalId] = useState(entry.animalId ?? "");
  const [comment, setComment] = useState(entry.comment ?? "");

  function handleOpen() {
    setDate(entry.date);
    setType(entry.type);
    setCategory(entry.category);
    setAmount(entry.amount);
    setAnimalId(entry.animalId ?? "");
    setComment(entry.comment ?? "");
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateAccountingEntry({
        entryId: entry.id,
        organizationId,
        date,
        type,
        category,
        amount: Number(amount),
        animalId: animalId || undefined,
        comment: comment || undefined,
      });
      toast.success("Écriture mise à jour");
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
      <Button variant="ghost" size="sm" onClick={handleOpen}>
        <Pencil /> Modifier
      </Button>
      <Dialog open={open} onClose={handleClose} title="Modifier l'écriture">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AccountingEntryFormFields
            idPrefix={`edit-${entry.id}`}
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

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Enregistrer
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={pending}>
              Annuler
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
