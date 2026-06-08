import type { RouteResult } from "./types";

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!)
  );

/**
 * Build a GPX 1.1 document for a generated loop:
 *  - the full route as a <trk> (track) so moto GPS units draw the exact line
 *  - each waypoint (start + B/C/...) as a <wpt> marker
 */
export function buildGpx(route: RouteResult, name: string): string {
  const safeName = escapeXml(name || "Moto Loop");

  const trkpts = route.geometry
    .map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join("\n");

  const startWpt =
    `  <wpt lat="${route.start.lat}" lon="${route.start.lng}">\n` +
    `    <name>Start / Finish</name>\n  </wpt>`;

  const wpts = route.waypoints
    .map(
      (w, i) =>
        `  <wpt lat="${w.lat}" lon="${w.lng}">\n` +
        `    <name>${escapeXml(w.name || `Waypoint ${i + 1}`)}</name>\n  </wpt>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Moto Loop Planner"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <desc>${route.distanceKm} km · ${route.durationMin} min · fun score ${route.score}/100</desc>
  </metadata>
${startWpt}
${wpts}
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Trigger a client-side download of a GPX file for the given route. */
export function downloadGpx(route: RouteResult, name: string) {
  const gpx = buildGpx(route, name);
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(name || "moto-loop").replace(/[^a-z0-9-_]+/gi, "_")}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
