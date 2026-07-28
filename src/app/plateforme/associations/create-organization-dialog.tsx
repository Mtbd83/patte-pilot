"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createOrganizationAsPlatformManager } from "@/server/actions/platform";
import { slugify } from "@/lib/slugify";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export function CreateOrganizationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setAdminEmail("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createOrganizationAsPlatformManager({ name, slug, adminEmail });
      toast.success("Association créée, invitation envoyée");
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
    <>
      <Button onClick={() => setOpen(true)}>Créer une association</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Créer une association">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nom de l'association" htmlFor="create-org-name">
            <Input
              id="create-org-name"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </Field>
          <Field label="Slug (URL)" htmlFor="create-org-slug">
            <Input
              id="create-org-slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </Field>
          <Field
            label="Email de la première administratrice / du premier administrateur"
            htmlFor="create-org-admin-email"
          >
            <Input
              id="create-org-admin-email"
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={pending}>
            Créer et envoyer l&apos;invitation
          </Button>
        </form>
      </Dialog>
    </>
  );
}
