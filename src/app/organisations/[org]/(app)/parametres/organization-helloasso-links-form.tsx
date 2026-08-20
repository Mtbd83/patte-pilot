"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createHelloAssoLink,
  updateHelloAssoLink,
  deleteHelloAssoLink,
} from "@/server/actions/helloasso-links";
import type { OrganizationHelloAssoLink } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow } from "@/components/ui/field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

function HelloAssoLinkRow({
  organizationId,
  link,
}: {
  organizationId: string;
  link: OrganizationHelloAssoLink;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState(link.label);
  const [url, setUrl] = useState(link.url);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateHelloAssoLink({ linkId: link.id, organizationId, label, url });
      toast.success("Lien mis à jour");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    try {
      await deleteHelloAssoLink({ linkId: link.id, organizationId });
      toast.success("Lien supprimé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={3}>
          <form onSubmit={handleSave} className="flex flex-col gap-3 py-2">
            <FieldRow>
              <Field label="Libellé" htmlFor={`link-label-${link.id}`} className="flex-1">
                <Input
                  id={`link-label-${link.id}`}
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
              <Field label="Lien" htmlFor={`link-url-${link.id}`} className="flex-[2]">
                <Input
                  id={`link-url-${link.id}`}
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
            </FieldRow>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Enregistrer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{link.label}</TableCell>
      <TableCell className="max-w-xs truncate text-muted-foreground">{link.url}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Modifier
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending}>
            Supprimer
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function OrganizationHelloAssoLinksForm({
  organizationId,
  links,
}: {
  organizationId: string;
  links: OrganizationHelloAssoLink[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createHelloAssoLink({ organizationId, label, url });
      toast.success("Lien ajouté");
      setLabel("");
      setUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {links.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Lien</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <HelloAssoLinkRow key={link.id} organizationId={organizationId} link={link} />
            ))}
          </TableBody>
        </Table>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <FieldRow>
          <Field label="Libellé" htmlFor="new-link-label" className="flex-1">
            <Input
              id="new-link-label"
              placeholder="ex : Chaton vaccin complet"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Field label="Lien" htmlFor="new-link-url" className="flex-[2]">
            <Input
              id="new-link-url"
              type="url"
              placeholder="https://www.helloasso.com/... (ou autre plateforme de paiement)"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        </FieldRow>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            Ajouter un lien
          </Button>
        </div>
      </form>
    </div>
  );
}
