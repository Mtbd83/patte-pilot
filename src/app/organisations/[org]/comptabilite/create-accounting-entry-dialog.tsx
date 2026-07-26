"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAccountingEntry } from "@/server/actions/accounting";
import { ACCOUNTING_TYPE_LABELS, ACCOUNTING_CATEGORY_LABELS } from "@/lib/accounting-labels";
import type { AccountingCategory, AccountingType } from "@/db/schema";

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
    return <button onClick={() => setOpen(true)}>Ajouter une écriture</button>;
  }

  return (
    <div
      role="dialog"
      aria-label="Ajouter une écriture"
      style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, marginTop: 16, maxWidth: 420 }}
    >
      <h2>Ajouter une écriture</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label htmlFor="entry-date">
          Date
          <input
            id="entry-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="entry-type">Type</label>
            <select
              id="entry-type"
              value={type}
              onChange={(e) => setType(e.target.value as AccountingType)}
              style={{ display: "block", width: "100%" }}
            >
              {TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="entry-category">Catégorie</label>
            <select
              id="entry-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as AccountingCategory)}
              style={{ display: "block", width: "100%" }}
            >
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="entry-amount">
          Montant (€)
          <input
            id="entry-amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <div>
          <label htmlFor="entry-animal">Animal lié (optionnel)</label>
          <select
            id="entry-animal"
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
            style={{ display: "block", width: "100%" }}
          >
            <option value="">— Aucun —</option>
            {animals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name}
              </option>
            ))}
          </select>
        </div>

        <label htmlFor="entry-comment">
          Commentaire
          <input
            id="entry-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={pending}>
            Ajouter
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
