"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateAndSendAdoptionContract, previewAdoptionContract } from "@/server/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldRow } from "@/components/ui/field";

interface AnimalOption {
  id: string;
  name: string;
}

export function GenerateContractForm({
  organizationId,
  applicationId,
  animals,
  defaultAnimalId,
  defaultEmail,
  defaultAdopterFullName,
  defaultAdopterCity,
  defaultAdopterPhone1,
}: {
  organizationId: string;
  applicationId: string;
  animals: AnimalOption[];
  defaultAnimalId: string;
  defaultEmail: string;
  defaultAdopterFullName: string;
  defaultAdopterCity: string;
  defaultAdopterPhone1: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Revoke the previous object URL whenever a new preview replaces it, or
  // the component unmounts, so we don't leak memory across re-generations.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const [animalId, setAnimalId] = useState(defaultAnimalId);
  const [toEmail, setToEmail] = useState(defaultEmail);
  const [adopterFullName, setAdopterFullName] = useState(defaultAdopterFullName);
  const [adopterAddress, setAdopterAddress] = useState("");
  const [adopterPostalCode, setAdopterPostalCode] = useState("");
  const [adopterCity, setAdopterCity] = useState(defaultAdopterCity);
  const [adopterPhone1, setAdopterPhone1] = useState(defaultAdopterPhone1);
  const [adopterPhone2, setAdopterPhone2] = useState("");
  const [sterilizationDone, setSterilizationDone] = useState(false);
  const [healthCertificateOk, setHealthCertificateOk] = useState(true);
  const [vetFeesAmount, setVetFeesAmount] = useState("");
  const [sterilizationFeesAmount, setSterilizationFeesAmount] = useState("");
  const [freeDonationAmount, setFreeDonationAmount] = useState("");
  const [freeDonationReason, setFreeDonationReason] = useState("");
  const [signaturePlace, setSignaturePlace] = useState("");
  const [signatureDate, setSignatureDate] = useState(() => new Date().toISOString().slice(0, 10));

  function buildPayload() {
    return {
      organizationId,
      animalId,
      adoptionApplicationId: applicationId,
      toEmail,
      adopterFullName,
      adopterAddress: adopterAddress || undefined,
      adopterPostalCode,
      adopterCity,
      adopterPhone1,
      adopterPhone2: adopterPhone2 || undefined,
      sterilizationDone,
      healthCertificateOk,
      vetFeesAmount: Number(vetFeesAmount),
      sterilizationFeesAmount: sterilizationFeesAmount ? Number(sterilizationFeesAmount) : undefined,
      freeDonationAmount: freeDonationAmount ? Number(freeDonationAmount) : undefined,
      freeDonationReason: freeDonationReason || undefined,
      signaturePlace,
      signatureDate,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await generateAndSendAdoptionContract(buildPayload());
      toast.success("Contrat d'adoption généré et envoyé");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handlePreview() {
    setError(null);
    setPreviewPending(true);
    try {
      const { pdfBase64 } = await previewAdoptionContract(buildPayload());
      const byteChars = atob(pdfBase64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      // Rendered inline via an <iframe> rather than opened in a new tab:
      // browsers block programmatic top-level navigation to blob:/data:
      // URLs (a security measure against disguised phishing pages), so a
      // new-tab preview silently fails. An iframe in the same document has
      // no such restriction.
      setPreviewUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPreviewPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <Field label="Animal" htmlFor="contract-animal">
        <Select id="contract-animal" required value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {animals.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Email du destinataire" htmlFor="contract-email">
        <Input
          id="contract-email"
          type="email"
          required
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
        />
      </Field>

      <Field label="Nom de l'adoptant·e" htmlFor="contract-adopter-name">
        <Input
          id="contract-adopter-name"
          required
          value={adopterFullName}
          onChange={(e) => setAdopterFullName(e.target.value)}
        />
      </Field>

      <Field
        label="Adresse"
        htmlFor="contract-adopter-address"
        hint="Facultative : cette information n'est pas demandée dans le formulaire d'adoption."
      >
        <Input
          id="contract-adopter-address"
          value={adopterAddress}
          onChange={(e) => setAdopterAddress(e.target.value)}
        />
      </Field>

      <FieldRow>
        <Field label="Code postal" htmlFor="contract-adopter-postal-code" className="flex-1">
          <Input
            id="contract-adopter-postal-code"
            required
            value={adopterPostalCode}
            onChange={(e) => setAdopterPostalCode(e.target.value)}
          />
        </Field>
        <Field label="Ville" htmlFor="contract-adopter-city" className="flex-1">
          <Input
            id="contract-adopter-city"
            required
            value={adopterCity}
            onChange={(e) => setAdopterCity(e.target.value)}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Téléphone 1" htmlFor="contract-adopter-phone1" className="flex-1">
          <Input
            id="contract-adopter-phone1"
            required
            value={adopterPhone1}
            onChange={(e) => setAdopterPhone1(e.target.value)}
          />
        </Field>
        <Field label="Téléphone 2" htmlFor="contract-adopter-phone2" className="flex-1">
          <Input
            id="contract-adopter-phone2"
            value={adopterPhone2}
            onChange={(e) => setAdopterPhone2(e.target.value)}
          />
        </Field>
      </FieldRow>

      <div className="flex flex-col gap-2">
        <label htmlFor="contract-sterilized" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="contract-sterilized"
            checked={sterilizationDone}
            onChange={(e) => setSterilizationDone(e.target.checked)}
          />
          Stérilisé / castré
        </label>
        <label htmlFor="contract-health-cert" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="contract-health-cert"
            checked={healthCertificateOk}
            onChange={(e) => setHealthCertificateOk(e.target.checked)}
          />
          Certificat de bonne santé fourni
        </label>
      </div>

      <FieldRow>
        <Field label="Frais vétérinaires (€)" htmlFor="contract-vet-fees" className="flex-1">
          <Input
            id="contract-vet-fees"
            type="number"
            step="0.01"
            min="0"
            required
            value={vetFeesAmount}
            onChange={(e) => setVetFeesAmount(e.target.value)}
          />
        </Field>
        <Field label="Frais stérilisation (€)" htmlFor="contract-sterilization-fees" className="flex-1">
          <Input
            id="contract-sterilization-fees"
            type="number"
            step="0.01"
            min="0"
            value={sterilizationFeesAmount}
            onChange={(e) => setSterilizationFeesAmount(e.target.value)}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Don libre (€)" htmlFor="contract-donation-amount" className="flex-1">
          <Input
            id="contract-donation-amount"
            type="number"
            step="0.01"
            min="0"
            value={freeDonationAmount}
            onChange={(e) => setFreeDonationAmount(e.target.value)}
          />
        </Field>
        <Field label="Motif du don" htmlFor="contract-donation-reason" className="flex-1">
          <Input
            id="contract-donation-reason"
            value={freeDonationReason}
            onChange={(e) => setFreeDonationReason(e.target.value)}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Fait à" htmlFor="contract-place" className="flex-1">
          <Input
            id="contract-place"
            required
            value={signaturePlace}
            onChange={(e) => setSignaturePlace(e.target.value)}
          />
        </Field>
        <Field label="Le" htmlFor="contract-date" className="flex-1">
          <Input
            id="contract-date"
            type="date"
            required
            value={signatureDate}
            onChange={(e) => setSignatureDate(e.target.value)}
          />
        </Field>
      </FieldRow>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handlePreview} disabled={previewPending || !animalId}>
          Prévisualiser le PDF
        </Button>
        <Button type="submit" disabled={pending || !animalId}>
          Générer et envoyer le contrat
        </Button>
      </div>

      {previewUrl && (
        <iframe
          src={previewUrl}
          title="Aperçu du contrat d'adoption"
          className="h-[600px] w-full rounded-md border border-border"
        />
      )}
    </form>
  );
}
