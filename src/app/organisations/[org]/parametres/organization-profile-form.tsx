"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganizationProfile } from "@/server/actions/organizations";
import type { Organization } from "@/db/schema";

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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
      <label htmlFor="org-name">
        Nom de l&apos;association
        <input
          id="org-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <label htmlFor="org-contact-email">
        Email de contact
        <input
          id="org-contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <label htmlFor="org-siren">
        SIREN
        <input
          id="org-siren"
          value={siren}
          onChange={(e) => setSiren(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="org-registration-authority" style={{ flex: 1 }}>
          Déclarée en (ex. sous-préfecture du Var)
          <input
            id="org-registration-authority"
            value={registrationAuthority}
            onChange={(e) => setRegistrationAuthority(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="org-registration-number" style={{ flex: 1 }}>
          Numéro de déclaration
          <input
            id="org-registration-number"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <label htmlFor="org-address">
        Adresse
        <input
          id="org-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="org-postal-code" style={{ flex: 1 }}>
          Code postal
          <input
            id="org-postal-code"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="org-city" style={{ flex: 1 }}>
          Ville
          <input
            id="org-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="org-phone1" style={{ flex: 1 }}>
          Téléphone 1
          <input
            id="org-phone1"
            value={phone1}
            onChange={(e) => setPhone1(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="org-phone2" style={{ flex: 1 }}>
          Téléphone 2
          <input
            id="org-phone2"
            value={phone2}
            onChange={(e) => setPhone2(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div>
        <button type="submit" disabled={pending}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}
