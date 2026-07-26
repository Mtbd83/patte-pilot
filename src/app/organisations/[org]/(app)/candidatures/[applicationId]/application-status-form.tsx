"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAdoptionApplicationStatus } from "@/server/actions/adoption-applications";
import { ADOPTION_STATUS_LABELS } from "@/lib/adoption-labels";
import type { AdoptionApplicationStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

const STATUS_OPTIONS = Object.entries(ADOPTION_STATUS_LABELS) as [AdoptionApplicationStatus, string][];

export function ApplicationStatusForm({
  organizationId,
  applicationId,
  currentStatus,
  currentReviewNotes,
}: {
  organizationId: string;
  applicationId: string;
  currentStatus: AdoptionApplicationStatus;
  currentReviewNotes: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AdoptionApplicationStatus>(currentStatus);
  const [reviewNotes, setReviewNotes] = useState(currentReviewNotes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateAdoptionApplicationStatus({
        applicationId,
        organizationId,
        status,
        reviewNotes: reviewNotes || undefined,
      });
      toast.success("Statut mis à jour");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Statut" htmlFor="application-status">
        <Select
          id="application-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdoptionApplicationStatus)}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes internes" htmlFor="application-review-notes">
        <Textarea
          id="application-review-notes"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
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
