"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganizationEmailSettings } from "@/server/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

const GMAIL_HOST = "smtp.gmail.com";
const GMAIL_PORT = "465";

type Provider = "gmail" | "other";

export function OrganizationEmailSettingsForm({
  organizationId,
  smtpUser,
  hasAppPassword,
  smtpHost,
  smtpPort,
}: {
  organizationId: string;
  smtpUser: string | null;
  hasAppPassword: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A custom host already saved means this org picked "other" before —
  // otherwise Gmail (the simple default) is the starting point.
  const [provider, setProvider] = useState<Provider>(smtpHost ? "other" : "gmail");
  const [email, setEmail] = useState(smtpUser ?? "");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState(smtpHost ?? "");
  const [port, setPort] = useState(smtpPort ? String(smtpPort) : "");
  const isGmail = provider === "gmail";

  function handleProviderChange(next: Provider) {
    setProvider(next);
    // Switching to Gmail always uses its fixed host/port — drop any
    // previously entered custom values so they don't get silently resaved.
    if (next === "gmail") {
      setHost("");
      setPort("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasAppPassword && !password) {
      setError("Le mot de passe est requis pour la première configuration.");
      return;
    }
    if (!isGmail && (!host || !port)) {
      setError("Le serveur SMTP et le port sont requis pour un autre fournisseur que Gmail.");
      return;
    }

    setPending(true);
    try {
      await updateOrganizationEmailSettings({
        organizationId,
        smtpUser: email,
        smtpAppPassword: password || undefined,
        smtpHost: isGmail ? undefined : host,
        smtpPort: isGmail ? undefined : Number(port),
      });
      toast.success("Adresse d'envoi mise à jour");
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div>
        <Badge variant={hasAppPassword ? "success" : "warning"}>
          {hasAppPassword ? "Configurée" : "Non configurée"}
        </Badge>
        {!hasAppPassword && (
          <p className="mt-2 text-sm text-muted-foreground">
            Tant que ce n&apos;est pas configuré, les invitations, certificats et contrats ne pourront pas être
            envoyés par email.
          </p>
        )}
      </div>

      <Field label="1. Fournisseur d'envoi" htmlFor="org-smtp-provider">
        <Select
          id="org-smtp-provider"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as Provider)}
        >
          <option value="gmail">Gmail (recommandé)</option>
          <option value="other">Autre fournisseur SMTP (Outlook, OVH...)</option>
        </Select>
      </Field>

      <FieldRow>
        <Field label="2. Serveur SMTP" htmlFor="org-smtp-host" className="flex-[2]">
          <Input
            id="org-smtp-host"
            disabled={isGmail}
            required={!isGmail}
            value={isGmail ? GMAIL_HOST : host}
            onChange={(e) => setHost(e.target.value)}
          />
        </Field>
        <Field label="Port" htmlFor="org-smtp-port" className="flex-1">
          <Input
            id="org-smtp-port"
            type="number"
            disabled={isGmail}
            required={!isGmail}
            value={isGmail ? GMAIL_PORT : port}
            onChange={(e) => setPort(e.target.value)}
          />
        </Field>
      </FieldRow>

      <Field label={isGmail ? "3. Adresse Gmail d'envoi" : "3. Adresse d'envoi"} htmlFor="org-smtp-user">
        <Input
          id="org-smtp-user"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field
        label={isGmail ? "Mot de passe d'application" : "Mot de passe SMTP"}
        htmlFor="org-smtp-password"
        hint={
          hasAppPassword ? (
            "Laissez vide pour conserver le mot de passe déjà enregistré."
          ) : isGmail ? (
            <>
              Générez-le sur{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                myaccount.google.com/apppasswords
              </a>{" "}
              (nécessite la validation en 2 étapes activée sur ce compte Google — voir{" "}
              <a
                href="https://support.google.com/accounts/answer/185833"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                le tutoriel Google
              </a>
              ).
            </>
          ) : (
            "Le mot de passe SMTP fourni par votre fournisseur d'adresse email."
          )
        }
      >
        <Input
          id="org-smtp-password"
          type="password"
          autoComplete="new-password"
          placeholder={hasAppPassword ? "••••••••••••••••" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
