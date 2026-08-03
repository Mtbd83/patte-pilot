"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { exportAnimalRegisterCsv, exportAnimalRegisterPdf } from "@/server/actions/animals";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

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

export function AnimalRegisterExport({ organizationId, years }: { organizationId: string; years: number[] }) {
  const [year, setYear] = useState("");
  const [pending, setPending] = useState<"csv" | "pdf" | null>(null);

  const periodDescription = year ? `Année ${year}` : "Toutes les années";
  const filenameSuffix = year || "toutes-annees";

  async function handleCsv() {
    setPending("csv");
    try {
      const { csv } = await exportAnimalRegisterCsv({ organizationId, year: year ? Number(year) : undefined });
      // Leading BOM so Excel (esp. on Windows) detects UTF-8 instead of mangling accented characters.
      downloadBlob(
        new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
        `registre-placement-${filenameSuffix}.csv`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(null);
    }
  }

  async function handlePdf() {
    setPending("pdf");
    try {
      const { pdfBase64 } = await exportAnimalRegisterPdf({
        organizationId,
        year: year ? Number(year) : undefined,
        periodDescription,
      });
      downloadBlob(
        new Blob([base64ToBytes(pdfBase64)], { type: "application/pdf" }),
        `registre-placement-${filenameSuffix}.pdf`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registre de placement</CardTitle>
        <CardDescription>
          Registre d&apos;entrée et de sortie des animaux (obligation légale) : animal, n° ICAD, date d&apos;entrée,
          date d&apos;adoption, date de changement d&apos;ICAD.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <Field label="Année" htmlFor="register-year">
          <Select id="register-year" className="w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Toutes les années</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="outline" size="sm" onClick={handleCsv} disabled={pending !== null}>
          <FileDown /> Exporter en CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handlePdf} disabled={pending !== null}>
          <FileDown /> Exporter en PDF
        </Button>
      </CardContent>
    </Card>
  );
}
