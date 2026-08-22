"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createVeterinarianTariff,
  updateVeterinarianTariff,
  deleteVeterinarianTariff,
} from "@/server/actions/veterinarians";
import { SPECIES_LABELS, SEX_LABELS } from "@/lib/animal-labels";
import type { AnimalSex, AnimalSpecies, VeterinarianTariff } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";

const SPECIES_OPTIONS = Object.entries(SPECIES_LABELS) as [AnimalSpecies, string][];
// "Inconnu" isn't a meaningful pricing dimension — only offer the two real
// sexes plus the "tous" wildcard (null) for a price that doesn't depend on it.
const SEX_OPTIONS: [AnimalSex, string][] = [
  ["male", SEX_LABELS.male],
  ["femelle", SEX_LABELS.femelle],
];

function TariffRow({
  organizationId,
  tariff,
}: {
  organizationId: string;
  tariff: VeterinarianTariff;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [actName, setActName] = useState(tariff.actName);
  const [species, setSpecies] = useState(tariff.species ?? "");
  const [sex, setSex] = useState(tariff.sex ?? "");
  const [price, setPrice] = useState(tariff.price);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateVeterinarianTariff({
        tariffId: tariff.id,
        organizationId,
        actName,
        species: (species || null) as AnimalSpecies | null,
        sex: (sex || null) as AnimalSex | null,
        price: Number(price),
      });
      toast.success("Tarif mis à jour");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    try {
      await deleteVeterinarianTariff({ tariffId: tariff.id, organizationId });
      toast.success("Tarif supprimé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={5}>
          <form onSubmit={handleSave} className="flex flex-col gap-3 py-2">
            <FieldRow>
              <Field label="Acte" htmlFor={`tariff-act-${tariff.id}`} className="flex-[2]">
                <Input id={`tariff-act-${tariff.id}`} required value={actName} onChange={(e) => setActName(e.target.value)} />
              </Field>
              <Field label="Espèce" htmlFor={`tariff-species-${tariff.id}`} className="flex-1">
                <Select id={`tariff-species-${tariff.id}`} value={species} onChange={(e) => setSpecies(e.target.value)}>
                  <option value="">Toutes</option>
                  {SPECIES_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Sexe" htmlFor={`tariff-sex-${tariff.id}`} className="flex-1">
                <Select id={`tariff-sex-${tariff.id}`} value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Tous</option>
                  {SEX_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prix (€)" htmlFor={`tariff-price-${tariff.id}`} className="flex-1">
                <Input
                  id={`tariff-price-${tariff.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
            </FieldRow>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>Enregistrer</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
            </div>
          </form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{tariff.actName}</TableCell>
      <TableCell>{tariff.species ? SPECIES_LABELS[tariff.species] : "Toutes"}</TableCell>
      <TableCell>{tariff.sex ? SEX_LABELS[tariff.sex] : "Tous"}</TableCell>
      <TableCell>{Number(tariff.price).toFixed(2)} €</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Modifier</Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending}>Supprimer</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function VeterinarianTariffsDialog({
  organizationId,
  veterinarianId,
  veterinarianName,
  tariffs,
}: {
  organizationId: string;
  veterinarianId: string;
  veterinarianName: string;
  tariffs: VeterinarianTariff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actName, setActName] = useState("");
  const [species, setSpecies] = useState("");
  const [sex, setSex] = useState("");
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createVeterinarianTariff({
        organizationId,
        veterinarianId,
        actName,
        species: (species || null) as AnimalSpecies | null,
        sex: (sex || null) as AnimalSex | null,
        price: Number(price),
      });
      toast.success("Tarif ajouté");
      setActName("");
      setSpecies("");
      setSex("");
      setPrice("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Tarifs {tariffs.length > 0 && `(${tariffs.length})`}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Tarifs — ${veterinarianName}`} className="max-w-2xl">
        <div className="flex flex-col gap-4">
          {tariffs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acte</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tariffs.map((tariff) => (
                  <TariffRow key={tariff.id} organizationId={organizationId} tariff={tariff} />
                ))}
              </TableBody>
            </Table>
          )}

          <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-border pt-4">
            <FieldRow>
              <Field label="Acte" htmlFor="new-tariff-act" className="flex-[2]">
                <Input id="new-tariff-act" placeholder="ex : Consultation" required value={actName} onChange={(e) => setActName(e.target.value)} />
              </Field>
              <Field label="Espèce" htmlFor="new-tariff-species" className="flex-1">
                <Select id="new-tariff-species" value={species} onChange={(e) => setSpecies(e.target.value)}>
                  <option value="">Toutes</option>
                  {SPECIES_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Sexe" htmlFor="new-tariff-sex" className="flex-1">
                <Select id="new-tariff-sex" value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Tous</option>
                  {SEX_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prix (€)" htmlFor="new-tariff-price" className="flex-1">
                <Input id="new-tariff-price" type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            </FieldRow>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div>
              <Button type="submit" variant="outline" disabled={pending}>Ajouter un tarif</Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}
