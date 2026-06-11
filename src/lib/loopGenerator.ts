import { bearing, destinationPoint, haversine } from "./geo";
import { elevationGain } from "./elevation";
import { osrmRoute } from "./osrm";
import { buildOverpassQuery, fetchPois, poiCategory, type Poi } from "./pois";
import { scoreRoute } from "./scoring";
import type {
  LatLng,
  OpenDataReport,
  PoiRecord,
  RideStyle,
  RouteResult,
  ScoreExplanation,
  Waypoint,
} from "./types";

/** Provenance passed in by the API so the dossier can credit the geocoder used. */
export interface GeoProvenance {
  input: string;
  provider: string;
}

/** Public open-data sources credited in the dossier (static metadata). */
const DATA_SOURCES = {
  overpass: {
    id: "overpass",
    name: "OpenStreetMap — Overpass API",
    role: "Points d'intérêt (villages, points de vue, patrimoine, nature)",
    license: "ODbL — © OpenStreetMap contributors",
    url: "https://overpass-api.de",
  },
  osrm: {
    id: "osrm",
    name: "OSRM — Open Source Routing Machine",
    role: "Calcul d'itinéraire sur le réseau routier réel",
    license: "BSD — données OpenStreetMap (ODbL)",
    url: "https://router.project-osrm.org",
  },
  nominatim: {
    id: "nominatim",
    name: "Nominatim — OpenStreetMap",
    role: "Géocodage du point de départ (texte → coordonnées)",
    license: "ODbL — © OpenStreetMap contributors",
    url: "https://nominatim.openstreetmap.org",
  },
  photon: {
    id: "photon",
    name: "Photon (Komoot) + Base Adresse Nationale",
    role: "Autocomplétion d'adresse du point de départ",
    license: "ODbL (OSM) + Licence Ouverte (BAN)",
    url: "https://photon.komoot.io",
  },
} as const;

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
      if (distKm < ringKm * 0.5 || distKm > ringKm * 1.15) continue; // tighter ring → more rural
      const ringErr = Math.abs(distKm - ringKm) / ringKm;
      // Strongly prefer heritage / viewpoints / remarkable nature; ordinary
      // villages (interest 1) carry a penalty so they're only picked as fallback.
      const interestPenalty = (3 - p.interest) * 0.5;
      const score = (db / half) * 0.5 + ringErr + interestPenalty;
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
  opts?: { useElevation?: boolean; provenance?: GeoProvenance }
): Promise<{ route: RouteResult; openData: OpenDataReport } | null> {
  const targetKm = AVG_SPEED[style] * (durationMin / 60);

  // One Overpass call; pool reused across all candidates.
  const poolRadiusM = ringRadiusKm(targetKm, 3) * 1.25 * 1000;
  let pool: Poi[] = [];
  try {
    pool = await fetchPois(start, poolRadiusM, style);
  } catch {
    pool = [];
  }

  // Name → interest tier, to grade how worthwhile a finished loop's POIs are.
  const poolInterest = new Map(pool.map((p) => [p.name, p.interest] as const));

  const NUM_CANDIDATES = 12;
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

    const { score, breakdown, explanation } = scoreRoute(
      route,
      style,
      targetKm,
      elevGain
    );

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

    // Quality = sum of interest tiers of the POIs the loop visits (château=3 > village=1).
    const interestSum = waypoints.reduce(
      (s, w) => s + (w.name ? poolInterest.get(w.name) ?? 1 : 0),
      0
    );
    return { result, score, interestSum, explanation };
  });

  const valid = built.filter(
    (
      b
    ): b is {
      result: RouteResult;
      score: number;
      interestSum: number;
      explanation: ScoreExplanation;
    } => b !== null
  );
  if (!valid.length) return null;

  // Winner = highest fun score. Ties (same rounded score) go to the loop with the
  // more worthwhile POIs (heritage/viewpoints over random villages).
  valid.sort((a, b) => b.score - a.score || b.interestSum - a.interestSum);
  const winner = valid[0];
  const route = winner.result;

  const scores = valid.map((v) => v.score);
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);

  const avgSpeed = AVG_SPEED[style];
  const ringKm = ringRadiusKm(targetKm, 3);
  const steps = [
    `Durée ${durationMin} min × vitesse moyenne ${avgSpeed} km/h → distance cible ≈ ${Math.round(
      targetKm
    )} km`,
    `Rayon de boucle ≈ ${ringKm.toFixed(
      1
    )} km (polygones à 3–4 sommets, ×1.35 pour le détour réel des routes)`,
    `${pool.length} POI récupérés sur Overpass dans un rayon de ${(
      poolRadiusM / 1000
    ).toFixed(1)} km`,
    `${NUM_CANDIDATES} boucles candidates : 1 POI par secteur de boussole, en privilégiant patrimoine / points de vue / nature remarquable (villages en repli), point géométrique si le secteur est vide`,
    `Chaque candidate tracée sur le réseau routier réel via OSRM (${valid.length} routables)`,
    `Fun score calculé pour chacune selon le style ${style}`,
    `La boucle au plus haut fun score est conservée : ${winner.score}/100`,
  ];

  const openData = buildReport({
    route,
    start,
    startName,
    style,
    durationMin,
    targetKm,
    poolRadiusM,
    pool,
    candidatesTried: NUM_CANDIDATES,
    candidatesRouted: valid.length,
    scoreMin,
    scoreMax,
    steps,
    scoreExplanation: winner.explanation,
    provenance: opts?.provenance,
  });

  return { route, openData };
}

