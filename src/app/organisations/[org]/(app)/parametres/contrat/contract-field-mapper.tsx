"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import {
  updateOrganizationContractTemplate,
  updateOrganizationContractFieldPositions,
} from "@/server/actions/organizations";
import { previewContractFieldMapping } from "@/server/actions/documents";
import { CONTRACT_TEXT_FIELDS, CONTRACT_CHECKBOX_FIELDS } from "@/lib/contract-fields";
import type { ContractFieldPositions } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// A plain static path (public/pdf.worker.min.mjs, copied by
// scripts/copy-pdf-worker.mjs on every `npm install`) rather than letting
// webpack bundle the worker itself — its `import.meta` usage breaks
// Terser's production minification (only surfaces in `next build`, not
// `next dev`).
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const RENDER_SCALE = 1.4;
const ALL_FIELDS = [...CONTRACT_TEXT_FIELDS, ...CONTRACT_CHECKBOX_FIELDS];

interface PageMeta {
  pageNumber: number;
  /** Page height in unscaled PDF points — needed to flip click Y (top-down pixels) into pdf-lib's bottom-up points. */
  heightPoints: number;
}

export function ContractFieldMapper({
  organizationId,
  contractTemplateUrl,
  initialPositions,
}: {
  organizationId: string;
  contractTemplateUrl: string | null;
  initialPositions: ContractFieldPositions | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesMetaRef = useRef<PageMeta[]>([]);

  const [uploadPending, setUploadPending] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [positions, setPositions] = useState<ContractFieldPositions>(initialPositions ?? {});
  const [armedField, setArmedField] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fieldSize, setFieldSize] = useState("10");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!contractTemplateUrl || !containerRef.current) return;
    let cancelled = false;
    setRendering(true);
    setRenderError(null);

    async function renderPages() {
      try {
        const pdf = await pdfjsLib.getDocument({ url: contractTemplateUrl! }).promise;
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        pagesMetaRef.current = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const unscaledViewport = page.getViewport({ scale: 1 });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.dataset.pageNumber = String(pageNumber);
          canvas.className = "block max-w-full border border-border";
          const context = canvas.getContext("2d");
          if (!context) continue;
          await page.render({ canvas, canvasContext: context, viewport }).promise;

          const wrapper = document.createElement("div");
          wrapper.style.position = "relative";
          wrapper.appendChild(canvas);
          containerRef.current.appendChild(wrapper);

          pagesMetaRef.current.push({ pageNumber, heightPoints: unscaledViewport.height });
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : "Impossible d'afficher le PDF.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    renderPages();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractTemplateUrl]);

  // Draw pins for placed fields over the rendered pages whenever positions change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll("[data-pin]").forEach((el) => el.remove());

    for (const field of ALL_FIELDS) {
      const pos = positions[field.key];
      if (!pos) continue;
      const wrapper = container.children[pos.page] as HTMLElement | undefined;
      if (!wrapper) continue;
      const pin = document.createElement("div");
      pin.dataset.pin = field.key;
      pin.title = field.label;
      pin.style.position = "absolute";
      pin.style.left = `${pos.x * RENDER_SCALE - 6}px`;
      pin.style.top = `${wrapper.clientHeight - pos.y * RENDER_SCALE - 6}px`;
      pin.style.width = "12px";
      pin.style.height = "12px";
      pin.style.borderRadius = "50%";
      pin.style.background = "#0e8a5c";
      pin.style.border = "2px solid white";
      pin.style.boxShadow = "0 0 0 1px #0e8a5c";
      pin.style.pointerEvents = "none";
      wrapper.appendChild(pin);
    }
  }, [positions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleClick(e: MouseEvent) {
      if (!armedField) return;
      const canvas = (e.target as HTMLElement).closest("canvas") as HTMLCanvasElement | null;
      if (!canvas) return;
      const pageNumber = Number(canvas.dataset.pageNumber);
      const meta = pagesMetaRef.current.find((m) => m.pageNumber === pageNumber);
      if (!meta) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const x = clickX / RENDER_SCALE;
      const y = meta.heightPoints - clickY / RENDER_SCALE;
      const size = Number(fieldSize) || 10;

      setPositions((prev) => ({
        ...prev,
        [armedField]: { page: pageNumber - 1, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, size },
      }));
      setArmedField(null);
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [armedField, fieldSize]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPending(true);
    try {
      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("file", file);
      await updateOrganizationContractTemplate(formData);
      toast.success("Modèle de contrat mis à jour");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setUploadPending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearField(key: string) {
    setPositions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handlePreview() {
    setPreviewPending(true);
    try {
      const { pdfBase64 } = await previewContractFieldMapping({ organizationId, positions });
      const byteChars = atob(pdfBase64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleSave() {
    setSavePending(true);
    try {
      await updateOrganizationContractFieldPositions({ organizationId, positions });
      toast.success("Mappage du contrat enregistré");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSavePending(false);
    }
  }

  const placedCount = useMemo(
    () => ALL_FIELDS.filter((f) => positions[f.key]).length,
    [positions],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          id="contract-template-input"
          onChange={handleUpload}
          disabled={uploadPending}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploadPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {contractTemplateUrl ? "Remplacer le modèle de contrat" : "Téléverser mon contrat"}
        </Button>
        {contractTemplateUrl && (
          <a
            href={contractTemplateUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground underline"
          >
            Voir le fichier actuel
          </a>
        )}
      </div>

      {!contractTemplateUrl && (
        <p className="text-sm text-muted-foreground">
          Téléversez d&apos;abord votre contrat pour pouvoir y placer les champs.
        </p>
      )}

      {contractTemplateUrl && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-2">
            {armedField && (
              <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">
                Cliquez sur le document à l&apos;endroit où écrire «{" "}
                {ALL_FIELDS.find((f) => f.key === armedField)?.label} ».
              </p>
            )}
            {rendering && <p className="text-sm text-muted-foreground">Chargement du document…</p>}
            {renderError && <p className="text-sm text-destructive">{renderError}</p>}
            <div ref={containerRef} className="flex flex-col gap-4" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="field-size" className="text-sm text-muted-foreground">
                Taille du texte
              </label>
              <Input
                id="field-size"
                type="number"
                min={6}
                max={24}
                value={fieldSize}
                onChange={(e) => setFieldSize(e.target.value)}
                className="w-16"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {placedCount} / {ALL_FIELDS.length} champs placés
            </p>

            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "32rem" }}>
              {ALL_FIELDS.map((field) => {
                const placed = Boolean(positions[field.key]);
                return (
                  <div
                    key={field.key}
                    className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm ${
                      armedField === field.key ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span className={placed ? "" : "text-muted-foreground"}>{field.label}</span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={armedField === field.key ? "default" : "outline"}
                        onClick={() => setArmedField(field.key)}
                      >
                        Placer
                      </Button>
                      {placed && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => clearField(field.key)}>
                          Effacer
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={handlePreview} disabled={previewPending}>
                Prévisualiser
              </Button>
              <Button type="button" onClick={handleSave} disabled={savePending}>
                Enregistrer le mappage
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <iframe
          src={previewUrl}
          title="Aperçu du contrat avec données factices"
          className="h-[600px] w-full rounded-md border border-border"
        />
      )}
    </div>
  );
}
