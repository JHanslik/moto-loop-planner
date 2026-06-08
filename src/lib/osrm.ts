import type { LatLng } from "./types";

const OSRM_BASE =
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

export interface OsrmRoute {
  /** Full geometry as [lng, lat] pairs (GeoJSON order). */
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  /** Per-segment distance/duration, used to infer road speed (motorway detection). */
  segments: { distance: number; duration: number }[];
  /** Road-snapped input points (start, B, C, ..., start). */
  snapped: LatLng[];
}

/**
 * Ask OSRM to route through an ordered list of points and return the real,
 * road-following geometry. Returns null on any failure so the generator can
 * simply skip a bad candidate.
 */
export async function osrmRoute(points: LatLng[]): Promise<OsrmRoute | null> {
  const coordStr = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `${OSRM_BASE}/route/v1/driving/${coordStr}` +
    `?overview=full&geometries=geojson&annotations=distance,duration&steps=false`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MotoLoopPlanner/1.0 (school project)" },
      // routing is dynamic; never cache
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !Array.isArray(data.routes) || !data.routes.length) {
      return null;
    }

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates as [number, number][];

    const segments: { distance: number; duration: number }[] = [];
    for (const leg of route.legs ?? []) {
      const ann = leg.annotation;
      if (ann?.distance && ann?.duration) {
        for (let i = 0; i < ann.distance.length; i++) {
          segments.push({ distance: ann.distance[i], duration: ann.duration[i] });
        }
      }
    }

    const snapped: LatLng[] = (data.waypoints ?? []).map((w: any) => ({
      lng: w.location[0],
      lat: w.location[1],
    }));

    return {
      coordinates,
      distanceM: route.distance,
      durationS: route.duration,
      segments,
      snapped,
    };
  } catch {
    return null;
  }
}
