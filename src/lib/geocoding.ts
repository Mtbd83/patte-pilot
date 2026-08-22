/**
 * Free geocoding via Nominatim (OpenStreetMap's public geocoding service) —
 * no API key, no cost. Called exactly once per vet create/update (an
 * infrequent admin action), never in a loop or on page load: Nominatim's
 * usage policy caps normal use at ~1 request/second and requires a real
 * identifying User-Agent — do not batch-geocode with this function.
 */
export async function geocodeAddress(input: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
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
    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch {
    return null;
  }
}
