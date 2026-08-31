"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createSterilizationCampaign, updateSterilizationCampaign } from "@/server/actions/sterilization-campaigns";
import type { SterilizationCampaign, SterilizationPartner } from "@/db/schema";
import { STERILIZATION_PARTNER_LABELS } from "@/lib/sterilization-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";

const PARTNER_OPTIONS = Object.entries(STERILIZATION_PARTNER_LABELS) as [SterilizationPartner, string][];

interface VeterinarianOption {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

/** Create/edit form for a sterilization campaign — same dialog for both, distinguished by `campaign`. */
export function CampaignFormDialog({
  organizationId,
  veterinarians,
  campaign,
}: {
  organizationId: string;
  veterinarians: VeterinarianOption[];
  campaign?: SterilizationCampaign;
}) {
  const isEdit = Boolean(campaign);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [city, setCity] = useState(campaign?.city ?? "");
  const [partner, setPartner] = useState<SterilizationPartner | "">(campaign?.partner ?? "");
  const [vetName, setVetName] = useState(campaign?.vetName ?? "");
  const [vetAddress, setVetAddress] = useState(campaign?.vetAddress ?? "");
  const [vetPhone, setVetPhone] = useState(campaign?.vetPhone ?? "");
  const [voucherQuotaTotal, setVoucherQuotaTotal] = useState(
    campaign?.voucherQuotaTotal != null ? String(campaign.voucherQuotaTotal) : "",
  );
  const [voucherQuotaMale, setVoucherQuotaMale] = useState(
    campaign?.voucherQuotaMale != null ? String(campaign.voucherQuotaMale) : "",
  );
  const [voucherQuotaFemale, setVoucherQuotaFemale] = useState(
    campaign?.voucherQuotaFemale != null ? String(campaign.voucherQuotaFemale) : "",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        organizationId,
        city,
        partner: partner as SterilizationPartner,
        vetName,
        vetAddress: vetAddress || undefined,
        vetPhone: vetPhone || undefined,
        voucherQuotaTotal: Number(voucherQuotaTotal),
        voucherQuotaMale: voucherQuotaMale ? Number(voucherQuotaMale) : undefined,
        voucherQuotaFemale: voucherQuotaFemale ? Number(voucherQuotaFemale) : undefined,
      };
      if (isEdit) {
        await updateSterilizationCampaign({ campaignId: campaign!.id, ...payload });
      } else {
        await createSterilizationCampaign(payload);
      }
      toast.success(isEdit ? "Campagne mise à jour" : "Campagne créée");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {isEdit ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Modifier
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="self-start">
          <Plus /> Nouvelle campagne
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Modifier la campagne" : "Nouvelle campagne de stérilisation"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Ville" htmlFor="campaign-city" required>
            <Input id="campaign-city" required value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>

          <Field label="Partenaire" htmlFor="campaign-partner" required>
            <Select
              id="campaign-partner"
              required
              value={partner}
              onChange={(e) => setPartner(e.target.value as SterilizationPartner)}
            >
              <option value="">—</option>
              {PARTNER_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          {veterinarians.length > 0 && (
            <Field
              label="Pré-remplir depuis un vétérinaire partenaire"
              htmlFor="campaign-vet-prefill"
              hint="Facultatif — le véto de cette campagne n'a pas besoin d'être un partenaire de l'association ; ceci ne fait que pré-remplir les champs ci-dessous, modifiables ensuite librement."
            >
              <Select
                id="campaign-vet-prefill"
                value=""
                onChange={(e) => {
                  const vet = veterinarians.find((v) => v.id === e.target.value);
                  if (!vet) return;
                  setVetName(vet.name);
                  setVetAddress(vet.address ?? "");
                  setVetPhone(vet.phone ?? "");
                }}
              >
                <option value="">—</option>
                {veterinarians.map((vet) => (
                  <option key={vet.id} value={vet.id}>
                    {vet.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Nom du vétérinaire" htmlFor="campaign-vet-name" required>
            <Input id="campaign-vet-name" required value={vetName} onChange={(e) => setVetName(e.target.value)} />
          </Field>

          <Field label="Adresse du vétérinaire" htmlFor="campaign-vet-address">
            <Textarea
              id="campaign-vet-address"
              value={vetAddress}
              onChange={(e) => setVetAddress(e.target.value)}
            />
          </Field>

          <Field label="Téléphone du vétérinaire" htmlFor="campaign-vet-phone">
            <Input id="campaign-vet-phone" value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} />
          </Field>

          <Field label="Nombre total de bons" htmlFor="campaign-quota-total" required>
            <Input
              id="campaign-quota-total"
              type="number"
              min="1"
              required
              value={voucherQuotaTotal}
              onChange={(e) => setVoucherQuotaTotal(e.target.value)}
            />
          </Field>

          <FieldRow>
            <Field
              label="Dont bons mâles"
              htmlFor="campaign-quota-male"
              className="flex-1"
              hint="Facultatif — laissez vide si les bons ne sont pas différenciés par sexe."
            >
              <Input
                id="campaign-quota-male"
                type="number"
                min="0"
                value={voucherQuotaMale}
                onChange={(e) => setVoucherQuotaMale(e.target.value)}
              />
            </Field>
            <Field label="Dont bons femelles" htmlFor="campaign-quota-female" className="flex-1">
              <Input
                id="campaign-quota-female"
                type="number"
                min="0"
                value={voucherQuotaFemale}
                onChange={(e) => setVoucherQuotaFemale(e.target.value)}
              />
            </Field>
          </FieldRow>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
