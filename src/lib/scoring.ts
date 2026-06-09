import { bearing } from "./geo";
import type { OsrmRoute } from "./osrm";
import type { RideStyle, ScoreBreakdown } from "./types";

// Speed thresholds (m/s) — tuned to catch more nationales / axes rapides on OSRM "driving".
const MOTORWAY_SPEED = 26; // ~94 km/h — autoroute / voie express
const MAIN_ROAD_SPEED = 16.5; // ~59 km/h — nationale / départementale rapide

/** Sum of absolute heading changes along the geometry, in degrees. The core "twistiness" signal. */
function totalTurning(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length - 1; i++) {
    const a = { lng: coords[i - 1][0], lat: coords[i - 1][1] };
    const b = { lng: coords[i][0], lat: coords[i][1] };
    const c = { lng: coords[i + 1][0], lat: coords[i + 1][1] };
    let delta = Math.abs(bearing(b, c) - bearing(a, b));
    if (delta > 180) delta = 360 - delta;
    total += delta;
  }
  return total;
}

/** Fractions of total distance on motorway-like and nationale-like (fast) segments. */
function roadFractions(route: OsrmRoute): { highway: number; main: number } {
  let hw = 0;
  let main = 0;
  let total = 0;
  for (const s of route.segments) {
    total += s.distance;
    const speed = s.duration > 0 ? s.distance / s.duration : 0;
    if (speed > MOTORWAY_SPEED) hw += s.distance;
    else if (speed > MAIN_ROAD_SPEED) main += s.distance;
  }
  return total > 0 ? { highway: hw / total, main: main / total } : { highway: 0, main: 0 };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Score a candidate route 0..100 ("fun score") for a given riding style.
 *
 * Sub-metrics (0..1):
 *  - twistiness   : turning per km, saturating at ~60°/km
 *  - smallRoads   : 1 - (motorway + main-road fraction) — rewards staying off
 *                   autoroutes AND nationales (the "trop de nationale" fix)
 *  - distanceMatch: closeness to the target distance
 *  - elevation    : (optional) climbing, SCENIC only
 *
 * smallRoads is weighted heavily because, on the public OSRM "fastest" profile,
 * actively *preferring* small roads is the only lever we have to fight nationales.
 */
export function scoreRoute(
  route: OsrmRoute,
  style: RideStyle,
  targetKm: number,
  elevationGainM?: number
): { score: number; breakdown: ScoreBreakdown } {
  const distanceKm = route.distanceM / 1000;
  const turn = totalTurning(route.coordinates);
  const turnsPerKm = distanceKm > 0 ? turn / distanceKm : 0;

  const twistiness = clamp01(turnsPerKm / 60);
  const { highway, main } = roadFractions(route);
  const fastRoads = highway + main;
  // Amplify penalty for A/N segments — linear 1-fastRoads wasn't harsh enough.
  const smallRoads = clamp01(1 - fastRoads * 1.35);
  const distanceMatch = clamp01(1 - Math.abs(distanceKm - targetKm) / targetKm);
  const elevNorm =
    elevationGainM !== undefined
      ? clamp01(elevationGainM / (distanceKm * 15)) // ~15 m/km counts as hilly
      : undefined;

  let fun: number;
  switch (style) {
    case "SPORT":
      fun =
        100 *
        (0.32 * twistiness + 0.18 * distanceMatch + 0.5 * smallRoads);
      break;
    case "SCENIC":
      fun =
        elevNorm !== undefined
          ? 100 *
            (0.2 * twistiness +
              0.15 * distanceMatch +
              0.45 * smallRoads +
              0.2 * elevNorm)
          : 100 * (0.25 * twistiness + 0.2 * distanceMatch + 0.55 * smallRoads);
      break;
    case "CHILL":
    default: {
      const chillTwist = 1 - Math.abs(twistiness - 0.4) / 0.6;
      fun =
        100 *
        (0.2 * distanceMatch + 0.55 * smallRoads + 0.25 * Math.max(0, chillTwist));
      break;
    }
  }

  // Hard malus when the loop is mostly on fast roads — keeps worst A/N candidates out.
  if (fastRoads > 0.45) fun *= 1 - (fastRoads - 0.45) * 1.4;

  return {
    score: Math.round(clamp01(fun / 100) * 100),
    breakdown: {
      turnsPerKm,
      twistiness,
      highwayFraction: highway,
      mainRoadFraction: main,
      elevationGainM,
    },
  };
}
