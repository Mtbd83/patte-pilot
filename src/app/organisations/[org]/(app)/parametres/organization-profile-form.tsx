"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganizationProfile } from "@/server/actions/organizations";
import type { Organization } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow } from "@/components/ui/field";

export function OrganizationProfileForm({ organization }: { organization: Organization }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(organization.name);
  const [contactEmail, setContactEmail] = useState(organization.contactEmail ?? "");
  const [siren, setSiren] = useState(organization.siren ?? "");
  const [registrationAuthority, setRegistrationAuthority] = useState(
    organization.registrationAuthority ?? "",
  );
  const [registrationNumber, setRegistrationNumber] = useState(
    organization.registrationNumber ?? "",
  );
  const [address, setAddress] = useState(organization.address ?? "");
  const [postalCode, setPostalCode] = useState(organization.postalCode ?? "");
  const [city, setCity] = useState(organization.city ?? "");
  const [phone1, setPhone1] = useState(organization.phone1 ?? "");
  const [phone2, setPhone2] = useState(organization.phone2 ?? "");
  const [iban, setIban] = useState(organization.iban ?? "");
  const [treasurerName, setTreasurerName] = useState(organization.treasurerName ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateOrganizationProfile({
        organizationId: organization.id,
        name,
        contactEmail: contactEmail || undefined,
        siren: siren || undefined,
        registrationAuthority: registrationAuthority || undefined,
        registrationNumber: registrationNumber || undefined,
        address: address || undefined,
        postalCode: postalCode || undefined,
        city: city || undefined,
        phone1: phone1 || undefined,
        phone2: phone2 || undefined,
        iban: iban || undefined,
        treasurerName: treasurerName || undefined,
      });
      toast.success("Profil de l'association mis à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <Field label="Nom de l'association" htmlFor="org-name">
        <Input id="org-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="Email de contact" htmlFor="org-contact-email">
        <Input
          id="org-contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </Field>

      <Field label="SIREN" htmlFor="org-siren">
        <Input id="org-siren" value={siren} onChange={(e) => setSiren(e.target.value)} />
      </Field>

      <FieldRow>
        <Field label="Déclarée en (ex. sous-préfecture du Var)" htmlFor="org-registration-authority" className="flex-1">
          <Input
            id="org-registration-authority"
            value={registrationAuthority}
            onChange={(e) => setRegistrationAuthority(e.target.value)}
          />
        </Field>
        <Field label="Numéro de déclaration" htmlFor="org-registration-number" className="flex-1">
          <Input
            id="org-registration-number"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
          />
        </Field>
      </FieldRow>

      <Field label="Adresse" htmlFor="org-address">
        <Input id="org-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>

      <FieldRow>
        <Field label="Code postal" htmlFor="org-postal-code" className="flex-1">
          <Input id="org-postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </Field>
        <Field label="Ville" htmlFor="org-city" className="flex-1">
          <Input id="org-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Téléphone 1" htmlFor="org-phone1" className="flex-1">
          <Input id="org-phone1" value={phone1} onChange={(e) => setPhone1(e.target.value)} />
        </Field>
        <Field label="Téléphone 2" htmlFor="org-phone2" className="flex-1">
          <Input id="org-phone2" value={phone2} onChange={(e) => setPhone2(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field
          label="IBAN"
          htmlFor="org-iban"
          hint="Utilisé dans le mail de contrat d'adoption (paiement par virement)."
          className="flex-1"
        >
          <Input id="org-iban" value={iban} onChange={(e) => setIban(e.target.value)} />
        </Field>
        <Field
          label="Trésorière / trésorier"
          htmlFor="org-treasurer-name"
          hint="Nom à l'ordre duquel les chèques doivent être établis."
          className="flex-1"
        >
          <Input
            id="org-treasurer-name"
            value={treasurerName}
            onChange={(e) => setTreasurerName(e.target.value)}
          />
        </Field>
      </FieldRow>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
