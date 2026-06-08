import { bearing, destinationPoint, haversine } from "./geo";
import { elevationGain } from "./elevation";
import { osrmRoute } from "./osrm";
import { fetchPois, type Poi } from "./pois";
import { scoreRoute } from "./scoring";
import type { LatLng, RideStyle, RouteResult, Waypoint } from "./types";

/** Average moving speed (km/h) used to translate a duration into a target distance. */
const AVG_SPEED: Record<RideStyle, number> = {
  SPORT: 58,
  SCENIC: 48,
  CHILL: 45,
};

/** Circumradius (km) so an N-point polygon ≈ targetKm once snapped to roads. */
function ringRadiusKm(targetKm: number, points: number): number {
  const detour = 1.35; // roads aren't straight lines
  const perimeterFactor = points === 3 ? 3 * Math.sqrt(3) : 4 * Math.SQRT2;
  return targetKm / (detour * perimeterFactor);
}

/** Run `fn` over `items` with bounded concurrency (keeps the OSRM demo happy). */
async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

/**
 * Build one candidate's waypoints by splitting the compass into `sectors` and
 * picking, per sector, the best POI near the target ring distance. Sectors with
 * no POI fall back to a geometric point so the loop stays balanced.
 */
function buildWaypoints(
  start: LatLng,
  pool: Poi[],
  ringKm: number,
  sectors: number,
  rotationDeg: number
): Waypoint[] {
  const out: Waypoint[] = [];
  const used = new Set<number>();
  const half = 360 / sectors / 2;

  for (let k = 0; k < sectors; k++) {
    const sectorCenter = (rotationDeg + (360 / sectors) * k) % 360;

    let bestIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < pool.length; i++) {
      if (used.has(i)) continue;
      const p = pool[i];
      let db = Math.abs(((bearing(start, p) - sectorCenter + 540) % 360) - 180);
      if (db > half + 8) continue; // outside this sector
      const distKm = haversine(start, p) / 1000;
      if (distKm < ringKm * 0.45 || distKm > ringKm * 1.25) continue; // outside ring band
      const ringErr = Math.abs(distKm - ringKm) / ringKm;
      const score = (db / half) * 0.5 + ringErr;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      used.add(bestIdx);
      const p = pool[bestIdx];
      out.push({ lat: p.lat, lng: p.lng, name: p.name });
    } else {
      const angle = sectorCenter + (Math.random() - 0.5) * half;
      const dist = ringKm * 1000 * (0.9 + Math.random() * 0.25);
      const pt = destinationPoint(start, angle, dist);
      out.push({ lat: pt.lat, lng: pt.lng });
    }
  }
  return out;
}

/**
 * Loop generation algorithm.
 *
 * 1. Turn (duration, style) into a target distance and a ring radius.
 * 2. Fetch nice POIs around the start once (Overpass / OpenStreetMap).
 * 3. Build several candidate loops, each visiting POIs spread around the compass
 *    (rotated/varied per candidate); empty sectors use geometric points.
 * 4. Route each candidate on real roads via OSRM.
 * 5. Score each for the style (twistiness + small-road preference + distance fit)
 *    and return the best, keeping POI names on the waypoints.
 */
export async function generateLoop(
  start: LatLng,
  startName: string,
  durationMin: number,
  style: RideStyle,
  opts?: { useElevation?: boolean }
): Promise<RouteResult | null> {
  const targetKm = AVG_SPEED[style] * (durationMin / 60);

  // One Overpass call; pool reused across all candidates.
  const poolRadiusM = ringRadiusKm(targetKm, 3) * 1.25 * 1000;
  let pool: Poi[] = [];
  try {
    pool = await fetchPois(start, poolRadiusM, style);
  } catch {
    pool = [];
  }

  const NUM_CANDIDATES = 8;
  const specs = Array.from({ length: NUM_CANDIDATES }, (_, i) => ({
    points: i % 3 === 2 ? 4 : 3, // mix triangle & quad loops
    rotation: Math.random() * 360,
  }));

  const built = await runPool(specs, 3, async (spec) => {
    const ringKm = ringRadiusKm(targetKm, spec.points);
    const wps = buildWaypoints(start, pool, ringKm, spec.points, spec.rotation);

    const sequence = [start, ...wps.map((w) => ({ lat: w.lat, lng: w.lng })), start];
    const route = await osrmRoute(sequence);
    if (!route) return null;

    let elevGain: number | undefined;
    if (opts?.useElevation) elevGain = await elevationGain(route.coordinates);

    const { score, breakdown } = scoreRoute(route, style, targetKm, elevGain);

    // Use OSRM's road-snapped coords (drop first/last = start), keep POI names.
    const snapped =
      route.snapped.length >= spec.points + 2 ? route.snapped.slice(1, -1) : null;
    const waypoints: Waypoint[] = wps.map((w, i) => {
      const c = snapped && snapped[i] ? snapped[i] : { lat: w.lat, lng: w.lng };
      return { lat: c.lat, lng: c.lng, name: w.name };
    });

    const result: RouteResult = {
      geometry: route.coordinates,
      waypoints,
      start,
      startName,
      distanceKm: Math.round((route.distanceM / 1000) * 10) / 10,
      durationMin: Math.round(route.durationS / 60),
      score,
      style,
      breakdown,
    };

    const namedCount = waypoints.filter((w) => w.name).length;
    // prefer loops that actually visit POIs, without overriding genuine quality
    const selectionScore = score + Math.min(namedCount, 4) * 4;
    return { result, selectionScore };
  });

  const valid = built.filter(
    (b): b is { result: RouteResult; selectionScore: number } => b !== null
  );
  if (!valid.length) return null;

  valid.sort((a, b) => b.selectionScore - a.selectionScore);
  return valid[0].result;
}
