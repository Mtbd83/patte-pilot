"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createSupplyRequest } from "@/server/actions/supply-requests";
import { SUPPLY_REQUEST_CATEGORY_LABELS, SUPPLY_REQUEST_STATUS_LABELS } from "@/lib/supply-request-labels";
import type { SupplyRequest, SupplyRequestCategory } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const CATEGORY_OPTIONS = Object.entries(SUPPLY_REQUEST_CATEGORY_LABELS) as [SupplyRequestCategory, string][];

export function SupplyRequestWidget({
  organizationId,
  requests,
}: {
  organizationId: string;
  requests: SupplyRequest[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<SupplyRequestCategory>("croquettes_chat");
  const [quantity, setQuantity] = useState("1");
  const [comment, setComment] = useState("");

  function reset() {
    setCategory("croquettes_chat");
    setQuantity("1");
    setComment("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createSupplyRequest({
        organizationId,
        category,
        quantity: Number(quantity),
        comment: comment || undefined,
      });
      toast.success("Demande envoyée");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes demandes de fournitures</CardTitle>
        <CardDescription>Croquettes, litière, matériel... signalez ce dont vous avez besoin.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {open ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-md border border-border p-3">
            <FieldRow>
              <Field label="Catégorie" htmlFor="supply-category" className="flex-1">
                <Select
                  id="supply-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupplyRequestCategory)}
                >
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Quantité" htmlFor="supply-quantity" className="w-24">
                <Input
                  id="supply-quantity"
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
            </FieldRow>
            <Field label="Précision (optionnel)" htmlFor="supply-comment">
              <Textarea
                id="supply-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex : taille M, marque particulière..."
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Envoyer la demande
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={pending}
              >
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <Button size="sm" className="self-start" onClick={() => setOpen(true)}>
            <Plus /> Faire une demande
          </Button>
        )}

        {requests.length > 0 && (
          <div className="flex flex-col gap-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  {request.quantity}x {SUPPLY_REQUEST_CATEGORY_LABELS[request.category]}
                  {request.comment && <span className="text-muted-foreground"> — {request.comment}</span>}
                </span>
                <Badge variant={request.status === "pris_en_compte" ? "success" : "warning"}>
                  {SUPPLY_REQUEST_STATUS_LABELS[request.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
