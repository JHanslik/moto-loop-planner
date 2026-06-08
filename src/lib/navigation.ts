import type { LatLng, RouteResult } from "./types";

/** Distance from loop start below which we keep the original departure point. */
export const NAV_START_TOLERANCE_M = 200;

/** Distance from the active route polyline before showing an off-route warning. */
export const OFF_ROUTE_THRESHOLD_M = 80;

const OSRM_BASE =
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

export interface NavStep {
  instruction: string;
  distanceM: number;
  durationS: number;
  location: LatLng;
  maneuver: string;
}

export interface NavRoute {
  geometry: [number, number][];
  steps: NavStep[];
  distanceM: number;
  durationS: number;
}

function stepInstruction(maneuver: {
  type?: string;
  modifier?: string;
  location?: [number, number];
}, name?: string): string {
  const type = maneuver.type ?? "continue";
  const mod = maneuver.modifier ?? "";
  const street = name ? ` sur ${name}` : "";

  const map: Record<string, string> = {
    depart: "Départ",
    arrive: "Arrivée",
    turn: mod.includes("left")
      ? `Tournez à gauche${street}`
      : mod.includes("right")
        ? `Tournez à droite${street}`
        : `Continuez${street}`,
    "new name": `Continuez${street}`,
    merge: `Insérez-vous${street}`,
    fork: mod.includes("left")
      ? `Gardez la gauche${street}`
      : `Gardez la droite${street}`,
    roundabout: `Prenez le rond-point${street}`,
    rotary: `Prenez le rond-point${street}`,
    continue: `Continuez tout droit${street}`,
    end: "Arrivée",
  };

  return map[type] ?? `Continuez${street}`;
}

/** Fetch turn-by-turn steps from OSRM for an ordered list of points. */
export async function osrmNavigationRoute(
  points: LatLng[]
): Promise<NavRoute | null> {
  if (points.length < 2) return null;

  const coordStr = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `${OSRM_BASE}/route/v1/driving/${coordStr}` +
    `?overview=full&geometries=geojson&steps=true&annotations=false`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MotoLoopPlanner/1.0 (school project)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const steps: NavStep[] = [];

    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const m = step.maneuver ?? {};
        const loc = m.location as [number, number] | undefined;
        if (!loc) continue;
        steps.push({
          instruction: stepInstruction(m, step.name),
          distanceM: step.distance ?? 0,
          durationS: step.duration ?? 0,
          location: { lng: loc[0], lat: loc[1] },
          maneuver: `${m.type ?? ""} ${m.modifier ?? ""}`.trim(),
        });
      }
    }

    return {
      geometry: route.geometry.coordinates as [number, number][],
      steps,
      distanceM: route.distance,
      durationS: route.duration,
    };
  } catch {
    return null;
  }
}

/** Haversine distance in metres between two points. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Ordered OSRM waypoints for a saved loop, optionally from the rider position. */
export function navPointsForRoute(
  route: RouteResult,
  fromPosition?: LatLng | null
): LatLng[] {
  const loop = [route.start, ...route.waypoints, route.start];
  if (!fromPosition) return loop;
  if (distanceM(fromPosition, route.start) <= NAV_START_TOLERANCE_M) return loop;
  return [fromPosition, ...route.waypoints, route.start];
}

export function isReroutedFromPosition(
  route: RouteResult,
  fromPosition: LatLng
): boolean {
  return distanceM(fromPosition, route.start) > NAV_START_TOLERANCE_M;
}

/** Shortest distance from a point to a polyline ([lng, lat] pairs). */
export function distanceToPolylineM(
  position: LatLng,
  geometry: [number, number][]
): number {
  if (!geometry.length) return Infinity;
  let best = Infinity;
  for (const [lng, lat] of geometry) {
    best = Math.min(best, distanceM(position, { lat, lng }));
  }
  return best;
}

/** Pick the next navigation step based on current GPS position. */
export function activeStepIndex(
  steps: NavStep[],
  position: LatLng
): number {
  if (!steps.length) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const d = distanceM(position, steps[i].location);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return Math.min(best + 1, steps.length - 1);
}

export function remainingDistanceM(
  steps: NavStep[],
  fromIndex: number
): number {
  return steps
    .slice(fromIndex)
    .reduce((sum, s) => sum + s.distanceM, 0);
}

export function formatEta(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h} h ${r} min` : `${h} h`;
}
