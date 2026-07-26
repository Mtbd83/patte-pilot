"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendEngagementCertificate } from "@/server/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={pending || !animalId}>
          Envoyer le certificat d&apos;engagement
        </Button>
      </div>
    </form>
  );
}
