"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { exportAdoptionApplicationPdf } from "@/server/actions/adoption-applications";
import { Button } from "@/components/ui/button";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function base64ToBytes(base64: string) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i);
  return bytes;
}

/** Exports one candidature as a shareable, PattePilot-branded PDF (same content as this page) — e.g. to send it to a co-decision-maker who doesn't have an account. */
export function ExportApplicationPdfButton({
  organizationId,
  applicationId,
  applicantName,
}: {
  organizationId: string;
  applicationId: string;
  applicantName: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const { pdfBase64 } = await exportAdoptionApplicationPdf({ applicationId, organizationId });
      downloadBlob(
        new Blob([base64ToBytes(pdfBase64)], { type: "application/pdf" }),
        `candidature-${applicantName.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      <FileDown /> Exporter en PDF
    </Button>
  );
}
