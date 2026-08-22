"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createVeterinarian, updateVeterinarian } from "@/server/actions/veterinarians";
import type { Veterinarian } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";

/** Create/edit form for a partner veterinarian — same dialog for both, distinguished by `veterinarian`. */
export function VeterinarianFormDialog({
  organizationId,
  veterinarian,
}: {
  organizationId: string;
  veterinarian?: Veterinarian;
}) {
  const isEdit = Boolean(veterinarian);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(veterinarian?.name ?? "");
  const [address, setAddress] = useState(veterinarian?.address ?? "");
  const [postalCode, setPostalCode] = useState(veterinarian?.postalCode ?? "");
  const [city, setCity] = useState(veterinarian?.city ?? "");
  const [phone, setPhone] = useState(veterinarian?.phone ?? "");
  const [notes, setNotes] = useState(veterinarian?.notes ?? "");
  const [latitude, setLatitude] = useState(veterinarian?.latitude != null ? String(veterinarian.latitude) : "");
  const [longitude, setLongitude] = useState(veterinarian?.longitude != null ? String(veterinarian.longitude) : "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        organizationId,
        name,
        address: address || undefined,
        postalCode: postalCode || undefined,
        city: city || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      };
      const result = isEdit
        ? await updateVeterinarian({ veterinarianId: veterinarian!.id, ...payload })
        : await createVeterinarian(payload);

      if (result.geocodeError) {
        toast.warning(
          `${isEdit ? "Vétérinaire mis à jour" : "Vétérinaire ajouté"}, mais la localisation a échoué : ${result.geocodeError}`,
        );
      } else {
        toast.success(isEdit ? "Vétérinaire mis à jour" : "Vétérinaire ajouté");
      }
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
          <Plus /> Ajouter un vétérinaire
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Modifier le vétérinaire" : "Ajouter un vétérinaire"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nom" htmlFor="vet-name" required>
            <Input id="vet-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Adresse" htmlFor="vet-address">
            <Input id="vet-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <FieldRow>
            <Field label="Code postal" htmlFor="vet-postal-code" className="flex-1">
              <Input id="vet-postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </Field>
            <Field label="Ville" htmlFor="vet-city" className="flex-[2]">
              <Input id="vet-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Téléphone" htmlFor="vet-phone">
            <Input id="vet-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>

          <Field label="Consignes" htmlFor="vet-notes" hint="Toute information utile à connaître (si jamais).">
            <Textarea id="vet-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <details className="rounded-md border border-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground">
              Coordonnées GPS (avancé)
            </summary>
            <div className="flex flex-col gap-4 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">
                Renseignées automatiquement à partir de l&apos;adresse. À remplir vous-même seulement si la
                localisation automatique a échoué (message affiché après l&apos;enregistrement).
              </p>
              <FieldRow>
                <Field label="Latitude" htmlFor="vet-latitude" className="flex-1">
                  <Input
                    id="vet-latitude"
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </Field>
                <Field label="Longitude" htmlFor="vet-longitude" className="flex-1">
                  <Input
                    id="vet-longitude"
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </Field>
              </FieldRow>
            </div>
          </details>

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
