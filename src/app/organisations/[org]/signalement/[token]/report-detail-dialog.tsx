"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createReportComment } from "@/server/actions/sterilization-reports";
import { SEX_LABELS } from "@/lib/animal-labels";
import {
  STERILIZATION_NEED_LABELS,
  REPORT_FINDER_STATUS_LABELS,
  REPORT_MANAGEMENT_STATUS_LABELS,
  REPORT_MANAGEMENT_STATUS_BADGE_VARIANT,
} from "@/lib/report-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import type { PublicReport } from "./public-reporting-map-view";

export function ReportDetailDialog({
  mapToken,
  report,
  onClose,
  onCommented,
}: {
  mapToken: string;
  report: PublicReport;
  onClose: () => void;
  onCommented: () => void;
}) {
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Honeypot — invisible and unreachable by keyboard for real visitors.
  const [honeypot, setHoneypot] = useState("");

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createReportComment({ mapToken, reportId: report.id, authorName, text, honeypot });
      toast.success("Commentaire envoyé");
      setAuthorName("");
      setText("");
      onCommented();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Détail du signalement" className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-lg border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={report.photoUrl} alt="" className="max-h-64 w-full object-cover" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>{SEX_LABELS[report.sex]}</Badge>
          <Badge>Stérilisation : {STERILIZATION_NEED_LABELS[report.needsSterilization]}</Badge>
          <Badge>{REPORT_FINDER_STATUS_LABELS[report.finderStatus]}</Badge>
          <Badge variant={REPORT_MANAGEMENT_STATUS_BADGE_VARIANT[report.managementStatus]}>
            {REPORT_MANAGEMENT_STATUS_LABELS[report.managementStatus]}
          </Badge>
        </div>

        {report.description && <p className="text-sm text-muted-foreground">{report.description}</p>}

        <p className="text-xs text-muted-foreground">
          Signalé le {new Date(report.createdAt).toLocaleDateString("fr-FR")}
        </p>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm font-medium">
            Commentaires {report.comments.length > 0 ? `(${report.comments.length})` : ""}
          </p>
          {report.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.comments.map((comment) => (
                <li key={comment.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{comment.authorName}</span> — {comment.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleSubmitComment} className="flex flex-col gap-3 border-t border-border pt-4">
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          />
          <Field label="Votre nom" htmlFor="comment-author" required>
            <Input id="comment-author" required value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
          </Field>
          <Field label="C'est le vôtre ? Dites-le nous ! Une nouvelle information ? On vous écoute !" htmlFor="comment-text" required>
            <Textarea id="comment-text" required value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Commenter
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
