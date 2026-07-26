"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAdoptionApplicationStatus } from "@/server/actions/adoption-applications";
import { ADOPTION_STATUS_LABELS } from "@/lib/adoption-labels";
import type { AdoptionApplicationStatus } from "@/db/schema";

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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label htmlFor="application-status">Statut</label>
        <select
          id="application-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdoptionApplicationStatus)}
          style={{ display: "block", width: "100%" }}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor="application-review-notes">
        Notes internes
        <textarea
          id="application-review-notes"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div>
        <button type="submit" disabled={pending}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}
