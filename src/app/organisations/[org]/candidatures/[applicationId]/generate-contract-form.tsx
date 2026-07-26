"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateAndSendAdoptionContract, previewAdoptionContract } from "@/server/actions/documents";
import type { AdoptionContractPaymentMethod } from "@/lib/adoption-contract-pdf";

const PAYMENT_METHOD_OPTIONS: [AdoptionContractPaymentMethod, string][] = [
  ["especes", "Espèces"],
  ["cheque", "Chèque"],
  ["virement", "Virement"],
  ["cb", "CB"],
];

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
  const [paymentMethod, setPaymentMethod] = useState<AdoptionContractPaymentMethod>("especes");
  const [signaturePlace, setSignaturePlace] = useState("");
  const [signatureDate, setSignatureDate] = useState(() => new Date().toISOString().slice(0, 10));

  function buildPayload() {
    return {
      organizationId,
      animalId,
      adoptionApplicationId: applicationId,
      toEmail,
      adopterFullName,
      adopterAddress,
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
      paymentMethod,
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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
      <div>
        <label htmlFor="contract-animal">Animal</label>
        <select
          id="contract-animal"
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

      <label htmlFor="contract-email">
        Email du destinataire
        <input
          id="contract-email"
          type="email"
          required
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <label htmlFor="contract-adopter-name">
        Nom de l&apos;adoptant·e
        <input
          id="contract-adopter-name"
          required
          value={adopterFullName}
          onChange={(e) => setAdopterFullName(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <label htmlFor="contract-adopter-address">
        Adresse
        <input
          id="contract-adopter-address"
          required
          value={adopterAddress}
          onChange={(e) => setAdopterAddress(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="contract-adopter-postal-code" style={{ flex: 1 }}>
          Code postal
          <input
            id="contract-adopter-postal-code"
            required
            value={adopterPostalCode}
            onChange={(e) => setAdopterPostalCode(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="contract-adopter-city" style={{ flex: 1 }}>
          Ville
          <input
            id="contract-adopter-city"
            required
            value={adopterCity}
            onChange={(e) => setAdopterCity(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="contract-adopter-phone1" style={{ flex: 1 }}>
          Téléphone 1
          <input
            id="contract-adopter-phone1"
            required
            value={adopterPhone1}
            onChange={(e) => setAdopterPhone1(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="contract-adopter-phone2" style={{ flex: 1 }}>
          Téléphone 2
          <input
            id="contract-adopter-phone2"
            value={adopterPhone2}
            onChange={(e) => setAdopterPhone2(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <label htmlFor="contract-sterilized">
        <input
          id="contract-sterilized"
          type="checkbox"
          checked={sterilizationDone}
          onChange={(e) => setSterilizationDone(e.target.checked)}
        />{" "}
        Stérilisé / castré
      </label>
      <label htmlFor="contract-health-cert">
        <input
          id="contract-health-cert"
          type="checkbox"
          checked={healthCertificateOk}
          onChange={(e) => setHealthCertificateOk(e.target.checked)}
        />{" "}
        Certificat de bonne santé fourni
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="contract-vet-fees" style={{ flex: 1 }}>
          Frais vétérinaires (€)
          <input
            id="contract-vet-fees"
            type="number"
            step="0.01"
            min="0"
            required
            value={vetFeesAmount}
            onChange={(e) => setVetFeesAmount(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="contract-sterilization-fees" style={{ flex: 1 }}>
          Frais stérilisation (€)
          <input
            id="contract-sterilization-fees"
            type="number"
            step="0.01"
            min="0"
            value={sterilizationFeesAmount}
            onChange={(e) => setSterilizationFeesAmount(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="contract-donation-amount" style={{ flex: 1 }}>
          Don libre (€)
          <input
            id="contract-donation-amount"
            type="number"
            step="0.01"
            min="0"
            value={freeDonationAmount}
            onChange={(e) => setFreeDonationAmount(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="contract-donation-reason" style={{ flex: 1 }}>
          Motif du don
          <input
            id="contract-donation-reason"
            value={freeDonationReason}
            onChange={(e) => setFreeDonationReason(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <div>
        <label htmlFor="contract-payment-method">Payé en</label>
        <select
          id="contract-payment-method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as AdoptionContractPaymentMethod)}
          style={{ display: "block", width: "100%" }}
        >
          {PAYMENT_METHOD_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="contract-place" style={{ flex: 1 }}>
          Fait à
          <input
            id="contract-place"
            required
            value={signaturePlace}
            onChange={(e) => setSignaturePlace(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="contract-date" style={{ flex: 1 }}>
          Le
          <input
            id="contract-date"
            type="date"
            required
            value={signatureDate}
            onChange={(e) => setSignatureDate(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewPending || !animalId}
        >
          Prévisualiser le PDF
        </button>
        <button type="submit" disabled={pending || !animalId}>
          Générer et envoyer le contrat
        </button>
      </div>

      {previewUrl && (
        <iframe
          src={previewUrl}
          title="Aperçu du contrat d'adoption"
          style={{ width: "100%", height: 600, border: "1px solid #ddd", borderRadius: 8 }}
        />
      )}
    </form>
  );
}
