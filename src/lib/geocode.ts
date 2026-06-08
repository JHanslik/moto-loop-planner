export interface Place {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

type PhotonProps = {
  osm_id?: number;
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
  type?: string;
};

/** Build a readable, deduplicated label from Photon address properties. */
export function formatPlace(p: PhotonProps): string {
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ");
  const main =
    p.name ||
    streetLine ||
    p.locality ||
    p.district ||
    p.city ||
    "";

  const tail = [p.postcode, p.city, p.county, p.state, p.country].filter(
    Boolean
  ) as string[];

  const parts = main ? [main, ...tail] : tail;
  const deduped = parts.filter((v, i, a) => i === 0 || v !== a[i - 1]);
  return deduped.join(", ");
}

function rankPlace(
  props: PhotonProps,
  label: string,
  query: string
): number {
  const q = query.toLowerCase();
  const name = label.split(",")[0]?.toLowerCase() ?? "";
  let score = 0;
  if (name.startsWith(q)) score -= 100;
  else if (name.includes(q)) score -= 40;
  if (props.countrycode === "FR") score -= 20;
  if (props.type === "city" || props.type === "town") score -= 10;
  return score;
}

/** Map Photon GeoJSON features to UI places (deduped, ranked for FR type-ahead). */
export function photonFeaturesToPlaces(
  features: unknown[],
  query = ""
): Place[] {
  const seen = new Set<string>();
  const candidates: { place: Place; rank: number }[] = [];

  for (const raw of features) {
    const f = raw as {
      properties?: PhotonProps;
      geometry?: { type?: string; coordinates?: [number, number] };
    };
    if (f?.geometry?.type !== "Point" || !f.geometry.coordinates) continue;

    const props = f.properties ?? {};
    const label = formatPlace(props);
    if (!label) continue;

    const [lng, lat] = f.geometry.coordinates;
    const id = String(props.osm_id ?? `${lat},${lng}`);
    const key = `${id}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      place: { id, label, lng, lat },
      rank: rankPlace(props, label, query),
    });
  }

  return candidates
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 6)
    .map((c) => c.place);
}

/**
 * Address autocomplete via our `/api/geocode` proxy (Photon server-side).
 * Avoids browser CORS/rate-limit issues on photon.komoot.io.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<Place[]> {
  const url =
    "/api/geocode?q=" + encodeURIComponent(query.trim());

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.places) ? data.places : [];
}
