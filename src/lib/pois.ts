import type { LatLng, RideStyle } from "./types";

export interface Poi extends LatLng {
  name: string;
  kind: string;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

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
  const scenicExtra =
    style === "SCENIC"
      ? `\n  node["natural"~"peak|saddle|cliff"](around:${r},${lat},${lng});`
      : "";
  const chillExtra =
    style === "CHILL"
      ? `\n  node["leisure"~"picnic_site|park"](around:${r},${lat},${lng});`
      : "";

  const query = `[out:json][timeout:25];
(
  node["place"~"village|hamlet|locality"](around:${r},${lat},${lng});
  node["tourism"~"viewpoint|attraction"](around:${r},${lat},${lng});
  node["historic"~"castle|ruins|monument"](around:${r},${lat},${lng});
  node["natural"~"wood|forest|water"](around:${r},${lat},${lng});${scenicExtra}${chillExtra}
);
out body 200;`;

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
      if (!name || el.lat == null || el.lon == null) continue;
      const k = `${el.lat.toFixed(3)},${el.lon.toFixed(3)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const kind =
        el.tags.place || el.tags.tourism || el.tags.historic || el.tags.natural || "poi";
      pois.push({ lat: el.lat, lng: el.lon, name, kind });
    }

    if (pois.length > 0) cache.set(key, { at: Date.now(), pois });
    return pois;
  } catch {
    return [];
  }
}
