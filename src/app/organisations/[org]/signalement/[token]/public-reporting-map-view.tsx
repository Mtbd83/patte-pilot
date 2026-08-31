"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ReportingMapView } from "@/components/reporting-map-view";
import { isPointInPolygon } from "@/lib/geo";
import type {
  AnimalSex,
  SterilizationNeed,
  ReportFinderStatus,
  ReportManagementStatus,
  BoundaryPoint,
} from "@/db/schema";
import { ReportCreateDialog } from "./report-create-dialog";
import { ReportDetailDialog } from "./report-detail-dialog";

export interface PublicReport {
  id: string;
  latitude: number;
  longitude: number;
  photoUrl: string;
  sex: AnimalSex;
  needsSterilization: SterilizationNeed;
  finderStatus: ReportFinderStatus;
  managementStatus: ReportManagementStatus;
  description: string | null;
  createdAt: Date;
  comments: { id: string; authorName: string; text: string; createdAt: Date }[];
}

/**
 * Orchestrates the interactive map + the two dialogs it can open — reporting
 * a new sighting (click an empty spot) or viewing/commenting on an existing
 * one (click a marker). Deliberately holds no copy of `reports` in state:
 * after a successful create/comment, `router.refresh()` re-runs the server
 * component above and this component just re-renders with the fresh prop.
 */
export function PublicReportingMapView({
  mapToken,
  reports,
  city,
  boundary,
}: {
  mapToken: string;
  reports: PublicReport[];
  city: string;
  boundary: BoundaryPoint[];
}) {
  const router = useRouter();
  const [pickedLocation, setPickedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const selectedReport = reports.find((r) => r.id === selectedReportId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <ReportingMapView
        reports={reports.map((r) => ({
          id: r.id,
          latitude: r.latitude,
          longitude: r.longitude,
          managementStatus: r.managementStatus,
        }))}
        interactive
        boundary={boundary}
        pickedLocation={pickedLocation}
        onPickLocation={(latitude, longitude) => {
          if (!isPointInPolygon({ latitude, longitude }, boundary)) {
            toast.error(`La zone cliquable est uniquement sur la ville de ${city} et ses environs proches.`);
            return;
          }
          setSelectedReportId(null);
          setPickedLocation({ latitude, longitude });
        }}
        onSelectReport={(reportId) => {
          setPickedLocation(null);
          setSelectedReportId(reportId);
        }}
      />
      <p className="text-center text-xs text-muted-foreground">
        {reports.length} signalement{reports.length > 1 ? "s" : ""} sur cette carte.
      </p>

      {pickedLocation && (
        <ReportCreateDialog
          mapToken={mapToken}
          latitude={pickedLocation.latitude}
          longitude={pickedLocation.longitude}
          onClose={() => setPickedLocation(null)}
          onCreated={() => {
            setPickedLocation(null);
            router.refresh();
          }}
        />
      )}

      {selectedReport && (
        <ReportDetailDialog
          mapToken={mapToken}
          report={selectedReport}
          onClose={() => setSelectedReportId(null)}
          onCommented={() => router.refresh()}
        />
      )}
    </div>
  );
}
