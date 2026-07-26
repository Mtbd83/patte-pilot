"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendEngagementCertificate } from "@/server/actions/documents";

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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
      <div>
        <label htmlFor="cert-animal">Animal</label>
        <select
          id="cert-animal"
          required
          value={animalId}
          onChange={(e) => setAnimalId(e.target.value)}
          style={{ display: "block", width: "100%" }}
        >
          <option value="">— Sélectionner —</option>
          {animals.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.name}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor="cert-email">
        Email du destinataire
        <input
          id="cert-email"
          type="email"
          required
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div>
        <button type="submit" disabled={pending || !animalId}>
          Envoyer le certificat d&apos;engagement
        </button>
      </div>
    </form>
  );
}
