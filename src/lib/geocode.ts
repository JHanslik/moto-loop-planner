export interface Place {
  label: string;
  lat: number;
  lng: number;
}

/** Build a readable, deduplicated label from Photon's address properties. */
function formatPlace(p: any): string {
  const main =
    p.name ||
    [p.housenumber, p.street].filter(Boolean).join(" ") ||
    p.city ||
    "";
  const parts = [main, p.city, p.county, p.state, p.country].filter(
    Boolean
  ) as string[];
  // collapse consecutive duplicates (e.g. name === city)
  return parts.filter((v, i, a) => i === 0 || v !== a[i - 1]).join(", ");
}

/**
 * Address / place autocomplete via Photon (photon.komoot.io) — an OpenStreetMap
 * geocoder built for type-ahead search. No API key, CORS-enabled.
 * Returns up to 5 deduplicated suggestions, or [] on any failure/abort.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<Place[]> {
  const url =
    "https://photon.komoot.io/api/?limit=6&lang=en&q=" +
    encodeURIComponent(query);

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();

  const seen = new Set<string>();
  const out: Place[] = [];
  for (const f of data.features ?? []) {
    if (f?.geometry?.type !== "Point") continue;
    const label = formatPlace(f.properties);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({
      label,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    });
    if (out.length >= 5) break;
  }
  return out;
}
