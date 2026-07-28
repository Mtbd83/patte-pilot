"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveOrganizationSignupRequest, rejectOrganizationSignupRequest } from "@/server/actions/platform";
import { slugify } from "@/lib/slugify";
import type { OrganizationSignupRequest } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS = { en_attente: "En attente", approuve: "Validée", refuse: "Refusée" } as const;
const STATUS_VARIANTS = { en_attente: "warning", approuve: "success", refuse: "destructive" } as const;

export function SignupRequestRow({ request }: { request: OrganizationSignupRequest }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approving" | "rejecting">("idle");
  const [slug, setSlug] = useState(slugify(request.organizationName));
  const [reviewNotes, setReviewNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setPending(true);
    setError(null);
    try {
      await approveOrganizationSignupRequest({ requestId: request.id, slug });
      toast.success("Association créée, invitation envoyée");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleReject() {
    setPending(true);
    setError(null);
    try {
      await rejectOrganizationSignupRequest({ requestId: request.id, reviewNotes: reviewNotes || undefined });
      toast.success("Demande refusée");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={STATUS_VARIANTS[request.status]}>{STATUS_LABELS[request.status]}</Badge>
        {request.siren && <span className="text-muted-foreground">SIREN {request.siren}</span>}
        {request.city && <span className="text-muted-foreground">{request.city}</span>}
      </div>

      {request.message && <p className="text-sm text-muted-foreground">{request.message}</p>}
      {request.status === "refuse" && request.reviewNotes && (
        <p className="text-sm text-muted-foreground">Motif : {request.reviewNotes}</p>
      )}

      {request.status === "en_attente" && (
        <>
          {mode === "idle" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setMode("approving")}>
                Valider
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode("rejecting")}>
                Refuser
              </Button>
            </div>
          )}

          {mode === "approving" && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <Field
                label="Slug (URL)"
                htmlFor={`slug-${request.id}`}
                hint="Vérifiez/ajustez avant de valider — ne pourra plus être changé simplement ensuite."
              >
                <Input id={`slug-${request.id}`} value={slug} onChange={(e) => setSlug(e.target.value)} />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleApprove} disabled={pending || !slug}>
                  Confirmer la création
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={pending}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {mode === "rejecting" && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <Field label="Motif (facultatif, interne)" htmlFor={`notes-${request.id}`}>
                <Textarea
                  id={`notes-${request.id}`}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </Field>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleReject} disabled={pending}>
                  Confirmer le refus
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={pending}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
