"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateFosterFamily } from "@/server/actions/foster-families";
import type { FosterFamily } from "@/db/schema";

export function FosterFamilyEditForm({
  organizationId,
  fosterFamily,
}: {
  organizationId: string;
  fosterFamily: FosterFamily;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(fosterFamily.firstName);
  const [lastName, setLastName] = useState(fosterFamily.lastName);
  const [address, setAddress] = useState(fosterFamily.address ?? "");
  const [phone, setPhone] = useState(fosterFamily.phone ?? "");
  const [email, setEmail] = useState(fosterFamily.email ?? "");
  const [hasCats, setHasCats] = useState(fosterFamily.hasCats);
  const [hasDogs, setHasDogs] = useState(fosterFamily.hasDogs);
  const [hasRabbits, setHasRabbits] = useState(fosterFamily.hasRabbits);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateFosterFamily({
        fosterFamilyId: fosterFamily.id,
        organizationId,
        firstName,
        lastName,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        hasCats,
        hasDogs,
        hasRabbits,
      });
      toast.success("Famille d'accueil mise à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="ff-edit-first-name" style={{ flex: 1 }}>
          Prénom
          <input
            id="ff-edit-first-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="ff-edit-last-name" style={{ flex: 1 }}>
          Nom
          <input
            id="ff-edit-last-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <label htmlFor="ff-edit-address">
        Adresse
        <input
          id="ff-edit-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label htmlFor="ff-edit-phone" style={{ flex: 1 }}>
          Téléphone
          <input
            id="ff-edit-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label htmlFor="ff-edit-email" style={{ flex: 1 }}>
          Email
          <input
            id="ff-edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend>Autres animaux déjà présents</legend>
        <label htmlFor="ff-edit-has-cats" style={{ display: "block" }}>
          <input
            id="ff-edit-has-cats"
            type="checkbox"
            checked={hasCats}
            onChange={(e) => setHasCats(e.target.checked)}
          />
          Chats
        </label>
        <label htmlFor="ff-edit-has-dogs" style={{ display: "block" }}>
          <input
            id="ff-edit-has-dogs"
            type="checkbox"
            checked={hasDogs}
            onChange={(e) => setHasDogs(e.target.checked)}
          />
          Chiens
        </label>
        <label htmlFor="ff-edit-has-rabbits" style={{ display: "block" }}>
          <input
            id="ff-edit-has-rabbits"
            type="checkbox"
            checked={hasRabbits}
            onChange={(e) => setHasRabbits(e.target.checked)}
          />
          Lapins
        </label>
      </fieldset>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div>
        <button type="submit" disabled={pending}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}
