"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { submitOrganizationSignupRequest } from "@/server/actions/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function OrganizationSignupRequestForm() {
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [siren, setSiren] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  // Honeypot: real visitors never see or focus this field (hidden off-screen
  // below); bots that fill in every input on the page trip it.
  const [honeypot, setHoneypot] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await submitOrganizationSignupRequest({
        organizationName,
        contactName,
        contactEmail,
        phone: phone || undefined,
        message: message || undefined,
        siren: siren || undefined,
        address: address || undefined,
        postalCode: postalCode || undefined,
        city: city || undefined,
        honeypot,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <PartyPopper className="size-8 text-primary" />
          <h2 className="text-lg font-semibold">Merci !</h2>
          <p className="text-sm text-muted-foreground">
            Votre demande a bien été envoyée. Nous revenons vers vous par email dès qu&apos;elle a été
            examinée.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Votre association</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Nom de l'association" htmlFor="signup-org-name">
            <Input
              id="signup-org-name"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </Field>
          <FieldRow>
            <Field label="SIREN" htmlFor="signup-siren" className="flex-1">
              <Input id="signup-siren" value={siren} onChange={(e) => setSiren(e.target.value)} />
            </Field>
          </FieldRow>
          <Field label="Adresse" htmlFor="signup-address">
            <Input id="signup-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <FieldRow>
            <Field label="Code postal" htmlFor="signup-postal-code" className="flex-1">
              <Input
                id="signup-postal-code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </Field>
            <Field label="Ville" htmlFor="signup-city" className="flex-1">
              <Input id="signup-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
          </FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Votre contact</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Votre nom" htmlFor="signup-contact-name">
            <Input
              id="signup-contact-name"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>
          <FieldRow>
            <Field label="Email" htmlFor="signup-contact-email" className="flex-1">
              <Input
                id="signup-contact-email"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </Field>
            <Field label="Téléphone" htmlFor="signup-phone" className="flex-1">
              <Input id="signup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </FieldRow>
          <Field label="Un mot sur votre association ?" htmlFor="signup-message">
            <Textarea id="signup-message" value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} size="lg" className="self-start">
        Envoyer ma demande
      </Button>
    </form>
  );
}
