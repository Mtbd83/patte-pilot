"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createSterilizationVoucher, updateSterilizationVoucher } from "@/server/actions/sterilization-campaigns";
import type { SterilizationVoucher } from "@/db/schema";
import { VOUCHER_SEX_LABELS } from "@/lib/sterilization-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";

type VoucherSex = keyof typeof VOUCHER_SEX_LABELS;
const SEX_OPTIONS = Object.entries(VOUCHER_SEX_LABELS) as [VoucherSex, string][];

/** Create/edit form for one voucher ("bon") — same dialog for both, distinguished by `voucher`. */
export function VoucherFormDialog({
  organizationId,
  campaignId,
  voucher,
}: {
  organizationId: string;
  campaignId: string;
  voucher?: SterilizationVoucher;
}) {
  const isEdit = Boolean(voucher);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [voucherNumber, setVoucherNumber] = useState(voucher?.voucherNumber ?? "");
  const [identificationNumber, setIdentificationNumber] = useState(voucher?.identificationNumber ?? "");
  const [date, setDate] = useState(voucher?.date ?? new Date().toISOString().slice(0, 10));
  const [sex, setSex] = useState<VoucherSex | "">((voucher?.sex as VoucherSex) ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("voucherNumber", voucherNumber);
      formData.set("identificationNumber", identificationNumber);
      formData.set("date", date);
      formData.set("sex", sex);
      const file = fileInputRef.current?.files?.[0];
      if (file) formData.set("file", file);

      if (isEdit) {
        formData.set("voucherId", voucher!.id);
        await updateSterilizationVoucher(formData);
      } else {
        formData.set("campaignId", campaignId);
        await createSterilizationVoucher(formData);
      }
      toast.success(isEdit ? "Bon mis à jour" : "Bon ajouté");
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
          <Plus /> Ajouter un bon
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? "Modifier le bon" : "Ajouter un bon"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Numéro de bon" htmlFor="voucher-number" required>
            <Input
              id="voucher-number"
              required
              value={voucherNumber}
              onChange={(e) => setVoucherNumber(e.target.value)}
            />
          </Field>

          <Field label="Numéro d'identification (puce / tatouage)" htmlFor="voucher-identification" required>
            <Input
              id="voucher-identification"
              required
              value={identificationNumber}
              onChange={(e) => setIdentificationNumber(e.target.value)}
            />
          </Field>

          <FieldRow>
            <Field label="Date" htmlFor="voucher-date" className="flex-1" required>
              <Input
                id="voucher-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Genre" htmlFor="voucher-sex" className="flex-1" required>
              <Select id="voucher-sex" required value={sex} onChange={(e) => setSex(e.target.value as VoucherSex)}>
                <option value="">—</option>
                {SEX_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldRow>

          <Field
            label="Photo"
            htmlFor="voucher-photo"
            hint={isEdit ? "Laissez vide pour conserver la photo actuelle." : "Facultatif."}
          >
            <div className="flex items-center gap-3">
              {voucher?.photoUrl && (
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={voucher.photoUrl} alt="" className="size-full object-cover" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                id="voucher-photo"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {isEdit ? "Enregistrer" : "Ajouter"}
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
