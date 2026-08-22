"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";

export interface VetMapMarker {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
}

function buildPopupContent(vet: VetMapMarker): HTMLElement {
  const container = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = vet.name;
  container.appendChild(title);
  for (const line of [vet.address, vet.city]) {
    if (!line) continue;
    container.appendChild(document.createElement("br"));
    container.appendChild(document.createTextNode(line));
  }
  return container;
}

/**
 * Free map (OpenStreetMap tiles, no API key) plotting geocoded vets — vanilla
 * Leaflet rather than react-leaflet (one less dependency for a fairly static
 * map). Leaflet touches `window` at import time, so it's imported inside
 * useEffect (client-only) rather than at module scope, which would break
 * this Server-rendered-first "use client" component during SSR.
 */
export function VetsMap({ vets }: { vets: VetMapMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || vets.length === 0) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      const icon = L.icon({
        iconUrl: "/leaflet/marker-icon.png",
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        shadowUrl: "/leaflet/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const firstVet = vets[0]!; // guarded by the `vets.length === 0` early return above
      const map = L.map(containerRef.current).setView([firstVet.latitude, firstVet.longitude], 6);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markers: Marker[] = vets.map((vet) =>
        L.marker([vet.latitude, vet.longitude], { icon }).addTo(map).bindPopup(buildPopupContent(vet)),
      );

      if (markers.length > 1) {
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [vets]);

  if (vets.length === 0) return null;

  // `isolate` contains Leaflet's internal panes/controls (z-index up to 1000
  // in leaflet.css) inside this element's own stacking context — without it
  // those values compete in the page's global stacking order and render
  // above anything with a lower z-index, including the Dialog overlay
  // (z-50) used for "Modifier"/"Tarifs".
  return <div ref={containerRef} className="isolate h-80 w-full rounded-lg border border-border" />;
}
