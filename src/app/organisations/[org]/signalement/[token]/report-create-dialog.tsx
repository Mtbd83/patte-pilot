"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createReport } from "@/server/actions/sterilization-reports";
import type { AnimalSex, SterilizationNeed, ReportFinderStatus } from "@/db/schema";
import { SEX_LABELS } from "@/lib/animal-labels";
import { STERILIZATION_NEED_LABELS, REPORT_FINDER_STATUS_LABELS } from "@/lib/report-labels";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";

const SEX_OPTIONS = Object.entries(SEX_LABELS) as [AnimalSex, string][];
const NEED_OPTIONS = Object.entries(STERILIZATION_NEED_LABELS) as [SterilizationNeed, string][];
const FINDER_STATUS_OPTIONS = Object.entries(REPORT_FINDER_STATUS_LABELS) as [ReportFinderStatus, string][];

export function ReportCreateDialog({
  mapToken,
  latitude,
  longitude,
  onClose,
  onCreated,
}: {
  mapToken: string;
  latitude: number;
  longitude: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sex, setSex] = useState<AnimalSex | "">("");
  const [needsSterilization, setNeedsSterilization] = useState<SterilizationNeed | "">("");
  const [finderStatus, setFinderStatus] = useState<ReportFinderStatus | "">("");
  const [description, setDescription] = useState("");
  // Honeypot — invisible and unreachable by keyboard for real visitors.
  const [honeypot, setHoneypot] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Une photo est obligatoire.");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("mapToken", mapToken);
      formData.set("latitude", String(latitude));
      formData.set("longitude", String(longitude));
      formData.set("sex", sex);
      formData.set("needsSterilization", needsSterilization);
      formData.set("finderStatus", finderStatus);
      if (description) formData.set("description", description);
      formData.set("honeypot", honeypot);
      formData.set("file", file);

      await createReport(formData);
      toast.success("Signalement envoyé — merci !");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Signaler un chat">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Honeypot — "website"-style names get auto-filled by some browsers'
            own form-fill heuristics (not just password managers) even with
            autoComplete="off" and off-screen positioning, which silently
            drops a genuine visitor's submission (createReport no-ops on any
            filled honeypot). A name matching no known autofill category
            avoids that false positive while staying just as effective
            against bots, which fill every field regardless of its name. */}
        <input
          type="text"
          name="champ_reference_interne"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />

        <Field label="Photo du chat" htmlFor="report-photo" required>
          <input
            ref={fileInputRef}
            type="file"
            id="report-photo"
            required
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
          />
        </Field>

        <Field label="Genre" htmlFor="report-sex" required>
          <Select id="report-sex" required value={sex} onChange={(e) => setSex(e.target.value as AnimalSex)}>
            <option value="">—</option>
            {SEX_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Le chat a-t-il besoin d'être stérilisé ?" htmlFor="report-need" required>
          <Select
            id="report-need"
            required
            value={needsSterilization}
            onChange={(e) => setNeedsSterilization(e.target.value as SterilizationNeed)}
          >
            <option value="">—</option>
            {NEED_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ce chat est" htmlFor="report-finder-status" required>
          <Select
            id="report-finder-status"
            required
            value={finderStatus}
            onChange={(e) => setFinderStatus(e.target.value as ReportFinderStatus)}
          >
            <option value="">—</option>
            {FINDER_STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Un commentaire à ajouter ?" htmlFor="report-description">
          <Textarea id="report-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Envoyer le signalement
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
