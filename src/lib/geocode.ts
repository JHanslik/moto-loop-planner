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

type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
  state?: string;
  country?: string;
};

type NominatimItem = {
  osm_id?: number;
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
};

type BanProps = {
  id?: string;
  banId?: string;
  label?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  context?: string;
  type?: string;
  score?: number;
};

const BAN_RANK_BOOST = -200;

const STOP_WORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "rue",
  "avenue",
  "av",
  "bd",
  "boulevard",
  "place",
  "chemin",
  "route",
  "et",
]);

/** Normalize common FR address typing (Saint Cloud → Saint-Cloud). */
export function normalizeSearchQuery(q: string): string {
  return q
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bsaint\s+([a-zàâäéèêëïîôùûüç-]+)/gi, (_, name: string) => {
      const capped = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      return `Saint-${capped}`;
    });
}

export function looksLikeAddress(q: string): boolean {
  return (
    /\d/.test(q) &&
    /\b(rue|avenue|av\.?|bd\.?|boulevard|place|impasse|chemin|allée|allee|cours|route|passage)\b/i.test(
      q
    )
  );
}

/** Photon struggles with leading house numbers — also search the street + city. */
export function photonQueryVariants(q: string): string[] {
  const normalized = normalizeSearchQuery(q);
  const variants = new Set<string>([normalized, q.trim()]);

  const withoutNumber = normalized.replace(/^\d+\s*,?\s*/, "").trim();
  if (withoutNumber.length >= 3) variants.add(withoutNumber);

  const commaForm = normalized.replace(
    /\s+((?:\d{5})|[A-Za-zÀ-ÿ][\w-]+)\s*$/u,
    ", $1"
  );
  if (commaForm !== normalized) variants.add(commaForm);

  return [...variants];
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function queryTokens(q: string): string[] {
  return norm(q)
    .split(/[\s,]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function dedupeParts(parts: string[]): string[] {
  return parts.filter((v, i, a) => i === 0 || v !== a[i - 1]);
}

/** Build a readable label from Photon address properties. */
export function formatPlace(p: PhotonProps): string {
  const streetLine = [p.housenumber, p.street || p.name]
    .filter(Boolean)
    .join(" ");
  const main =
    (p.street ? streetLine : null) ||
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
  return dedupeParts(parts).join(", ");
}

export function formatNominatim(item: NominatimItem): string {
  const a = item.address;
  if (a) {
    const line1 = [a.house_number, a.road].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.municipality;
    const parts = dedupeParts(
      [line1 || item.name, a.postcode, city, a.state, a.country].filter(
        Boolean
      ) as string[]
    );
    if (parts.length) return parts.join(", ");
  }
  return (item.display_name ?? "")
    .split(",")
    .slice(0, 4)
    .map((s) => s.trim())
    .join(", ");
}

function rankPlace(
  props: PhotonProps | null,
  label: string,
  query: string
): number {
  const labelN = norm(label);
  const queryN = norm(normalizeSearchQuery(query));
  let score = 0;

  for (const token of queryTokens(query)) {
    if (labelN.includes(token)) score -= 20;
  }

  // Boost when a compound city in the query matches (e.g. saint-cloud).
  const cityPhrases = queryN.match(/saint-[a-z]+/g) ?? [];
  for (const phrase of cityPhrases) {
    if (labelN.includes(phrase)) score -= 60;
    else score += 40;
  }

  const houseMatch = queryN.match(/^(\d+)\b/);
  if (houseMatch && props?.housenumber === houseMatch[1]) score -= 40;

  if (props?.countrycode === "FR") score -= 10;
  if (props?.type === "house") score -= 8;
  else if (props?.type === "street") score -= 4;

  const streetHint = queryN.match(
    /\b(?:rue|avenue|bd|boulevard|place|chemin|route)\s+(.+?)(?:,|\s+\d{5}|\s+saint-|\s*$)/i
  );
  if (streetHint) {
    const hint = norm(streetHint[1]);
    if (labelN.includes(hint)) score -= 50;
  }

  return score;
}

/** Map Photon GeoJSON features to UI places. */
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
    const id = `photon-${props.osm_id ?? `${lat},${lng}`}`;
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
    .map((c) => c.place);
}

/** Map API Adresse (BAN) GeoJSON features to UI places. */
export function banFeaturesToPlaces(
  features: unknown[],
  query = ""
): Place[] {
  const seen = new Set<string>();
  const candidates: { place: Place; rank: number }[] = [];

  for (const raw of features) {
    const f = raw as {
      properties?: BanProps;
      geometry?: { type?: string; coordinates?: [number, number] };
    };
    if (f?.geometry?.type !== "Point" || !f.geometry.coordinates) continue;

    const props = f.properties ?? {};
    const label =
      props.label ||
      formatPlace({
        housenumber: props.housenumber,
        street: props.street,
        city: props.city,
        postcode: props.postcode,
        country: "France",
        countrycode: "FR",
      });
    if (!label) continue;

    const [lng, lat] = f.geometry.coordinates;
    const id = `ban-${props.id ?? props.banId ?? `${lat},${lng}`}`;
    const key = `${id}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pseudo: PhotonProps = {
      housenumber: props.housenumber,
      street: props.street,
      city: props.city,
      postcode: props.postcode,
      countrycode: "FR",
      type: props.type === "housenumber" ? "house" : props.type,
    };

    const apiScore = typeof props.score === "number" ? props.score : 0;
    candidates.push({
      place: { id, label, lng, lat },
      rank:
        rankPlace(pseudo, label, query) +
        BAN_RANK_BOOST -
        Math.round(apiScore * 50),
    });
  }

  return candidates
    .sort((a, b) => a.rank - b.rank)
    .map((c) => c.place);
}

export function nominatimToPlaces(items: NominatimItem[], query = ""): Place[] {
  const seen = new Set<string>();
  const candidates: { place: Place; rank: number }[] = [];

  for (const item of items) {
    const label = formatNominatim(item);
    if (!label) continue;

    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const id = `nominatim-${item.osm_id ?? `${lat},${lng}`}`;
    const key = `${id}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pseudo: PhotonProps = {
      housenumber: item.address?.house_number,
      street: item.address?.road,
      city:
        item.address?.city ||
        item.address?.town ||
        item.address?.village,
      postcode: item.address?.postcode,
      countrycode: "FR",
      type: item.address?.house_number ? "house" : "street",
    };

    candidates.push({
      place: { id, label, lng, lat },
      rank: rankPlace(pseudo, label, query),
    });
  }

  return candidates
    .sort((a, b) => a.rank - b.rank)
    .map((c) => c.place);
}

/** Merge Photon + Nominatim hits, dedupe by proximity, return best ranked. */
export function mergePlaces(
  lists: Place[][],
  query: string,
  limit = 6
): Place[] {
  const merged = lists.flat();
  const seen = new Set<string>();
  const ranked: { place: Place; rank: number }[] = [];

  for (const place of merged) {
    const key = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}|${norm(place.label)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push({
      place,
      rank: rankPlace(null, place.label, query),
    });
  }

  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((c) => c.place);
}

/**
 * Address autocomplete via `/api/geocode` (BAN + Photon + Nominatim server-side).
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<Place[]> {
  const url = "/api/geocode?q=" + encodeURIComponent(query.trim());

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.places) ? data.places : [];
}
