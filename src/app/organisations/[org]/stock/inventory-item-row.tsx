"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateInventoryItem,
  adjustInventoryQuantity,
  deleteInventoryItem,
} from "@/server/actions/inventory";
import { INVENTORY_CATEGORY_LABELS, INVENTORY_STATUS_LABELS } from "@/lib/inventory-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type { AnimalSpecies, InventoryCategory, InventoryItem } from "@/db/schema";

const CATEGORY_OPTIONS = Object.entries(INVENTORY_CATEGORY_LABELS) as [InventoryCategory, string][];
const SPECIES_OPTIONS = Object.entries(SPECIES_LABELS) as [AnimalSpecies, string][];

export function InventoryItemRow({
  organizationId,
  item,
}: {
  organizationId: string;
  item: InventoryItem;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [articleName, setArticleName] = useState(item.articleName);
  const [category, setCategory] = useState<InventoryCategory>(item.category);
  const [animalSpecies, setAnimalSpecies] = useState<AnimalSpecies | "">(item.animalSpecies ?? "");
  const [minQuantity, setMinQuantity] = useState(String(item.minQuantity));
  const [unitPrice, setUnitPrice] = useState(item.unitPrice ?? "");
  const [expirationDate, setExpirationDate] = useState(item.expirationDate ?? "");

  async function handleAdjust(delta: number) {
    setPending(true);
    try {
      await adjustInventoryQuantity({ itemId: item.id, organizationId, delta });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    try {
      await deleteInventoryItem({ itemId: item.id, organizationId });
      toast.success("Article supprimé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateInventoryItem({
        itemId: item.id,
        organizationId,
        articleName,
        category,
        animalSpecies: animalSpecies || null,
        minQuantity: Number(minQuantity),
        unitPrice: unitPrice === "" ? null : Number(unitPrice),
        expirationDate: expirationDate || null,
      });
      toast.success("Article mis à jour");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <tr style={{ borderBottom: "1px solid #eee" }}>
        <td style={{ padding: "8px 4px" }}>{item.articleName}</td>
        <td style={{ padding: "8px 4px" }}>{INVENTORY_CATEGORY_LABELS[item.category]}</td>
        <td style={{ padding: "8px 4px" }}>
          {item.animalSpecies ? SPECIES_LABELS[item.animalSpecies] : "Tous"}
        </td>
        <td style={{ padding: "8px 4px" }}>
          <button onClick={() => handleAdjust(-1)} disabled={pending || item.quantity <= 0}>
            -
          </button>{" "}
          <span>{item.quantity}</span>{" "}
          <button onClick={() => handleAdjust(1)} disabled={pending}>
            +
          </button>
        </td>
        <td style={{ padding: "8px 4px" }}>{item.minQuantity}</td>
        <td style={{ padding: "8px 4px" }}>
          {item.unitPrice ? `${Number(item.unitPrice).toFixed(2)} €` : "—"}
        </td>
        <td style={{ padding: "8px 4px" }}>{item.expirationDate || "—"}</td>
        <td style={{ padding: "8px 4px" }}>{INVENTORY_STATUS_LABELS[item.status]}</td>
        <td style={{ padding: "8px 4px", display: "flex", gap: 8 }}>
          <button onClick={() => setEditing((v) => !v)}>{editing ? "Fermer" : "Modifier"}</button>
          <button onClick={handleDelete} disabled={pending}>
            Supprimer
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={9} style={{ padding: "12px 4px", background: "#fafafa" }}>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
            >
              <div>
                <label htmlFor={`edit-name-${item.id}`}>Article</label>
                <input
                  id={`edit-name-${item.id}`}
                  required
                  value={articleName}
                  onChange={(e) => setArticleName(e.target.value)}
                  style={{ display: "block" }}
                />
              </div>
              <div>
                <label htmlFor={`edit-category-${item.id}`}>Catégorie</label>
                <select
                  id={`edit-category-${item.id}`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                  style={{ display: "block" }}
                >
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`edit-species-${item.id}`}>Type d&apos;animal</label>
                <select
                  id={`edit-species-${item.id}`}
                  value={animalSpecies}
                  onChange={(e) => setAnimalSpecies(e.target.value as AnimalSpecies | "")}
                  style={{ display: "block" }}
                >
                  <option value="">Tous</option>
                  {SPECIES_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`edit-min-${item.id}`}>Stock min.</label>
                <input
                  id={`edit-min-${item.id}`}
                  type="number"
                  min="0"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  style={{ display: "block" }}
                />
              </div>
              <div>
                <label htmlFor={`edit-price-${item.id}`}>Prix unit. (€)</label>
                <input
                  id={`edit-price-${item.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  style={{ display: "block" }}
                />
              </div>
              <div>
                <label htmlFor={`edit-expiration-${item.id}`}>Expiration</label>
                <input
                  id={`edit-expiration-${item.id}`}
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  style={{ display: "block" }}
                />
              </div>
              {error && <p style={{ color: "crimson" }}>{error}</p>}
              <button type="submit" disabled={pending}>
                Enregistrer
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
