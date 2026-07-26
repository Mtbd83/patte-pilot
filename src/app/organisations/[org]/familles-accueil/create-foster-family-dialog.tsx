"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFosterFamily } from "@/server/actions/foster-families";

export function CreateFosterFamilyDialog({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hasCats, setHasCats] = useState(false);
  const [hasDogs, setHasDogs] = useState(false);
  const [hasRabbits, setHasRabbits] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setHasCats(false);
    setHasDogs(false);
    setHasRabbits(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createFosterFamily({
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
      toast.success("Famille d'accueil ajoutée");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)}>Ajouter une famille d&apos;accueil</button>;
  }

  return (
    <div
      role="dialog"
      aria-label="Ajouter une famille d'accueil"
      style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20, marginTop: 16, maxWidth: 420 }}
    >
      <h2>Ajouter une famille d&apos;accueil</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <label htmlFor="ff-first-name" style={{ flex: 1 }}>
            Prénom
            <input
              id="ff-first-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="ff-last-name" style={{ flex: 1 }}>
            Nom
            <input
              id="ff-last-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>

        <label htmlFor="ff-address">
          Adresse
          <input
            id="ff-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <label htmlFor="ff-phone" style={{ flex: 1 }}>
            Téléphone
            <input
              id="ff-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label htmlFor="ff-email" style={{ flex: 1 }}>
            Email
            <input
              id="ff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend>Autres animaux déjà présents</legend>
          <label htmlFor="ff-has-cats" style={{ display: "block" }}>
            <input
              id="ff-has-cats"
              type="checkbox"
              checked={hasCats}
              onChange={(e) => setHasCats(e.target.checked)}
            />
            Chats
          </label>
          <label htmlFor="ff-has-dogs" style={{ display: "block" }}>
            <input
              id="ff-has-dogs"
              type="checkbox"
              checked={hasDogs}
              onChange={(e) => setHasDogs(e.target.checked)}
            />
            Chiens
          </label>
          <label htmlFor="ff-has-rabbits" style={{ display: "block" }}>
            <input
              id="ff-has-rabbits"
              type="checkbox"
              checked={hasRabbits}
              onChange={(e) => setHasRabbits(e.target.checked)}
            />
            Lapins
          </label>
        </fieldset>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={pending}>
            Ajouter
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
