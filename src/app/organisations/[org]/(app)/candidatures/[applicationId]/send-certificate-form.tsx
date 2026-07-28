"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendEngagementCertificate, previewCertificateEmail } from "@/server/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

interface AnimalOption {
  id: string;
  name: string;
}

export function SendCertificateForm({
  organizationId,
  applicationId,
  animals,
  defaultAnimalId,
  defaultEmail,
}: {
  organizationId: string;
  applicationId: string;
  animals: AnimalOption[];
  defaultAnimalId: string;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [animalId, setAnimalId] = useState(defaultAnimalId);
  const [toEmail, setToEmail] = useState(defaultEmail);
  const [pending, setPending] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setError(null);
    setPreviewPending(true);
    try {
      const preview = await previewCertificateEmail({
        organizationId,
        animalId,
        adoptionApplicationId: applicationId,
      });
      setSubject(preview.subject);
      setBody(preview.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await sendEngagementCertificate({
        organizationId,
        animalId,
        adoptionApplicationId: applicationId,
        toEmail,
        subject,
        body,
      });
      toast.success("Certificat d'engagement envoyé");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <Field label="Animal" htmlFor="cert-animal">
        <Select id="cert-animal" required value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {animals.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Email du destinataire" htmlFor="cert-email">
        <Input id="cert-email" type="email" required value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
      </Field>

      <div>
        <Button type="button" variant="outline" onClick={handlePreview} disabled={previewPending || !animalId}>
          Générer l&apos;aperçu du mail
        </Button>
      </div>

      {subject && (
        <>
          <Field label="Sujet" htmlFor="cert-subject">
            <Input id="cert-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message" htmlFor="cert-body">
            <Textarea id="cert-body" required rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={pending || !animalId || !subject || !body}>
          Envoyer le certificat d&apos;engagement
        </Button>
      </div>
    </form>
  );
}
