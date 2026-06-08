import type { RouteResult } from "./types";

const fmt = (n: number) => n.toFixed(6);

/**
 * Google Maps directions deep link for the loop.
 * origin = destination = start (it's a loop), the B/C/... points become waypoints.
 * Google supports a handful of waypoints on the free directions URL, which is
 * exactly what our loops produce.
 *   https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsUrl(route: RouteResult): string {
  const start = `${fmt(route.start.lat)},${fmt(route.start.lng)}`;
  const waypoints = route.waypoints
    .map((w) => `${fmt(w.lat)},${fmt(w.lng)}`)
    .join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: start,
    destination: start,
    travelmode: "driving",
  });
  // URLSearchParams would percent-encode the "|" separator that Google expects raw.
  const base = `https://www.google.com/maps/dir/?${params.toString()}`;
  return waypoints ? `${base}&waypoints=${waypoints}` : base;
}

/**
 * Waze deep link. Waze URLs navigate to a single destination, so for a multi-stop
 * loop we fall back to "ride to the first waypoint" (A → B) and let the rider take
 * it from there. https://developers.google.com/waze/deeplinks
 */
export function wazeUrl(route: RouteResult): string {
  const target = route.waypoints[0] ?? route.start;
  return `https://waze.com/ul?ll=${fmt(target.lat)},${fmt(target.lng)}&navigate=yes`;
}
