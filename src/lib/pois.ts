import type { LatLng, RideStyle } from "./types";

export interface Poi extends LatLng {
  name: string;
  kind: string;
  /** How worthwhile as a destination: 3 = heritage/viewpoint/landmark, 2 = nature/notable, 1 = ordinary village (fallback). */
  interest: number;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Tag families that actually make a ride worth detouring for. Heritage, viewpoints
// and remarkable nature sit on the small, scenic roads we want — villages are kept
// only as a fallback so a loop still has waypoints in POI-poor areas.
const HERITAGE = "castle|fort|ruins|monument|memorial|archaeological_site|manor|tower|monastery|city_gate";
// Top-tier heritage worth a detour. `memorial` (mostly village war memorials) is
// fetched but demoted below — too generic to outrank a château or an abbey.
const HERITAGE_TOP = "castle|fort|ruins|monument|archaeological_site|manor|tower|monastery|city_gate";
const SIGHTS = "viewpoint|attraction|artwork";
const NATURE = "peak|volcano|waterfall|cliff|cave_entrance|arch";

/**
 * Build the exact Overpass QL query used for a (center, radius, style). Exported
 * so the open-data dossier can show users the literal query we ran against
 * OpenStreetMap — single source of truth shared with `fetchPois`.
 *
 * Two output sets so villages (which vastly outnumber everything) can't starve
 * the interesting POIs: `.interesting` gets the big budget, `.villages` a small
 * one. `nwr` + `out center` is required to catch castles/abbeys mapped as polygons.
 */
export function buildOverpassQuery(
  center: LatLng,
  radiusM: number,
  style: RideStyle
): string {
  const r = Math.round(radiusM);
  const { lat, lng } = center;
  const a = `(around:${r},${lat},${lng})`;
  const chillExtra =
    style === "CHILL"
      ? `\n  nwr["leisure"~"park|picnic_site"]${a};`
      : "";

  return `[out:json][timeout:25];
(
  nwr["historic"~"${HERITAGE}"]${a};
  nwr["tourism"~"${SIGHTS}"]${a};
  node["natural"~"${NATURE}"]${a};${chillExtra}
)->.interesting;
node["place"~"village|hamlet"]${a}->.villages;
.interesting out center 250;
.villages out center 120;`;
}

/** Map a raw OSM tag value to a friendly, user-facing category. */
export function poiCategory(kind: string): string {
  if (new RegExp(HERITAGE).test(kind)) return "Patrimoine";
  if (/viewpoint|attraction|artwork/.test(kind)) return "Point de vue / curiosité";
  if (new RegExp(NATURE).test(kind)) return "Nature remarquable";
  if (/village_historic/.test(kind)) return "Village historique";
  if (/park|picnic_site|water|spring/.test(kind)) return "Détente / nature";
  if (/village|hamlet|locality|town/.test(kind)) return "Village / hameau";
  return "Autre";
}

/** Interest tier (1–3) of a POI from its kind. Drives waypoint preference. */
export function poiInterest(kind: string): number {
  if (new RegExp(HERITAGE_TOP).test(kind)) return 3;
  if (/viewpoint|attraction|artwork/.test(kind)) return 3;
  if (new RegExp(NATURE).test(kind)) return 3;
  if (/memorial|village_historic|park|picnic_site|water|spring/.test(kind)) return 2;
  return 1; // ordinary village / hamlet — fallback only
}

// In-memory cache: Overpass is the slow, variable part of generation. Caching by
// (rounded area, radius, style) makes repeated generations in the same region
// instant and smooths over Overpass latency spikes.
interface CacheEntry {
  at: number;
  pois: Poi[];
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch nice, named points of interest around a center via the Overpass API
 * (OpenStreetMap). These become loop waypoints, so the route is forced to pass
 * through pleasant places (villages, châteaux, viewpoints, peaks) — which sit on
 * small roads, not nationales.
 *
 * Any failure/timeout returns [] and the generator falls back to geometric
 * waypoints. Successful, non-empty results are cached.
 */
export async function fetchPois(
  center: LatLng,
  radiusM: number,
  style: RideStyle
): Promise<Poi[]> {
  const r = Math.round(radiusM);
  const { lat, lng } = center;

  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(r / 1000)},${style}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.pois;

  // POIs on small roads: villages, viewpoints, nature — avoid routing via N/A axes.
  const query = buildOverpassQuery(center, r, style);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "MotoLoopPlanner/1.0 (school project)",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(22000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();

    const seen = new Set<string>();
    const pois: Poi[] = [];
    for (const el of data.elements ?? []) {
      const name = el.tags?.name;
      // Ways/relations report their position under `center` (out center).
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!name || elLat == null || elLon == null) continue;
      const k = `${elLat.toFixed(3)},${elLon.toFixed(3)}`;
      if (seen.has(k)) continue;
      seen.add(k);

      const t = el.tags;
      const isVillage = t.place && /village|hamlet/.test(t.place);
      // A village classed/heritage-listed is worth more than a random hamlet.
      const kind =
        isVillage && (t.historic || t.heritage)
          ? "village_historic"
          : t.historic || t.tourism || t.natural || t.leisure || t.place || "poi";

      pois.push({
        lat: elLat,
        lng: elLon,
        name,
        kind,
        interest: poiInterest(kind),
      });
    }

    if (pois.length > 0) cache.set(key, { at: Date.now(), pois });
    return pois;
  } catch {
    return [];
  }
}
