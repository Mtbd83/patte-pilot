/**
 * Free geocoding via Nominatim (OpenStreetMap's public geocoding service) —
 * no API key, no cost. Called exactly once per vet create/update (an
 * infrequent admin action), never in a loop or on page load: Nominatim's
 * usage policy caps normal use at ~1 request/second and requires a real
 * identifying User-Agent — do not batch-geocode with this function.
 *
 * Returns a discriminated result rather than plain `null` on failure so
 * callers can surface *why* it failed (e.g. in a toast) — geocoding worked
 * fine testing directly, but failed silently once deployed, and without
 * this there was no way to see the actual cause without server log access.
 */
export type GeocodeResult = { latitude: number; longitude: number } | { error: string };

export async function geocodeAddress(input: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): Promise<GeocodeResult | null> {
  const query = [input.address, input.postalCode, input.city].filter(Boolean).join(", ");
  if (!query) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "PattePilot/1.0 (contact@pattepilot.fr)" },
    });
    if (!response.ok) {
      const error = `Nominatim a répondu ${response.status} ${response.statusText}`;
      console.error("[geocodeAddress]", error);
      return { error };
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return { error: "Adresse introuvable" };

    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erreur réseau inconnue";
    console.error("[geocodeAddress]", error);
    return { error };
  }
}

/** A [longitude, latitude] pair, GeoJSON's own coordinate order. */
type GeoJsonPosition = [number, number];

interface NominatimGeoJson {
  type: string;
  coordinates: unknown;
}

const MAX_BOUNDARY_POINTS = 60;

/** Evenly samples down to at most `max` points, preserving the overall shape. */
function decimate<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  return Array.from({ length: max }, (_, i) => points[Math.floor(i * step)]!);
}

/**
 * The outer ring of a Nominatim `geojson` field, whichever of Polygon/
 * MultiPolygon it is — holes and, for a MultiPolygon, every ring but the
 * largest, are ignored: an acceptable simplification for the "roughly this
 * commune's shape" accuracy this app needs, not for precise cartography.
 */
function extractOuterRing(geojson: NominatimGeoJson): GeoJsonPosition[] | null {
  if (geojson.type === "Polygon") {
    const rings = geojson.coordinates as GeoJsonPosition[][];
    return rings[0] ?? null;
  }
  if (geojson.type === "MultiPolygon") {
    const polygons = geojson.coordinates as GeoJsonPosition[][][];
    let largest: GeoJsonPosition[] | null = null;
    for (const polygon of polygons) {
      const outerRing = polygon[0];
      if (outerRing && (!largest || outerRing.length > largest.length)) largest = outerRing;
    }
    return largest;
  }
  return null;
}

export interface CityBoundaryResult {
  center: { latitude: number; longitude: number };
  /** Null when Nominatim has no polygon for this place — caller should fall back to manual drawing. */
  boundary: { latitude: number; longitude: number }[] | null;
}

/**
 * Like geocodeAddress, but also asks Nominatim for the place's real
 * administrative boundary (`polygon_geojson=1`) — reliably available for
 * French communes specifically (near-complete IGN/cadastre import into
 * OSM), not assumed for arbitrary places worldwide. Same rate-limit
 * constraints as geocodeAddress: an infrequent admin action only.
 */
export async function geocodeCityBoundary(city: string): Promise<CityBoundaryResult | { error: string }> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", city);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "PattePilot/1.0 (contact@pattepilot.fr)" },
    });
    if (!response.ok) {
      const error = `Nominatim a répondu ${response.status} ${response.statusText}`;
      console.error("[geocodeCityBoundary]", error);
      return { error };
    }

    const results = (await response.json()) as Array<{
      lat: string;
      lon: string;
      geojson?: NominatimGeoJson;
    }>;
    const first = results[0];
    if (!first) return { error: "Ville introuvable" };

    const center = { latitude: Number(first.lat), longitude: Number(first.lon) };
    const ring = first.geojson ? extractOuterRing(first.geojson) : null;
    const boundary = ring
      ? decimate(
          ring.map(([longitude, latitude]) => ({ latitude, longitude })),
          MAX_BOUNDARY_POINTS,
        )
      : null;

    return { center, boundary };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erreur réseau inconnue";
    console.error("[geocodeCityBoundary]", error);
    return { error };
  }
}
