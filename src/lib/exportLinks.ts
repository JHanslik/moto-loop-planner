import type { RouteResult } from "./types";

const fmt = (n: number) => n.toFixed(6);

/**
 * Google Maps directions deep link for the loop.
 * origin = destination = start (it's a loop), the B/C/... points become waypoints.
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
  const base = `https://www.google.com/maps/dir/?${params.toString()}`;
  return waypoints ? `${base}&waypoints=${waypoints}` : base;
}

/** Single Waze destination deep link (motorcycle routing when supported). */
export function wazeDestinationUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    ll: `${fmt(lat)},${fmt(lng)}`,
    navigate: "yes",
    vehicle_type: "motorcycle",
    utm_source: "moto-loop-planner",
  });
  return `https://waze.com/ul?${params.toString()}`;
}

export interface WazeLeg {
  index: number;
  fromLabel: string;
  toLabel: string;
  url: string;
}

/**
 * Waze deep links only support ONE destination per URL — no multi-waypoint API.
 * We split the loop into legs (Départ → B → C → … → Départ) so the rider can
 * open each segment in Waze sequentially.
 */
export function wazeLegs(route: RouteResult): WazeLeg[] {
  const startLabel = route.startName || "Départ";
  const stops: { lat: number; lng: number; label: string }[] = [
    { lat: route.start.lat, lng: route.start.lng, label: startLabel },
    ...route.waypoints.map((w, i) => ({
      lat: w.lat,
      lng: w.lng,
      label: w.name || `Point ${i + 1}`,
    })),
    { lat: route.start.lat, lng: route.start.lng, label: startLabel },
  ];

  const legs: WazeLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const to = stops[i + 1];
    legs.push({
      index: i + 1,
      fromLabel: stops[i].label,
      toLabel: to.label,
      url: wazeDestinationUrl(to.lat, to.lng),
    });
  }
  return legs;
}

/** @deprecated Use wazeLegs — Waze cannot open a full multi-stop route in one link. */
export function wazeUrl(route: RouteResult): string {
  const legs = wazeLegs(route);
  return legs[0]?.url ?? wazeDestinationUrl(route.start.lat, route.start.lng);
}
