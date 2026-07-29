"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { exportAccountingEntriesCsv, exportAccountingEntriesPdf } from "@/server/actions/accounting";
import type { AccountingCategory } from "@/db/schema";
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

export interface AccountingExportFilters {
  organizationId: string;
  category?: AccountingCategory;
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function AccountingExportButtons({
  filters,
  filterDescription,
}: {
  filters: AccountingExportFilters;
  filterDescription: string;
}) {
  const [pending, setPending] = useState<"csv" | "pdf" | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function handleCsv() {
    setPending("csv");
    try {
      const { csv } = await exportAccountingEntriesCsv(filters);
      // Leading BOM so Excel (esp. on Windows) detects UTF-8 instead of
      // mangling accented characters.
      downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `comptabilite-${today}.csv`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(null);
    }
  }

  async function handlePdf() {
    setPending("pdf");
    try {
      const { pdfBase64 } = await exportAccountingEntriesPdf({ ...filters, filterDescription });
      downloadBlob(new Blob([base64ToBytes(pdfBase64)], { type: "application/pdf" }), `comptabilite-${today}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleCsv} disabled={pending !== null}>
        <FileDown /> Exporter en CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handlePdf} disabled={pending !== null}>
        <FileDown /> Exporter en PDF
      </Button>
    </div>
  );
}
