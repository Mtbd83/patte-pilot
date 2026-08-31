"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup, CircleMarker as LeafletCircleMarker } from "leaflet";
import { cn } from "@/lib/utils";
import { boundingBox } from "@/lib/geo";
import type { ReportManagementStatus, BoundaryPoint } from "@/db/schema";
import { REPORT_MANAGEMENT_STATUS_MAP_COLORS } from "@/lib/report-labels";

export interface ReportMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  managementStatus: ReportManagementStatus;
}

const FRANCE_CENTER: [number, number] = [46.6, 2.4];

/**
 * Free map (OpenStreetMap tiles, no API key) for a reporting map's stray-cat
 * sightings — vanilla Leaflet, same reasoning as vets-map.tsx (one less
 * dependency, Leaflet touches `window` at import time so it's loaded
 * dynamically inside useEffect rather than at module scope).
 *
 * Unlike vets-map.tsx (pure display, recreated whole on every prop change),
 * this one supports click-to-report (`interactive`) and needs to add a new
 * marker without losing the viewer's current pan/zoom — so the Leaflet map
 * instance is created once, and reports/the picked location are synced onto
 * it in their own effects.
 */
export function ReportingMapView({
  reports,
  interactive = false,
  onSelectReport,
  onPickLocation,
  pickedLocation,
  boundary,
}: {
  reports: ReportMapMarker[];
  interactive?: boolean;
  onSelectReport?: (reportId: string) => void;
  onPickLocation?: (latitude: number, longitude: number) => void;
  pickedLocation?: { latitude: number; longitude: number } | null;
  /** The map's admin-drawn zone — used both to center the initial view and to outline where a report is accepted. */
  boundary?: BoundaryPoint[] | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const pickMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const hasFitBoundsRef = useRef(false);

  // Create the map once — reports/pickedLocation are synced in their own
  // effects below so re-selecting/re-reporting never resets the viewport.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current).setView(FRANCE_CENTER, 5);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (boundary && boundary.length >= 3) {
        const bbox = boundingBox(boundary);
        map.fitBounds([
          [bbox.south, bbox.west],
          [bbox.north, bbox.east],
        ]);
        L.polygon(
          boundary.map((p) => [p.latitude, p.longitude] as [number, number]),
          { color: "#2563eb", weight: 2, fillOpacity: 0.06 },
        ).addTo(map);
        hasFitBoundsRef.current = true;
      }

      markersLayerRef.current = L.layerGroup().addTo(map);

      if (interactive) {
        map.on("click", (e) => onPickLocation?.(e.latlng.lat, e.latlng.lng));
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Intentionally run once — `interactive`/`onPickLocation` don't change
    // across this component's lifetime in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync report markers whenever the list changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();
    const markers = reports.map((report) => {
      const color = REPORT_MANAGEMENT_STATUS_MAP_COLORS[report.managementStatus];
      const marker = L.circleMarker([report.latitude, report.longitude], {
        radius: 9,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85,
      }).addTo(layer);
      marker.on("click", (e) => {
        // circleMarker (unlike a plain icon Marker) bubbles clicks to the
        // map by default — without stopping it, this click would also fire
        // the map's own "click" handler (onPickLocation) right after,
        // immediately clearing the selection and reopening the create-report
        // dialog instead of the one for this existing report.
        L.DomEvent.stopPropagation(e);
        onSelectReport?.(report.id);
      });
      return marker;
    });

    if (!hasFitBoundsRef.current && markers.length > 0) {
      hasFitBoundsRef.current = true;
      if (markers.length === 1) {
        map.setView(markers[0]!.getLatLng(), 12);
      } else {
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, ready]);

  // Sync the temporary "picked location" marker (interactive mode only).
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;

    if (pickedLocation) {
      pickMarkerRef.current = L.circleMarker([pickedLocation.latitude, pickedLocation.longitude], {
        radius: 9,
        color: "#dc2626",
        weight: 2,
        fillColor: "#dc2626",
        fillOpacity: 0.9,
      }).addTo(map);
      map.panTo([pickedLocation.latitude, pickedLocation.longitude]);
    }
  }, [pickedLocation, ready]);

  // `isolate` contains Leaflet's internal panes/controls (z-index up to 1000
  // in leaflet.css) inside this element's own stacking context — without it
  // those values compete in the page's global stacking order and render
  // above anything with a lower z-index, including a Dialog overlay.
  return (
    <div
      ref={containerRef}
      className={cn("isolate h-96 w-full rounded-lg border border-border", interactive && "cursor-crosshair")}
    />
  );
}
