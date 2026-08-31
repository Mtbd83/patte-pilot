"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createReportingMap, fetchCityBoundary } from "@/server/actions/sterilization-reports";
import type { BoundaryPoint } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { BoundaryDrawMap } from "./boundary-draw-map";

const MIN_BOUNDARY_POINTS = 3;

/**
 * Admin-only: creates a reporting map for a city — one per city per
 * organization. Tries to fetch the city's real boundary automatically
 * (reliable for French communes, same idea as Google Maps showing a
 * place's outline) and pre-fills the zone with it; if that's unavailable,
 * falls back to letting the admin trace the zone by hand (≥3 clicks).
 * Either way, the fetched/traced points stay editable before creating.
 */
export function ReportingMapFormDialog({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fetchingBoundary, setFetchingBoundary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [points, setPoints] = useState<BoundaryPoint[]>([]);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);

  function reset() {
    setCity("");
    setPoints([]);
    setCenter(null);
    setError(null);
  }

  async function handleFetchBoundary() {
    if (!city) return;
    setFetchingBoundary(true);
    try {
      const result = await fetchCityBoundary({ organizationId, city });
      if (result.error) {
        toast.warning(`Localisation de "${city}" impossible — déplacez-vous manuellement sur la carte.`);
        return;
      }
      if (result.center) setCenter(result.center);
      if (result.boundary) {
        setPoints(result.boundary);
        toast.success("Zone récupérée automatiquement — ajustez-la si besoin, ou repartez de zéro.");
      } else {
        toast.warning(`Zone de "${city}" introuvable automatiquement — tracez-la à la main sur la carte.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setFetchingBoundary(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (points.length < MIN_BOUNDARY_POINTS) {
      setError(`Tracez la zone sur la carte (au moins ${MIN_BOUNDARY_POINTS} points).`);
      return;
    }

    setPending(true);
    try {
      await createReportingMap({ organizationId, city, boundary: points });
      toast.success("Carte de signalement créée");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="self-start">
        <Plus /> Nouvelle carte de signalement
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Nouvelle carte de signalement"
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            label="Ville"
            htmlFor="reporting-map-city"
            required
            hint="Une seule carte par ville — le lien public sera partageable dès la création."
          >
            <div className="flex gap-2">
              <Input id="reporting-map-city" required value={city} onChange={(e) => setCity(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchBoundary}
                disabled={!city || fetchingBoundary}
              >
                Récupérer la zone automatiquement
              </Button>
            </div>
          </Field>

          <Field
            label="Zone où un signalement peut être placé"
            htmlFor="reporting-map-boundary"
            required
            hint={`Récupérée automatiquement ci-dessus, ou tracez-la à la main en cliquant sur la carte (au moins ${MIN_BOUNDARY_POINTS} points) — ${points.length} point${points.length > 1 ? "s" : ""} pour le moment.`}
          >
            <BoundaryDrawMap
              points={points}
              onAddPoint={(point) => setPoints((prev) => [...prev, point])}
              center={center}
            />
          </Field>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={points.length === 0}
              onClick={() => setPoints((prev) => prev.slice(0, -1))}
            >
              Annuler le dernier point
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={points.length === 0}
              onClick={() => setPoints([])}
            >
              Recommencer
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending || points.length < MIN_BOUNDARY_POINTS}>
              Créer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
