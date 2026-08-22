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
