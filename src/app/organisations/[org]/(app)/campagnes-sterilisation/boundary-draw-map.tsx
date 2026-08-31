"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Polygon, LayerGroup } from "leaflet";
import type { BoundaryPoint } from "@/db/schema";

const FRANCE_CENTER: [number, number] = [46.6, 2.4];

/**
 * Lets an admin trace a reporting map's boundary by clicking a sequence of
 * points — each click appends a vertex, drawn live as a growing polygon.
 * Deliberately separate from ReportingMapView (which handles a different
 * interaction: picking a single point, or displaying existing reports) —
 * mixing the two modes into one component would make both harder to follow.
 */
export function BoundaryDrawMap({
  points,
  onAddPoint,
  center,
}: {
  points: BoundaryPoint[];
  onAddPoint: (point: BoundaryPoint) => void;
  /** A rough center to start the view at (e.g. geocoded from the city name) — purely cosmetic. */
  center?: { latitude: number; longitude: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const polygonRef = useRef<Polygon | null>(null);
  const vertexLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onAddPointRef = useRef(onAddPoint);
  const [ready, setReady] = useState(false);
  const hasCenteredRef = useRef(false);
  const prevPointCountRef = useRef(0);

  // Keep the ref current without touching it during render.
  useEffect(() => {
    onAddPointRef.current = onAddPoint;
  }, [onAddPoint]);

  // Create the map once.
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

      vertexLayerRef.current = L.layerGroup().addTo(map);
      map.on("click", (e) => onAddPointRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng }));

      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-center once, as soon as both the map and a center are ready — never
  // again after that, so it doesn't fight the admin's own pan/zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center || hasCenteredRef.current) return;
    hasCenteredRef.current = true;
    map.setView([center.latitude, center.longitude], 13);
  }, [center, ready]);

  // Redraw the polygon + vertex markers whenever the point list changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const vertexLayer = vertexLayerRef.current;
    if (!L || !map || !vertexLayer) return;

    polygonRef.current?.remove();
    polygonRef.current = null;
    vertexLayer.clearLayers();

    for (const point of points) {
      L.circleMarker([point.latitude, point.longitude], {
        radius: 5,
        color: "#2563eb",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(vertexLayer);
    }

    if (points.length >= 3) {
      polygonRef.current = L.polygon(
        points.map((p) => [p.latitude, p.longitude] as [number, number]),
        { color: "#2563eb", weight: 2, fillOpacity: 0.1 },
      ).addTo(map);
    }

    // A jump of more than one point at once means the list was just
    // bulk-populated (e.g. an auto-fetched boundary), not built up one
    // click at a time — fit the view to it. A single-point increment (a
    // normal click) never refits, so it doesn't fight the admin's own pan/zoom.
    const bulkPopulated = points.length - prevPointCountRef.current > 1;
    prevPointCountRef.current = points.length;
    if (bulkPopulated && points.length > 0) {
      hasCenteredRef.current = true;
      const lats = points.map((p) => p.latitude);
      const lngs = points.map((p) => p.longitude);
      map.fitBounds([
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ]);
    }
  }, [points, ready]);

  return <div ref={containerRef} className="isolate h-80 w-full cursor-crosshair rounded-lg border border-border" />;
}
