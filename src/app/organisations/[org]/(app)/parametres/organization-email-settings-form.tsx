"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganizationEmailSettings } from "@/server/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

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
  const [email, setEmail] = useState(smtpUser ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [host, setHost] = useState(smtpHost ?? "");
  const [port, setPort] = useState(smtpPort ? String(smtpPort) : "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasAppPassword && !appPassword) {
      setError("Le mot de passe d'application est requis pour la première configuration.");
      return;
    }

    setPending(true);
    try {
      await updateOrganizationEmailSettings({
        organizationId,
        smtpUser: email,
        smtpAppPassword: appPassword || undefined,
        smtpHost: host || undefined,
        smtpPort: port ? Number(port) : undefined,
      });
      toast.success("Adresse d'envoi mise à jour");
      setAppPassword("");
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

      <Field label="Adresse email d'envoi" htmlFor="org-smtp-user">
        <Input
          id="org-smtp-user"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field
        label="Mot de passe d'application"
        htmlFor="org-smtp-password"
        hint={
          hasAppPassword ? (
            "Laissez vide pour conserver le mot de passe déjà enregistré."
          ) : (
            <>
              Avec un compte Gmail : générez-le sur{" "}
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
              ). Avec un autre fournisseur, utilisez le mot de passe SMTP fourni par celui-ci, ci-dessous.
            </>
          )
        }
      >
        <Input
          id="org-smtp-password"
          type="password"
          autoComplete="new-password"
          placeholder={hasAppPassword ? "••••••••••••••••" : undefined}
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
        />
      </Field>

      <details className="rounded-md border border-border">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground">
          Autre fournisseur que Gmail
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-3">
          <p className="text-xs text-muted-foreground">
            Laissez vide pour utiliser Gmail. Sinon, renseignez le serveur SMTP de votre fournisseur (Outlook,
            OVH, votre hébergeur...).
          </p>
          <Field label="Serveur SMTP" htmlFor="org-smtp-host">
            <Input
              id="org-smtp-host"
              placeholder="smtp.gmail.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </Field>
          <Field label="Port" htmlFor="org-smtp-port">
            <Input
              id="org-smtp-port"
              type="number"
              placeholder="465"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </Field>
        </div>
      </details>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
