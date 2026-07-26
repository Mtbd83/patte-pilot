"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInventoryItem } from "@/server/actions/inventory";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/inventory-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type { AnimalSpecies, InventoryCategory } from "@/db/schema";

const CATEGORY_OPTIONS = Object.entries(INVENTORY_CATEGORY_LABELS) as [InventoryCategory, string][];
const SPECIES_OPTIONS = Object.entries(SPECIES_LABELS) as [AnimalSpecies, string][];

export function CreateInventoryItemDialog({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [articleName, setArticleName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("nourriture");
  const [animalSpecies, setAnimalSpecies] = useState<AnimalSpecies | "">("");
  const [quantity, setQuantity] = useState("0");
  const [minQuantity, setMinQuantity] = useState("0");
  const [unitPrice, setUnitPrice] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  function reset() {
    setArticleName("");
    setCategory("nourriture");
    setAnimalSpecies("");
    setQuantity("0");
    setMinQuantity("0");
    setUnitPrice("");
    setExpirationDate("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createInventoryItem({
        organizationId,
        articleName,
        category,
        animalSpecies: animalSpecies || undefined,
        quantity: Number(quantity),
        minQuantity: Number(minQuantity),
        unitPrice: unitPrice === "" ? undefined : Number(unitPrice),
        expirationDate: expirationDate || undefined,
      });
      toast.success("Article ajouté");
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
    return <button onClick={() => setOpen(true)}>Ajouter un article</button>;
  }

  return (
    <div
      role="dialog"
      aria-label="Ajouter un article"
      style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, marginTop: 16, maxWidth: 420 }}
    >
      <h2>Ajouter un article</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label htmlFor="item-article-name">
          Article
          <input
            id="item-article-name"
            required
            value={articleName}
            onChange={(e) => setArticleName(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="item-category">Catégorie</label>
            <select
              id="item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as InventoryCategory)}
              style={{ display: "block", width: "100%" }}
            >
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="item-species">Type d&apos;animal</label>
            <select
              id="item-species"
              value={animalSpecies}
              onChange={(e) => setAnimalSpecies(e.target.value as AnimalSpecies | "")}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">Tous</option>
              {SPECIES_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <label htmlFor="item-quantity" style={{ flex: 1 }}>
            Quantité
            <input
              id="item-quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="item-min-quantity" style={{ flex: 1 }}>
            Stock min.
            <input
              id="item-min-quantity"
              type="number"
              min="0"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <label htmlFor="item-unit-price" style={{ flex: 1 }}>
            Prix unit. (€)
            <input
              id="item-unit-price"
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="item-expiration" style={{ flex: 1 }}>
            Expiration
            <input
              id="item-expiration"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>

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
