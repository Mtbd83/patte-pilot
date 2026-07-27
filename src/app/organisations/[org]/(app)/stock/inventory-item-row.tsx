"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import {
  updateInventoryItem,
  adjustInventoryQuantity,
  deleteInventoryItem,
} from "@/server/actions/inventory";
import { INVENTORY_CATEGORY_LABELS, INVENTORY_STATUS_LABELS, INVENTORY_STATUS_BADGE_VARIANT } from "@/lib/inventory-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type { AnimalSpecies, InventoryCategory, InventoryItem } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { TableRow, TableCell } from "@/components/ui/table";

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
      <TableRow>
        <TableCell className="font-medium">{item.articleName}</TableCell>
        <TableCell>{INVENTORY_CATEGORY_LABELS[item.category]}</TableCell>
        <TableCell>{item.animalSpecies ? SPECIES_LABELS[item.animalSpecies] : "Tous"}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="-"
              onClick={() => handleAdjust(-1)}
              disabled={pending || item.quantity <= 0}
            >
              <Minus />
            </Button>
            <span className="w-6 text-center">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="+"
              onClick={() => handleAdjust(1)}
              disabled={pending}
            >
              <Plus />
            </Button>
          </div>
        </TableCell>
        <TableCell>{item.minQuantity}</TableCell>
        <TableCell>{item.unitPrice ? `${Number(item.unitPrice).toFixed(2)} €` : "—"}</TableCell>
        <TableCell>{item.expirationDate || "—"}</TableCell>
        <TableCell>
          <Badge variant={INVENTORY_STATUS_BADGE_VARIANT[item.status]}>{INVENTORY_STATUS_LABELS[item.status]}</Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? "Fermer" : "Modifier"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending}>
              Supprimer
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {editing && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/50">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
              <FieldRow>
                <Field label="Article" htmlFor={`edit-name-${item.id}`} className="flex-1">
                  <Input
                    id={`edit-name-${item.id}`}
                    required
                    value={articleName}
                    onChange={(e) => setArticleName(e.target.value)}
                  />
                </Field>
                <Field label="Catégorie" htmlFor={`edit-category-${item.id}`} className="flex-1">
                  <Select
                    id={`edit-category-${item.id}`}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                  >
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="Type d'animal" htmlFor={`edit-species-${item.id}`} className="flex-1">
                  <Select
                    id={`edit-species-${item.id}`}
                    value={animalSpecies}
                    onChange={(e) => setAnimalSpecies(e.target.value as AnimalSpecies | "")}
                  >
                    <option value="">Tous</option>
                    {SPECIES_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Stock min." htmlFor={`edit-min-${item.id}`} className="flex-1">
                  <Input
                    id={`edit-min-${item.id}`}
                    type="number"
                    min="0"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                  />
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="Prix unit. (€)" htmlFor={`edit-price-${item.id}`} className="flex-1">
                  <Input
                    id={`edit-price-${item.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </Field>
                <Field label="Expiration" htmlFor={`edit-expiration-${item.id}`} className="flex-1">
                  <Input
                    id={`edit-expiration-${item.id}`}
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </Field>
              </FieldRow>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={pending} className="self-start">
                Enregistrer
              </Button>
            </form>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
