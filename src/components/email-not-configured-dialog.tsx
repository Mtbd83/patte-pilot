"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Must match the exact message thrown by sendEmail() in src/lib/mailer.ts when organizationSmtp is null. */
const EMAIL_NOT_CONFIGURED_MESSAGE = "Configurez une adresse email d'envoi avant d'envoyer des emails.";

export function isEmailNotConfiguredError(message: string | null | undefined): boolean {
  return message === EMAIL_NOT_CONFIGURED_MESSAGE;
}

/**
 * Shown instead of the generic inline error whenever an action fails
 * specifically because the organization hasn't configured its own sending
 * address yet — links straight to where that's fixed, rather than leaving
 * the admin to go find Paramètres on their own.
 */
export function EmailNotConfiguredDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const params = useParams<{ org: string }>();

  return (
    <Dialog open={open} onClose={onClose} title="Adresse email non configurée">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Votre association doit configurer sa propre adresse email d&apos;envoi avant de pouvoir envoyer des
          invitations, certificats ou contrats.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/organisations/${params.org}/parametres#email-envoi`} onClick={onClose}>
              Configurer maintenant
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Plus tard
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