/** Assemble the open-data provenance dossier for the winning loop. */
function buildReport(args: {
  route: RouteResult;
  start: LatLng;
  startName: string;
  style: RideStyle;
  durationMin: number;
  targetKm: number;
  poolRadiusM: number;
  pool: Poi[];
  candidatesTried: number;
  candidatesRouted: number;
  scoreMin: number;
  scoreMax: number;
  steps: string[];
  scoreExplanation: ScoreExplanation;
  provenance?: GeoProvenance;
}): OpenDataReport {
  const {
    route,
    start,
    startName,
    style,
    durationMin,
    targetKm,
    poolRadiusM,
    pool,
    candidatesTried,
    candidatesRouted,
    scoreMin,
    scoreMax,
    steps,
    scoreExplanation,
    provenance,
  } = args;

  // Which pooled POIs the winning loop actually passes through (matched by name).
  const usedNames = new Set(
    route.waypoints.map((w) => w.name).filter(Boolean) as string[]
  );
  const records: PoiRecord[] = pool.map((p) => ({
    name: p.name,
    kind: p.kind,
    category: poiCategory(p.kind),
    interest: p.interest,
    lat: p.lat,
    lng: p.lng,
    usedInRoute: usedNames.has(p.name),
  }));

  const byCategoryMap = new Map<string, number>();
  for (const rec of records) {
    byCategoryMap.set(rec.category, (byCategoryMap.get(rec.category) ?? 0) + 1);
  }
  const byCategory = [...byCategoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const h = route.breakdown.highwayFraction;
  const m = route.breakdown.mainRoadFraction;
  const pct = (x: number) => Math.round(x * 100);

  // Credit only the sources actually involved in this search.
  const geoSource = provenance?.provider?.startsWith("Auto")
    ? DATA_SOURCES.photon
    : provenance?.provider?.startsWith("Coord")
      ? null
      : DATA_SOURCES.nominatim;
  const sources = [
    ...(geoSource ? [geoSource] : []),
    DATA_SOURCES.overpass,
    DATA_SOURCES.osrm,
  ];

  return {
    generatedAt: new Date().toISOString(),
    query: {
      input: provenance?.input ?? startName,
      resolvedName: startName,
      lat: start.lat,
      lng: start.lng,
      style,
      durationMin,
      targetKm: Math.round(targetKm),
    },
    geocoding: {
      provider: provenance?.provider ?? "Nominatim (OpenStreetMap)",
      input: provenance?.input ?? startName,
      result: startName,
      lat: start.lat,
      lng: start.lng,
    },
    pois: {
      provider: "Overpass API (OpenStreetMap)",
      searchRadiusKm: Math.round((poolRadiusM / 1000) * 10) / 10,
      overpassQuery: buildOverpassQuery(start, poolRadiusM, style),
      totalFound: pool.length,
      usedInRoute: records.filter((r) => r.usedInRoute).length,
      byCategory,
      records,
    },
    routing: {
      provider: "OSRM (router.project-osrm.org)",
      candidatesTried,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      geometryPoints: route.geometry.length,
      smallRoadsPct: Math.max(0, pct(1 - h - m)),
      mainRoadsPct: pct(m),
      highwayPct: pct(h),
    },
    selection: {
      candidatesGenerated: candidatesTried,
      candidatesRouted,
      winnerScore: route.score,
      scoreMin,
      scoreMax,
      steps,
    },
    scoreExplanation,
    sources,
  };
}
