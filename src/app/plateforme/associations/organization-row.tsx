"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateOrganizationIdentity,
  deleteOrganizationAsPlatformManager,
} from "@/server/actions/platform";
import type { Organization } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow } from "@/components/ui/field";
import { TableRow, TableCell } from "@/components/ui/table";

export function OrganizationRow({ organization }: { organization: Organization }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "editing" | "deleting">("view");
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [confirmName, setConfirmName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await updateOrganizationIdentity({ organizationId: organization.id, name, slug });
      toast.success("Association mise à jour");
      setMode("view");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteOrganizationAsPlatformManager({ organizationId: organization.id, confirmName });
      toast.success("Association supprimée");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  if (mode === "editing") {
    return (
      <TableRow>
        <TableCell colSpan={4}>
          <form onSubmit={handleSave} className="flex flex-col gap-3 py-2">
            <FieldRow>
              <Field label="Nom" htmlFor={`org-name-${organization.id}`} className="flex-1">
                <Input id={`org-name-${organization.id}`} required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Slug (URL)" htmlFor={`org-slug-${organization.id}`} className="flex-1">
                <Input id={`org-slug-${organization.id}`} required value={slug} onChange={(e) => setSlug(e.target.value)} />
              </Field>
            </FieldRow>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Enregistrer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")} disabled={pending}>
                Annuler
              </Button>
            </div>
          </form>
        </TableCell>
      </TableRow>
    );
  }

  if (mode === "deleting") {
    return (
      <TableRow>
        <TableCell colSpan={4}>
          <div className="flex flex-col gap-3 py-2">
            <Field
              label={`Retapez « ${organization.name} » pour confirmer la suppression`}
              htmlFor={`org-confirm-${organization.id}`}
              hint="Action définitive : supprime aussi ses animaux, candidatures, familles d'accueil, comptabilité, stock, membres..."
            >
              <Input
                id={`org-confirm-${organization.id}`}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={pending || confirmName !== organization.name}
              >
                Supprimer définitivement
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode("view");
                  setConfirmName("");
                  setError(null);
                }}
                disabled={pending}
              >
                Annuler
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{organization.name}</TableCell>
      <TableCell className="text-muted-foreground">/{organization.slug}</TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(organization.createdAt).toLocaleDateString("fr-FR")}
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("editing")}>
            Modifier
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("deleting")}>
            Supprimer
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
