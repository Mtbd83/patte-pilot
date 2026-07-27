"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createInventoryItem } from "@/server/actions/inventory";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/inventory-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import type { AnimalSpecies, InventoryCategory } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

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
    return (
      <Button onClick={() => setOpen(true)} className="self-start">
        <Plus /> Ajouter un article
      </Button>
    );
  }

  return (
    <Card role="dialog" aria-label="Ajouter un article" className="max-w-md">
      <CardHeader>
        <CardTitle>Ajouter un article</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <Field label="Article" htmlFor="item-article-name">
            <Input
              id="item-article-name"
              required
              value={articleName}
              onChange={(e) => setArticleName(e.target.value)}
            />
          </Field>

          <FieldRow>
            <Field label="Catégorie" htmlFor="item-category" className="flex-1">
              <Select
                id="item-category"
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
            <Field label="Type d'animal" htmlFor="item-species" className="flex-1">
              <Select
                id="item-species"
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
          </FieldRow>

          <FieldRow>
            <Field label="Quantité" htmlFor="item-quantity" className="flex-1">
              <Input
                id="item-quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="Stock min." htmlFor="item-min-quantity" className="flex-1">
              <Input
                id="item-min-quantity"
                type="number"
                min="0"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Prix unit. (€)" htmlFor="item-unit-price" className="flex-1">
              <Input
                id="item-unit-price"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </Field>
            <Field label="Expiration" htmlFor="item-expiration" className="flex-1">
              <Input
                id="item-expiration"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </Field>
          </FieldRow>

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
