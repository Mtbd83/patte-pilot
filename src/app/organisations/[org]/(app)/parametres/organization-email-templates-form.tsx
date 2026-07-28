"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrganizationEmailTemplates } from "@/server/actions/organizations";
import {
  DEFAULT_CERTIFICATE_EMAIL_SUBJECT,
  DEFAULT_CERTIFICATE_EMAIL_BODY,
  DEFAULT_CONTRACT_EMAIL_SUBJECT,
  DEFAULT_CONTRACT_EMAIL_BODY,
} from "@/lib/email-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

const CERTIFICATE_TOKENS_HINT =
  "Variables disponibles : {{prenom}}, {{animal}}, {{date_jour}}, {{date_limite}}, {{expediteur}}.";
const CONTRACT_TOKENS_HINT =
  "Variables : {{prenom}}, {{animal}}, {{montant}}, {{iban}}, {{helloasso_lien}}, {{tresoriere}}, {{expediteur}}, {{date_rappel_vaccin}}. " +
  "Blocs conditionnels : {{#caution_sterilisation}}...{{/caution_sterilisation}} (si non stérilisé), {{#rappel_vaccin}}...{{/rappel_vaccin}} (si le rappel est dû).";

export function OrganizationEmailTemplatesForm({
  organizationId,
  certificateEmailSubject,
  certificateEmailBody,
  contractEmailSubject,
  contractEmailBody,
}: {
  organizationId: string;
  certificateEmailSubject: string | null;
  certificateEmailBody: string | null;
  contractEmailSubject: string | null;
  contractEmailBody: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [certSubject, setCertSubject] = useState(
    certificateEmailSubject || DEFAULT_CERTIFICATE_EMAIL_SUBJECT,
  );
  const [certBody, setCertBody] = useState(certificateEmailBody || DEFAULT_CERTIFICATE_EMAIL_BODY);
  const [contractSubject, setContractSubject] = useState(
    contractEmailSubject || DEFAULT_CONTRACT_EMAIL_SUBJECT,
  );
  const [contractBody, setContractBody] = useState(contractEmailBody || DEFAULT_CONTRACT_EMAIL_BODY);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateOrganizationEmailTemplates({
        organizationId,
        certificateEmailSubject: certSubject,
        certificateEmailBody: certBody,
        contractEmailSubject: contractSubject,
        contractEmailBody: contractBody,
      });
      toast.success("Modèles d'emails mis à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Certificat d&apos;engagement</h3>
        <Field label="Sujet" htmlFor="cert-tpl-subject">
          <Input id="cert-tpl-subject" required value={certSubject} onChange={(e) => setCertSubject(e.target.value)} />
        </Field>
        <Field label="Corps du message" htmlFor="cert-tpl-body" hint={CERTIFICATE_TOKENS_HINT}>
          <Textarea
            id="cert-tpl-body"
            required
            rows={10}
            value={certBody}
            onChange={(e) => setCertBody(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Contrat d&apos;adoption</h3>
        <Field label="Sujet" htmlFor="contract-tpl-subject">
          <Input
            id="contract-tpl-subject"
            required
            value={contractSubject}
            onChange={(e) => setContractSubject(e.target.value)}
          />
        </Field>
        <Field label="Corps du message" htmlFor="contract-tpl-body" hint={CONTRACT_TOKENS_HINT}>
          <Textarea
            id="contract-tpl-body"
            required
            rows={16}
            value={contractBody}
            onChange={(e) => setContractBody(e.target.value)}
          />
        </Field>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          Enregistrer les modèles
        </Button>
      </div>
    </form>
  );
}
