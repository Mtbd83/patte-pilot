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
}: {
  organizationId: string;
  smtpUser: string | null;
  hasAppPassword: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(smtpUser ?? "");
  const [appPassword, setAppPassword] = useState("");

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

      <Field label="Adresse Gmail d'envoi" htmlFor="org-smtp-user">
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
          hasAppPassword
            ? "Laissez vide pour conserver le mot de passe déjà enregistré."
            : "Généré depuis myaccount.google.com/apppasswords (nécessite la validation en 2 étapes activée sur ce compte Google)."
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
